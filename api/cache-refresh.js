const https = require('https');

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyBy2E0rFGh0quXssZSiQVofwE2C-f5Mt2w';
const CACHE_SECRET     = process.env.CACHE_SECRET     || 'dkut_cache_secret_J9xP2mQvRnW7sT4';
const CACHE_WORKER_URL = 'https://dekuthostels-cache.giwme1socialtalk.workers.dev/update-cache';
const ADMIN_UIDS       = ['uTyGBYW6l2e8qjASLxuvBxoLyZZ2'];

// ── Verify Firebase ID Token via Google Identity REST ────────────────────────
function verifyFirebaseToken(idToken) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ idToken });
    const req = https.request({
      hostname: 'identitytoolkit.googleapis.com',
      path: `/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) return resolve(null);
        try {
          const parsed = JSON.parse(data);
          resolve((parsed.users && parsed.users[0]) || null);
        } catch (_) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.write(body);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // Extract Firebase ID Token from Authorization: Bearer <token>
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!idToken) return res.status(401).json({ error: 'Missing Authorization token' });

  // Verify the Firebase ID Token
  const user = await verifyFirebaseToken(idToken);
  if (!user) return res.status(401).json({ error: 'Invalid or expired Firebase token' });

  // Only authorized admin UIDs may trigger a cache refresh
  if (ADMIN_UIDS.length > 0 && !ADMIN_UIDS.includes(user.localId)) {
    return res.status(403).json({ error: 'Access denied: not an authorized admin' });
  }

  // Proxy to Cloudflare Worker — CACHE_SECRET never leaves the server
  try {
    const result = await new Promise((resolve, reject) => {
      const r = https.request(CACHE_WORKER_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${CACHE_SECRET}` }
      }, (response) => {
        let body = '';
        response.on('data', c => body += c);
        response.on('end', () => resolve({ status: response.statusCode, body }));
      });
      r.setTimeout(15000, () => { r.destroy(); reject(new Error('Cloudflare Worker timed out')); });
      r.on('error', reject);
      r.end();
    });

    let data;
    try {
      data = JSON.parse(result.body);
    } catch (parseErr) {
      return res.status(502).json({
        error: `Cloudflare Worker returned non-JSON response (Status ${result.status}): ${result.body.substring(0, 150) || 'Empty'}`
      });
    }

    if (data && data.success) {
      if (data.count === undefined && data.hostels_count !== undefined) {
        data.count = data.hostels_count;
      }
    }
    return res.status(result.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
};
