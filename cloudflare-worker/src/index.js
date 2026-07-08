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

async function fetchFromFirestore(projectId, idToken) {
  // Fetch up to 300 documents in one round-trip
  // Use the admin Firebase ID Token as Bearer to authenticate Firestore REST reads
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/hostels?pageSize=300`;
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  const res = await fetch(url, { method: 'GET', headers, cf: { cacheTtl: 0 } });

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

async function refreshCache(env, idToken) {
  const projectId = env.FIRESTORE_PROJECT_ID || 'dekuthostels';
  console.log('[Refresh] Fetching from Firestore…');

  let hostels;
  try {
    hostels = await fetchFromFirestore(projectId, idToken);
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

// ─── Services Cache Refresh ───────────────────────────────────────────────────

async function fetchServicesFromFirestore(projectId, idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/services?pageSize=300`;
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  const res = await fetch(url, { method: 'GET', headers, cf: { cacheTtl: 0 } });

  if (!res.ok) {
    throw new Error(`Firestore REST returned ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  if (!json.documents || !Array.isArray(json.documents)) {
    return [];
  }

  const parsed = json.documents.map(parseDocument);
  parsed.sort((a, b) => (a.order || 99) - (b.order || 99));
  return parsed;
}

async function refreshServicesCache(env, idToken) {
  const projectId = env.FIRESTORE_PROJECT_ID || 'dekuthostels';
  console.log('[Refresh Services] Fetching from Firestore…');

  let services;
  try {
    services = await fetchServicesFromFirestore(projectId, idToken);
  } catch (err) {
    await env.HOSTELS_KV.delete('lock:services_refresh').catch(() => {});
    throw err;
  }

  const jitter = (Math.random() - 0.5) * 2 * JITTER_MS; // ±JITTER_MS
  const meta = {
    timestamp: Date.now(),
    count: services.length,
    nextTtl: SOFT_TTL_MS + jitter,
  };

  await env.HOSTELS_KV.put('services_data',     JSON.stringify(services));
  await env.HOSTELS_KV.put('services_meta',     JSON.stringify(meta));
  await env.HOSTELS_KV.delete('lock:services_refresh');

  console.log(`[Refresh Services] Done. ${services.length} services cached.`);
  return { services, meta };
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

    // ── /update-cache  (webhook — force refresh both caches) ──────────────────
    if (pathname === '/update-cache' || pathname === '/purge') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim()
                 || new URL(request.url).searchParams.get('secret')
                 || '';

      if (token !== (env.CACHE_SECRET || '')) {
        return json({ error: 'Unauthorized' }, 401);
      }

      // Extract forwarded admin Firebase ID token (sent by Vercel api/cache-refresh.js)
      const idToken = request.headers.get('X-Firebase-Id-Token') || '';

      try {
        const [ { meta: hMeta }, { meta: sMeta } ] = await Promise.all([
          refreshCache(env, idToken),
          refreshServicesCache(env, idToken)
        ]);
        return json({
          success: true,
          hostels_count: hMeta.count,
          services_count: sMeta.count,
          updated_at: Date.now()
        });
      } catch (err) {
        return json({ error: err.message }, 502);
      }
    }

    // Paths lists
    const hostelPaths = new Set(['/', '/hostels.json', '/shared/data/hostels.json', '/hostel/shared/data/hostels.json']);
    const servicePaths = new Set(['/services.json', '/shared/data/services.json', '/hostel/shared/data/services.json']);

    // ── /hostels.json ────────────────────────────────────────────────────────
    if (hostelPaths.has(pathname)) {
      // Read cache from KV
      const [rawData, rawMeta] = await Promise.all([
        env.HOSTELS_KV.get('hostels_data'),
        env.HOSTELS_KV.get('hostels_meta'),
      ]);

      let meta = null;
      try { if (rawMeta) meta = JSON.parse(rawMeta); } catch (_) {}

      // Cold start: cache is empty
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

      // Stale-While-Revalidate
      const age   = Date.now() - meta.timestamp;
      const ttl   = meta.nextTtl || SOFT_TTL_MS;
      const stale = age > ttl;

      if (stale) {
        const lock = await env.HOSTELS_KV.get('lock:hostels_refresh');
        if (!lock) {
          await env.HOSTELS_KV.put('lock:hostels_refresh', '1', { expirationTtl: LOCK_TTL_SEC });
          ctx.waitUntil(
            refreshCache(env)
              .then(() => console.log('[SWR] Background refresh done.'))
              .catch(err => console.error('[SWR] Background refresh failed:', err.message))
          );
        }
      }

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
    }

    // ── /services.json ────────────────────────────────────────────────────────
    if (servicePaths.has(pathname)) {
      // Read cache from KV
      const [rawData, rawMeta] = await Promise.all([
        env.HOSTELS_KV.get('services_data'),
        env.HOSTELS_KV.get('services_meta'),
      ]);

      let meta = null;
      try { if (rawMeta) meta = JSON.parse(rawMeta); } catch (_) {}

      // Cold start: cache is empty
      if (!rawData || !meta) {
        console.log('[Cache Services] Cold start — loading synchronously…');
        try {
          const { services, meta: newMeta } = await refreshServicesCache(env);
          return new Response(JSON.stringify(services), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
              'X-Cache-Status': 'MISS',
              'X-Cache-Age-Seconds': '0',
              ...CORS,
            },
          });
        } catch (err) {
          return json({ error: `Cache services cold start failed: ${err.message}` }, 502);
        }
      }

      // Stale-While-Revalidate
      const age   = Date.now() - meta.timestamp;
      const ttl   = meta.nextTtl || SOFT_TTL_MS;
      const stale = age > ttl;

      if (stale) {
        const lock = await env.HOSTELS_KV.get('lock:services_refresh');
        if (!lock) {
          await env.HOSTELS_KV.put('lock:services_refresh', '1', { expirationTtl: LOCK_TTL_SEC });
          ctx.waitUntil(
            refreshServicesCache(env)
              .then(() => console.log('[SWR Services] Background refresh done.'))
              .catch(err => console.error('[SWR Services] Background refresh failed:', err.message))
          );
        }
      }

      return new Response(rawData, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
          'X-Cache-Status': stale ? 'STALE' : 'HIT',
          'X-Cache-Age-Seconds': Math.round(age / 1000).toString(),
          'X-Service-Count': meta.count?.toString() ?? '',
          ...CORS,
        },
      });
    }

    return json({ error: 'Not Found' }, 404);
  },

  // ── Cron — daily warm up ──────────────────────────────────────────────────
  async scheduled(event, env, ctx) {
    console.log('[Cron] Daily cache warm-up triggered.');
    await env.HOSTELS_KV.put('lock:hostels_refresh', '1', { expirationTtl: LOCK_TTL_SEC });
    await env.HOSTELS_KV.put('lock:services_refresh', '1', { expirationTtl: LOCK_TTL_SEC });
    ctx.waitUntil(
      Promise.all([
        refreshCache(env),
        refreshServicesCache(env)
      ])
        .then(() => console.log('[Cron] Warm-up complete.'))
        .catch(err => console.error('[Cron] Warm-up failed:', err.message))
    );
  },
};
