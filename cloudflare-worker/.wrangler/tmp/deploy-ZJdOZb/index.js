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
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};
function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS, ...extra }
  });
}
__name(json, "json");
var index_default = {
  // ── HTTP ──────────────────────────────────────────────────────────────────
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
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
              "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
              "X-Cache-Status": "MISS",
              "X-Cache-Age-Seconds": "0",
              ...CORS
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
          "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
          "X-Cache-Status": stale ? "STALE" : "HIT",
          "X-Cache-Age-Seconds": Math.round(age / 1e3).toString(),
          "X-Hostel-Count": meta.count?.toString() ?? "",
          ...CORS
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
              "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
              "X-Cache-Status": "MISS",
              "X-Cache-Age-Seconds": "0",
              ...CORS
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
          "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
          "X-Cache-Status": stale ? "STALE" : "HIT",
          "X-Cache-Age-Seconds": Math.round(age / 1e3).toString(),
          "X-Service-Count": meta.count?.toString() ?? "",
          ...CORS
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
