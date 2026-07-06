const crypto = require('crypto');
const https = require('https');

// --- Helper Configuration ---
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyBy2E0rFGh0quXssZSiQVofwE2C-f5Mt2w';
const PROJECT_ID = process.env.FIRESTORE_PROJECT_ID || 'dekuthostels';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dkut_admin_session_secret_hash_2026';
const ADMIN_UIDS = ['uTyGBYW6l2e8qjASLxuvBxoLyZZ2'];

// --- Base32 TOTP Helpers ---
function base32Decode(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let clean = base32.replace(/=+$/, '').toUpperCase();
  let length = clean.length;
  let bits = 0;
  let value = 0;
  let index = 0;
  const buffer = Buffer.alloc(Math.floor((length * 5) / 8));

  for (let i = 0; i < length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      buffer[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return buffer;
}

function generateSecret(length = 16) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    secret += alphabet[randomBytes[i] % 32];
  }
  return secret;
}

function getTOTPCode(secret, timeMs = Date.now()) {
  const key = base32Decode(secret);
  const counter = Math.floor(timeMs / 30000);
  const counterBuffer = Buffer.alloc(8);
  let tmp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBuffer[i] = tmp & 0xff;
    tmp = tmp >> 8;
  }

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) |
               ((hmac[offset + 1] & 0xff) << 16) |
               ((hmac[offset + 2] & 0xff) << 8) |
               (hmac[offset + 3] & 0xff);

  return (code % 1000000).toString().padStart(6, '0');
}

function verifyTOTP(secret, code, window = 1) {
  const now = Date.now();
  for (let i = -window; i <= window; i++) {
    if (getTOTPCode(secret, now + i * 30000) === code) return true;
  }
  return false;
}

// --- JWT Signed Session Helpers ---
function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(`${header}.${body}`).digest('base64url');
  if (signature !== expectedSignature) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch (_) { return null; }
}

// --- HTTP Request Proxy Helper ---
function makeRequest(urlStr, method, headers, body = null) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(urlStr);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: method,
        headers: headers
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

// --- Firestore Document Helpers ---
async function getAdminDoc(uid, idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/admins/${uid}`;
  const res = await makeRequest(url, 'GET', { 'Authorization': `Bearer ${idToken}` });
  if (res.status === 200) {
    const doc = JSON.parse(res.body);
    const fields = doc.fields || {};
    return {
      exists: true,
      mfaEnabled: fields.mfaEnabled ? fields.mfaEnabled.booleanValue : false,
      totpSecret: fields.totpSecret ? fields.totpSecret.stringValue : null
    };
  }
  return { exists: false, mfaEnabled: false, totpSecret: null };
}

async function saveAdminDoc(uid, idToken, mfaEnabled, totpSecret) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/admins/${uid}`;
  const body = JSON.stringify({
    fields: {
      mfaEnabled: { booleanValue: mfaEnabled },
      totpSecret: { stringValue: totpSecret }
    }
  });
  const res = await makeRequest(url, 'PATCH', {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  }, body);
  return res.status === 200;
}

// --- Main Handler ---
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');

  // Parse action from query
  const { action } = req.query;

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { idToken, code, secret } = req.body || {};

    // 1. Action: verify-session
    if (action === 'verify-session') {
      const cookieHeader = req.headers.cookie || '';
      const match = cookieHeader.match(/dkut_admin_session=([^;]+)/);
      let token = match ? match[1] : null;

      // Authorization header fallback
      if (!token && req.headers.authorization) {
        token = req.headers.authorization.replace(/^Bearer\s+/i, '').trim();
      }

      if (!token) return res.status(401).json({ authenticated: false });
      const payload = verifyToken(token);
      if (!payload) return res.status(401).json({ authenticated: false });
      return res.status(200).json({ authenticated: true, uid: payload.uid });
    }

    // 2. Action: logout
    if (action === 'logout') {
      res.setHeader('Set-Cookie', 'dkut_admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
      return res.status(200).json({ success: true });
    }

    // All other actions require a valid Firebase ID Token from the client
    if (!idToken) {
      return res.status(400).json({ error: 'Missing Firebase ID Token' });
    }

    // Verify Firebase ID Token via Google Identity REST API
    const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`;
    const authRes = await makeRequest(authUrl, 'POST', { 'Content-Type': 'application/json' }, JSON.stringify({ idToken }));
    if (authRes.status !== 200) {
      return res.status(401).json({ error: 'Invalid Firebase credentials' });
    }

    const authData = JSON.parse(authRes.body);
    const user = authData.users && authData.users[0];
    if (!user) return res.status(401).json({ error: 'User not found in Firebase' });

    const uid = user.localId;
    const email = user.email;

    // Check if user is in authorized ADMIN_UIDS list (if list is not empty)
    if (ADMIN_UIDS.length > 0 && !ADMIN_UIDS.includes(uid)) {
      return res.status(403).json({ error: 'Access denied: not an authorized admin UID' });
    }

    // Retrieve Admin Doc from Firestore
    const adminDoc = await getAdminDoc(uid, idToken);

    // 3. Action: check-mfa (Bypassed: directly log in user and set session token)
    if (action === 'check-mfa') {
      const sessionToken = signToken({ uid, exp: Date.now() + 4 * 60 * 60 * 1000 }); // 4 hours
      res.setHeader('Set-Cookie', `dkut_admin_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=14400`);
      return res.status(200).json({
        uid,
        email,
        mfaEnabled: false,
        token: sessionToken,
        bypassed: true
      });
    }

    // 4. Action: setup-mfa (Get secret & QR Code URL)
    if (action === 'setup-mfa') {
      if (adminDoc.mfaEnabled) {
        return res.status(400).json({ error: 'MFA is already enabled' });
      }
      const newSecret = generateSecret();
      const encodedEmail = encodeURIComponent(email);
      const otpauthUrl = `otpauth://totp/DKUT%20Hostels:${encodedEmail}?secret=${newSecret}&issuer=DKUT%20Hostels`;
      const qrUrl = `https://chart.googleapis.com/chart?chs=200x200&chld=M|0&cht=qr&chl=${encodeURIComponent(otpauthUrl)}`;

      return res.status(200).json({
        secret: newSecret,
        qrUrl
      });
    }

    // 5. Action: enable-mfa (Verify initial code and save to Firestore)
    if (action === 'enable-mfa') {
      if (!code || !secret) {
        return res.status(400).json({ error: 'Missing code or secret' });
      }
      const verified = verifyTOTP(secret, code);
      if (!verified) {
        return res.status(400).json({ error: 'Invalid 2FA verification code' });
      }
      // Save secret and enable MFA in Firestore
      const saved = await saveAdminDoc(uid, idToken, true, secret);
      if (!saved) {
        return res.status(500).json({ error: 'Failed to save MFA credentials' });
      }

      // Generate session token
      const sessionToken = signToken({ uid, exp: Date.now() + 4 * 60 * 60 * 1000 }); // 4 hours
      res.setHeader('Set-Cookie', `dkut_admin_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=14400`);
      return res.status(200).json({ success: true, token: sessionToken, message: 'MFA enabled successfully' });
    }

    // 6. Action: verify-mfa (Verify login code)
    if (action === 'verify-mfa') {
      if (!code) return res.status(400).json({ error: 'Missing 2FA code' });
      if (!adminDoc.mfaEnabled || !adminDoc.totpSecret) {
        return res.status(400).json({ error: 'MFA not configured for this account' });
      }

      const verified = verifyTOTP(adminDoc.totpSecret, code);
      if (!verified) {
        return res.status(401).json({ error: 'Invalid 2FA verification code' });
      }

      // Generate session token
      const sessionToken = signToken({ uid, exp: Date.now() + 4 * 60 * 60 * 1000 }); // 4 hours
      res.setHeader('Set-Cookie', `dkut_admin_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=14400`);
      return res.status(200).json({ success: true, token: sessionToken });
    }

    return res.status(400).json({ error: 'Invalid action parameter' });

  } catch (err) {
    console.error('[Admin Auth API Error]:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};
