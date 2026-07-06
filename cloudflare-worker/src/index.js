/**
 * DEKUT HOSTELS — CLOUDFLARE WORKER CACHE
 * High-performance caching layer for Firestore.
 * Handles 10k+ concurrent requests with:
 * - Stale-While-Revalidate (SWR) with random TTL jitter
 * - Single-flight request coalescing / distributed locking via KV
 * - Firestore REST API parser (reads from Firebase only when cache is stale)
 * - Webhook-based immediate invalidation (/update-cache)
 * - Daily proactive cache warming (cron — once per day to stay within Firebase free tier)
 * - Strict Cloudflare-only serving — no fallback to Firestore SDK or static files
 *
 * Worker URL: https://dekuthostels-cache.giwme1socialtalk.workers.dev
 * Endpoints:
 *   GET  /hostels.json   — returns cached hostels array
 *   GET  /               — alias for /hostels.json
 *   POST /update-cache   — force refresh (Authorization: Bearer <CACHE_SECRET>)
 */

// How long before a cached value is considered stale (24 hours)
const SOFT_TTL_MS = 24 * 60 * 60 * 1000;
// Jitter window: ±30 minutes so multiple isolates don't all expire at exactly the same moment
const JITTER_MS = 30 * 60 * 1000;
// Lock TTL — the background refresh must finish within this window
const LOCK_TTL_SEC = 90;

// ─── Firestore REST Parser ────────────────────────────────────────────────────

function parseValue(field) {
  if (!field) return null;
  if ('stringValue'  in field) return field.stringValue;
  if ('integerValue' in field) return parseInt(field.integerValue, 10);
  if ('doubleValue'  in field) return parseFloat(field.doubleValue);
  if ('booleanValue' in field) return field.booleanValue;
  if ('nullValue'    in field) return null;
  if ('mapValue'     in field) {
    const result = {};
    const fields = field.mapValue.fields || {};
    for (const key in fields) result[key] = parseValue(fields[key]);
    return result;
  }
  if ('arrayValue' in field) {
    return (field.arrayValue.values || []).map(parseValue);
  }
  return undefined;
}

function parseDocument(doc) {
  const result = {};
  const fields = doc.fields || {};
  for (const key in fields) result[key] = parseValue(fields[key]);

  // Ensure id is always present (fall back to document path segment)
  if (result.id === undefined || result.id === null) {
    const parts = doc.name.split('/');
    const docId = parts[parts.length - 1];
    result.id = /^\d+$/.test(docId) ? parseInt(docId, 10) : docId;
  }
  return result;
}

// ─── Firestore Fetch ──────────────────────────────────────────────────────────

async function fetchFromFirestore(projectId) {
  // Fetch up to 300 documents in one round-trip
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/hostels?pageSize=300`;
  const res = await fetch(url, { cf: { cacheTtl: 0 } }); // bypass CF cache for this internal request

  if (!res.ok) {
    throw new Error(`Firestore REST returned ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  if (!json.documents || !Array.isArray(json.documents)) {
    throw new Error('Firestore response contained no documents array.');
  }

  const parsed = json.documents.map(parseDocument);
  // Sort by numeric id ascending (matches original ordering)
  parsed.sort((a, b) => {
    const ia = typeof a.id === 'number' ? a.id : parseInt(a.id, 10) || 9999;
    const ib = typeof b.id === 'number' ? b.id : parseInt(b.id, 10) || 9999;
    return ia - ib;
  });
  return parsed;
}

// ─── Cache Refresh ────────────────────────────────────────────────────────────

async function refreshCache(env) {
  const projectId = env.FIRESTORE_PROJECT_ID || 'dekuthostels';
  console.log('[Refresh] Fetching from Firestore…');

  let hostels;
  try {
    hostels = await fetchFromFirestore(projectId);
  } catch (err) {
    // Release lock on failure so the next request can retry sooner
    await env.HOSTELS_KV.delete('lock:hostels_refresh').catch(() => {});
    throw err;
  }

  if (!hostels.length) {
    await env.HOSTELS_KV.delete('lock:hostels_refresh').catch(() => {});
    throw new Error('Firestore returned 0 hostels — refusing to overwrite cache.');
  }

  const jitter = (Math.random() - 0.5) * 2 * JITTER_MS; // ±JITTER_MS
  const meta = {
    timestamp: Date.now(),
    count: hostels.length,
    nextTtl: SOFT_TTL_MS + jitter,
  };

  await env.HOSTELS_KV.put('hostels_data',     JSON.stringify(hostels));
  await env.HOSTELS_KV.put('hostels_meta',     JSON.stringify(meta));
  await env.HOSTELS_KV.delete('lock:hostels_refresh');

  console.log(`[Refresh] Done. ${hostels.length} hostels cached. Next refresh ~${Math.round((meta.nextTtl) / 3600000)}h.`);
  return { hostels, meta };
}

// ─── Request Handler ──────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age':       '86400',
};

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  });
}

export default {
  // ── HTTP ──────────────────────────────────────────────────────────────────
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    // ── /update-cache  (webhook — called by Firebase Function or manually) ──
    if (pathname === '/update-cache' || pathname === '/purge') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim()
                 || new URL(request.url).searchParams.get('secret')
                 || '';

      if (token !== (env.CACHE_SECRET || '')) {
        return json({ error: 'Unauthorized' }, 401);
      }

      try {
        const { meta } = await refreshCache(env);
        return json({ success: true, count: meta.count, updated_at: meta.timestamp });
      } catch (err) {
        return json({ error: err.message }, 502);
      }
    }

    // ── /hostels.json  (and common alias paths clients might request) ────────
    const hostelPaths = new Set(['/', '/hostels.json', '/shared/data/hostels.json', '/hostel/shared/data/hostels.json']);
    if (!hostelPaths.has(pathname)) {
      return json({ error: 'Not Found' }, 404);
    }

    // Read cache from KV
    const [rawData, rawMeta] = await Promise.all([
      env.HOSTELS_KV.get('hostels_data'),
      env.HOSTELS_KV.get('hostels_meta'),
    ]);

    let meta = null;
    try { if (rawMeta) meta = JSON.parse(rawMeta); } catch (_) {}

    // ── Cold start: cache is empty — load synchronously (only happens once) ──
    if (!rawData || !meta) {
      console.log('[Cache] Cold start — loading synchronously…');
      try {
        const { hostels, meta: newMeta } = await refreshCache(env);
        return new Response(JSON.stringify(hostels), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
            'X-Cache-Status': 'MISS',
            'X-Cache-Age-Seconds': '0',
            ...CORS,
          },
        });
      } catch (err) {
        return json({ error: `Cache cold start failed: ${err.message}` }, 502);
      }
    }

    // ── Stale-While-Revalidate ────────────────────────────────────────────────
    const age   = Date.now() - meta.timestamp;
    const ttl   = meta.nextTtl || SOFT_TTL_MS;
    const stale = age > ttl;

    if (stale) {
      const lock = await env.HOSTELS_KV.get('lock:hostels_refresh');
      if (!lock) {
        // Acquire distributed lock, then refresh in background
        await env.HOSTELS_KV.put('lock:hostels_refresh', '1', { expirationTtl: LOCK_TTL_SEC });
        ctx.waitUntil(
          refreshCache(env)
            .then(() => console.log('[SWR] Background refresh done.'))
            .catch(err => console.error('[SWR] Background refresh failed:', err.message))
        );
      } else {
        console.log('[SWR] Refresh already running (locked). Serving stale.');
      }
    }

    // Serve cached data immediately — always < 10 ms
    return new Response(rawData, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
        'X-Cache-Status': stale ? 'STALE' : 'HIT',
        'X-Cache-Age-Seconds': Math.round(age / 1000).toString(),
        'X-Hostel-Count': meta.count?.toString() ?? '',
        ...CORS,
      },
    });
  },

  // ── Cron — once per day to stay within Firebase free tier ─────────────────
  async scheduled(event, env, ctx) {
    console.log('[Cron] Daily cache warm-up triggered.');
    // Acquire lock then warm
    await env.HOSTELS_KV.put('lock:hostels_refresh', '1', { expirationTtl: LOCK_TTL_SEC });
    ctx.waitUntil(
      refreshCache(env)
        .then(() => console.log('[Cron] Warm-up complete.'))
        .catch(err => console.error('[Cron] Warm-up failed:', err.message))
    );
  },
};
