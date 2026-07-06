const https = require('https');
const crypto = require('crypto');

// Dedicated cache secret stored as Cloudflare Worker secret.
// Also hardcoded here (server-side only — never sent to browser).
const CACHE_SECRET = process.env.CACHE_SECRET || 'dkut_cache_secret_J9xP2mQvRnW7sT4';
const CACHE_WORKER_URL = 'https://dekuthostels-cache.giwme1socialtalk.workers.dev/update-cache';
const SESSION_SECRET = process.env.SESSION_SECRET;

function verifyToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  if (SESSION_SECRET) {
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expected) return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch (_) { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // Require a valid admin session cookie
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/dkut_admin_session=([^;]+)/);
  if (!match) return res.status(401).json({ error: 'Unauthorized' });
  const session = verifyToken(match[1]);
  if (!session) return res.status(401).json({ error: 'Session expired' });

  // Proxy to Cloudflare Worker — CACHE_SECRET never touches the browser
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
      r.setTimeout(10000, () => { r.destroy(); reject(new Error('Cloudflare Worker timed out')); });
      r.on('error', reject);
      r.end();
    });

    const data = JSON.parse(result.body);
    return res.status(result.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
};
