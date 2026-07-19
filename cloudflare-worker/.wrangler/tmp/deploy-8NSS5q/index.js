var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var SOFT_TTL_MS = 24 * 60 * 60 * 1e3;
var JITTER_MS = 30 * 60 * 1e3;
var LOCK_TTL_SEC = 90;
function parseValue(field) {
  if (!field) return null;
  if ("stringValue" in field) return field.stringValue;
  if ("integerValue" in field) return parseInt(field.integerValue, 10);
  if ("doubleValue" in field) return parseFloat(field.doubleValue);
  if ("booleanValue" in field) return field.booleanValue;
  if ("nullValue" in field) return null;
  if ("mapValue" in field) {
    const result = {};
    const fields = field.mapValue.fields || {};
    for (const key in fields) result[key] = parseValue(fields[key]);
    return result;
  }
  if ("arrayValue" in field) {
    return (field.arrayValue.values || []).map(parseValue);
  }
  return void 0;
}
__name(parseValue, "parseValue");
function parseDocument(doc) {
  const result = {};
  const fields = doc.fields || {};
  for (const key in fields) result[key] = parseValue(fields[key]);
  if (result.id === void 0 || result.id === null) {
    const parts = doc.name.split("/");
    const docId = parts[parts.length - 1];
    result.id = /^\d+$/.test(docId) ? parseInt(docId, 10) : docId;
  }
  return result;
}
__name(parseDocument, "parseDocument");
async function fetchFromFirestore(projectId, idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/hostels?pageSize=300`;
  const headers = { "Content-Type": "application/json" };
  if (idToken) headers["Authorization"] = `Bearer ${idToken}`;
  const res = await fetch(url, { method: "GET", headers, cf: { cacheTtl: 0 } });
  if (!res.ok) {
    throw new Error(`Firestore REST returned ${res.status}: ${await res.text()}`);
  }
  const json2 = await res.json();
  if (!json2.documents || !Array.isArray(json2.documents)) {
    throw new Error("Firestore response contained no documents array.");
  }
  const parsed = json2.documents.map(parseDocument);
  parsed.sort((a, b) => {
    const ia = typeof a.id === "number" ? a.id : parseInt(a.id, 10) || 9999;
    const ib = typeof b.id === "number" ? b.id : parseInt(b.id, 10) || 9999;
    return ia - ib;
  });
  return parsed;
}
__name(fetchFromFirestore, "fetchFromFirestore");
async function refreshCache(env, idToken) {
  const projectId = env.FIRESTORE_PROJECT_ID || "dekuthostels";
  console.log("[Refresh] Fetching from Firestore\u2026");
  let hostels;
  try {
    hostels = await fetchFromFirestore(projectId, idToken);
  } catch (err) {
    await env.HOSTELS_KV.delete("lock:hostels_refresh").catch(() => {
    });
    throw err;
  }
  if (!hostels.length) {
    await env.HOSTELS_KV.delete("lock:hostels_refresh").catch(() => {
    });
    throw new Error("Firestore returned 0 hostels \u2014 refusing to overwrite cache.");
  }
  const jitter = (Math.random() - 0.5) * 2 * JITTER_MS;
  const meta = {
    timestamp: Date.now(),
    count: hostels.length,
    nextTtl: SOFT_TTL_MS + jitter
  };
  await env.HOSTELS_KV.put("hostels_data", JSON.stringify(hostels));
  await env.HOSTELS_KV.put("hostels_meta", JSON.stringify(meta));
  await env.HOSTELS_KV.delete("lock:hostels_refresh");
  console.log(`[Refresh] Done. ${hostels.length} hostels cached. Next refresh ~${Math.round(meta.nextTtl / 36e5)}h.`);
  return { hostels, meta };
}
__name(refreshCache, "refreshCache");
async function fetchServicesFromFirestore(projectId, idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/services?pageSize=300`;
  const headers = { "Content-Type": "application/json" };
  if (idToken) headers["Authorization"] = `Bearer ${idToken}`;
  const res = await fetch(url, { method: "GET", headers, cf: { cacheTtl: 0 } });
  if (!res.ok) {
    throw new Error(`Firestore REST returned ${res.status}: ${await res.text()}`);
  }
  const json2 = await res.json();
  if (!json2.documents || !Array.isArray(json2.documents)) {
    return [];
  }
  const parsed = json2.documents.map(parseDocument);
  parsed.sort((a, b) => (a.order || 99) - (b.order || 99));
  return parsed;
}
__name(fetchServicesFromFirestore, "fetchServicesFromFirestore");
async function refreshServicesCache(env, idToken) {
  const projectId = env.FIRESTORE_PROJECT_ID || "dekuthostels";
  console.log("[Refresh Services] Fetching from Firestore\u2026");
  let services;
  try {
    services = await fetchServicesFromFirestore(projectId, idToken);
  } catch (err) {
    await env.HOSTELS_KV.delete("lock:services_refresh").catch(() => {
    });
    throw err;
  }
  if (!services || services.length === 0) {
    const existing = await env.HOSTELS_KV.get("services_data");
    if (existing) {
      console.log("[Refresh Services] Firestore returned 0 services \u2014 preserving existing KV cache.");
      await env.HOSTELS_KV.delete("lock:services_refresh").catch(() => {
      });
      const existingServices = JSON.parse(existing);
      return { services: existingServices, meta: { timestamp: Date.now(), count: existingServices.length } };
    }
  }
  const jitter = (Math.random() - 0.5) * 2 * JITTER_MS;
  const meta = {
    timestamp: Date.now(),
    count: services.length,
    nextTtl: SOFT_TTL_MS + jitter
  };
  await env.HOSTELS_KV.put("services_data", JSON.stringify(services));
  await env.HOSTELS_KV.put("services_meta", JSON.stringify(meta));
  await env.HOSTELS_KV.delete("lock:services_refresh");
  console.log(`[Refresh Services] Done. ${services.length} services cached.`);
  return { services, meta };
}
__name(refreshServicesCache, "refreshServicesCache");
var ALLOWED_ORIGINS = [
  "https://hostel.dekut.site",
  "https://dekut.site",
  "https://www.dekut.site",
  "http://api.listing.dekut.site",
  "https://api.listing.dekut.site",
  "http://localhost:3000",
  "http://localhost:5000",
  "http://localhost:8080",
  "http://127.0.0.1:5500"
];
function getCorsHeaders(request) {
  const origin = (request.headers.get("Origin") || "").toLowerCase();
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".dekut.site") || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
  const allowedOrigin = isAllowed ? origin : "https://hostel.dekut.site";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Firebase-Id-Token",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
__name(getCorsHeaders, "getCorsHeaders");
function json(body, status = 200, extra = {}, request = null) {
  const cors = request ? getCorsHeaders(request) : {
    "Access-Control-Allow-Origin": "https://hostel.dekut.site",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Firebase-Id-Token",
    "Vary": "Origin"
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors, ...extra }
  });
}
__name(json, "json");
function isAuthorizedClientRequest(request) {
  const secFetchMode = (request.headers.get("Sec-Fetch-Mode") || "").toLowerCase();
  const secFetchDest = (request.headers.get("Sec-Fetch-Dest") || "").toLowerCase();
  const acceptHeader = (request.headers.get("Accept") || "").toLowerCase();
  if (secFetchMode === "navigate" || secFetchDest === "document" || acceptHeader.includes("text/html") && !request.headers.has("X-DKUT-Client")) {
    return false;
  }
  const { pathname } = new URL(request.url);
  if (pathname === "/update-cache" || pathname === "/purge") {
    return true;
  }
  const origin = (request.headers.get("Origin") || "").toLowerCase();
  const referer = (request.headers.get("Referer") || "").toLowerCase();
  const clientHeader = request.headers.get("X-DKUT-Client") || "";
  const ua = (request.headers.get("User-Agent") || "").toLowerCase();
  if (clientHeader === "dkut-web-app" || ua.includes("node-fetch") || ua.includes("axios") || ua.includes("vercel") || request.headers.has("Authorization")) {
    return true;
  }
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".dekut.site") || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))) {
    return true;
  }
  if (referer && (referer.includes("dekut.site") || referer.includes("localhost:"))) {
    return true;
  }
  return false;
}
__name(isAuthorizedClientRequest, "isAuthorizedClientRequest");
var index_default = {
  // ── HTTP ──────────────────────────────────────────────────────────────────
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const corsHeaders = getCorsHeaders(request);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (!isAuthorizedClientRequest(request)) {
      return new Response(JSON.stringify({
        error: "Access Denied",
        message: "Direct link access to api.listing.dekut.site is prohibited. Requests must originate from https://hostel.dekut.site"
      }), {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          ...corsHeaders
        }
      });
    }
    if (pathname === "/update-cache" || pathname === "/purge") {
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim() || new URL(request.url).searchParams.get("secret") || "";
      if (token !== (env.CACHE_SECRET || "")) {
        return json({ error: "Unauthorized" }, 401);
      }
      const idToken = request.headers.get("X-Firebase-Id-Token") || "";
      try {
        const [{ meta: hMeta }, { meta: sMeta }] = await Promise.all([
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
    const hostelPaths = /* @__PURE__ */ new Set(["/", "/hostels.json", "/shared/data/hostels.json", "/hostel/shared/data/hostels.json"]);
    const servicePaths = /* @__PURE__ */ new Set(["/services.json", "/shared/data/services.json", "/hostel/shared/data/services.json"]);
    if (hostelPaths.has(pathname)) {
      const [rawData, rawMeta] = await Promise.all([
        env.HOSTELS_KV.get("hostels_data"),
        env.HOSTELS_KV.get("hostels_meta")
      ]);
      let meta = null;
      try {
        if (rawMeta) meta = JSON.parse(rawMeta);
      } catch (_) {
      }
      if (!rawData || !meta) {
        console.log("[Cache] Cold start \u2014 loading synchronously\u2026");
        try {
          const { hostels, meta: newMeta } = await refreshCache(env);
          return new Response(JSON.stringify(hostels), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
              "X-Cache-Status": "MISS",
              "X-Cache-Age-Seconds": "0",
              "X-Cache-Timestamp": (newMeta ? newMeta.timestamp : Date.now()).toString(),
              "ETag": '"' + (newMeta ? newMeta.timestamp : Date.now()) + '"',
              ...corsHeaders
            }
          });
        } catch (err) {
          return json({ error: `Cache cold start failed: ${err.message}` }, 502);
        }
      }
      const age = Date.now() - meta.timestamp;
      const ttl = meta.nextTtl || SOFT_TTL_MS;
      const stale = age > ttl;
      if (stale) {
        const lock = await env.HOSTELS_KV.get("lock:hostels_refresh");
        if (!lock) {
          await env.HOSTELS_KV.put("lock:hostels_refresh", "1", { expirationTtl: LOCK_TTL_SEC });
          ctx.waitUntil(
            refreshCache(env).then(() => console.log("[SWR] Background refresh done.")).catch((err) => console.error("[SWR] Background refresh failed:", err.message))
          );
        }
      }
      return new Response(rawData, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
          "X-Cache-Status": stale ? "STALE" : "HIT",
          "X-Cache-Age-Seconds": Math.round(age / 1e3).toString(),
          "X-Cache-Timestamp": meta?.timestamp ? meta.timestamp.toString() : Date.now().toString(),
          "ETag": '"' + (meta?.timestamp || Date.now()) + '"',
          "X-Hostel-Count": meta?.count?.toString() ?? "",
          ...corsHeaders
        }
      });
    }
    if (servicePaths.has(pathname)) {
      const [rawData, rawMeta] = await Promise.all([
        env.HOSTELS_KV.get("services_data"),
        env.HOSTELS_KV.get("services_meta")
      ]);
      let meta = null;
      try {
        if (rawMeta) meta = JSON.parse(rawMeta);
      } catch (_) {
      }
      if (!rawData || !meta) {
        console.log("[Cache Services] Cold start \u2014 loading synchronously\u2026");
        try {
          const { services, meta: newMeta } = await refreshServicesCache(env);
          return new Response(JSON.stringify(services), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
              "X-Cache-Status": "MISS",
              "X-Cache-Age-Seconds": "0",
              "X-Cache-Timestamp": (newMeta ? newMeta.timestamp : Date.now()).toString(),
              "ETag": '"' + (newMeta ? newMeta.timestamp : Date.now()) + '"',
              ...corsHeaders
            }
          });
        } catch (err) {
          return json({ error: `Cache services cold start failed: ${err.message}` }, 502);
        }
      }
      const age = Date.now() - meta.timestamp;
      const ttl = meta.nextTtl || SOFT_TTL_MS;
      const stale = age > ttl;
      if (stale) {
        const lock = await env.HOSTELS_KV.get("lock:services_refresh");
        if (!lock) {
          await env.HOSTELS_KV.put("lock:services_refresh", "1", { expirationTtl: LOCK_TTL_SEC });
          ctx.waitUntil(
            refreshServicesCache(env).then(() => console.log("[SWR Services] Background refresh done.")).catch((err) => console.error("[SWR Services] Background refresh failed:", err.message))
          );
        }
      }
      return new Response(rawData, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
          "X-Cache-Status": stale ? "STALE" : "HIT",
          "X-Cache-Age-Seconds": Math.round(age / 1e3).toString(),
          "X-Cache-Timestamp": meta?.timestamp ? meta.timestamp.toString() : Date.now().toString(),
          "ETag": '"' + (meta?.timestamp || Date.now()) + '"',
          "X-Service-Count": meta?.count?.toString() ?? "",
          ...corsHeaders
        }
      });
    }
    return json({ error: "Not Found" }, 404);
  },
  // ── Cron — daily warm up ──────────────────────────────────────────────────
  async scheduled(event, env, ctx) {
    console.log("[Cron] Daily cache warm-up triggered.");
    await env.HOSTELS_KV.put("lock:hostels_refresh", "1", { expirationTtl: LOCK_TTL_SEC });
    await env.HOSTELS_KV.put("lock:services_refresh", "1", { expirationTtl: LOCK_TTL_SEC });
    ctx.waitUntil(
      Promise.all([
        refreshCache(env),
        refreshServicesCache(env)
      ]).then(() => console.log("[Cron] Warm-up complete.")).catch((err) => console.error("[Cron] Warm-up failed:", err.message))
    );
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
