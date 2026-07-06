(function () {
  'use strict';

  // --- API Base Config (Handles Local Dev vs Production Vercel Calls) ---
  const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:')
    ? 'https://hostel-gray-kappa.vercel.app'
    : '';

  const API_AUTH  = `${API_BASE}/api/admin-auth`;
  const API_CACHE = `${API_BASE}/api/cache-refresh`;

  // Try to load token from sessionStorage (preserves login across browser reloads)
  let sessionToken = sessionStorage.getItem('dkut_admin_token') || null;
  let idToken = null; // Firebase ID token in memory only

  // --- Global Window Error Handler to show feedback directly on screen ---
  window.addEventListener('error', function(event) {
    const errorBox = document.getElementById('login-status') || document.getElementById('mfa-setup-status') || document.getElementById('mfa-verify-status');
    if (errorBox) {
      errorBox.hidden = false;
      errorBox.className = 'form-status error';
      errorBox.textContent = `Client Runtime Error: ${event.message}`;
    }
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  function show(id) {
    ['section-login','section-mfa-setup','section-mfa-verify','section-dashboard']
      .forEach(s => document.getElementById(s).style.display = s === id ? 'block' : 'none');
  }

  function setStatus(el, msg, type) {
    el.hidden = false;
    el.className = 'form-status ' + (type || 'info');
    el.textContent = msg;
  }

  function toast(msg, type) {
    const t = document.getElementById('dkut-toast');
    if (!t) return;
    t.className = `dkut-toast ${type} show`;
    t.textContent = msg;
    setTimeout(() => t.classList.remove('show'), 3500);
  }

  async function post(action, data) {
    const headers = { 'Content-Type': 'application/json' };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    const res = await fetch(`${API_AUTH}?action=${action}`, {
      method:  'POST',
      headers: headers,
      body:    JSON.stringify(data)
    });
    
    let body;
    try {
      body = await res.json();
    } catch (e) {
      throw new Error(`Failed to parse server response (Status ${res.status})`);
    }

    if (!res.ok) {
      throw new Error(body.error || `Server Error ${res.status}`);
    }
    return body;
  }

  // ── Session Check ─────────────────────────────────────────────────────────

  async function checkSession() {
    try {
      const headers = {};
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      const r = await fetch(`${API_AUTH}?action=verify-session`, {
        method: 'POST',
        headers: headers
      });
      const b = await r.json();
      if (b.authenticated) {
        showDashboard();
        return;
      }
    } catch (_) {}
    show('section-login');
  }

  // ── Step 1: Password Login ────────────────────────────────────────────────

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const statusEl = document.getElementById('login-status');
    statusEl.hidden = true;

    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      if (!window.DKUT?.auth) {
        throw new Error('Firebase SDK not fully initialized on your browser yet. Please wait a second and retry.');
      }
      
      setStatus(statusEl, 'Authenticating credentials...', 'info');
      const cred = await window.DKUT.auth.signInWithEmailAndPassword(email, password);
      idToken    = await cred.user.getIdToken();

      setStatus(statusEl, 'Verifying 2FA status...', 'info');
      const check = await post('check-mfa', { idToken });
      
      if (check.mfaEnabled) {
        show('section-mfa-verify');
        document.getElementById('mfa-verify-code').focus();
      } else {
        // First time setup - generate QR and Secret key
        setStatus(statusEl, 'Generating 2FA secret key...', 'info');
        const setup = await post('setup-mfa', { idToken });
        document.getElementById('mfa-qr-image').src  = setup.qrUrl;
        document.getElementById('mfa-secret-text').textContent =
          setup.secret.match(/.{1,4}/g).join(' ');
        show('section-mfa-setup');
        document.getElementById('mfa-setup-code').focus();
      }
      statusEl.hidden = true;
    } catch (err) {
      console.error(err);
      setStatus(statusEl, err.message || 'Login failed. Incorrect email or password.', 'error');
    }
  });

  // ── Step 2a: Enable 2FA (first setup) ────────────────────────────────────

  document.getElementById('btn-setup-submit').addEventListener('click', async () => {
    const statusEl = document.getElementById('mfa-setup-status');
    const code     = document.getElementById('mfa-setup-code').value.trim();
    const secret   = document.getElementById('mfa-secret-text').textContent.replace(/\s/g, '');
    
    if (!/^\d{6}$/.test(code)) {
      toast('Enter a 6-digit code', 'error');
      return;
    }
    statusEl.hidden = true;
    try {
      setStatus(statusEl, 'Verifying code and storing 2FA secret...', 'info');
      const res = await post('enable-mfa', { idToken, code, secret });
      
      if (res.token) {
        sessionToken = res.token;
        sessionStorage.setItem('dkut_admin_token', res.token);
      }
      
      toast('2FA activated — you are now signed in.', 'success');
      showDashboard();
    } catch (err) {
      setStatus(statusEl, err.message, 'error');
    }
  });

  // ── Step 2b: Verify 2FA (existing users) ─────────────────────────────────

  document.getElementById('btn-verify-submit').addEventListener('click', async () => {
    const statusEl = document.getElementById('mfa-verify-status');
    const code     = document.getElementById('mfa-verify-code').value.trim();
    
    if (!/^\d{6}$/.test(code)) {
      toast('Enter a 6-digit code', 'error');
      return;
    }
    statusEl.hidden = true;
    try {
      setStatus(statusEl, 'Verifying 2FA code...', 'info');
      const res = await post('verify-mfa', { idToken, code });
      
      if (res.token) {
        sessionToken = res.token;
        sessionStorage.setItem('dkut_admin_token', res.token);
      }
      
      toast('Authenticated.', 'success');
      showDashboard();
    } catch (err) {
      setStatus(statusEl, err.message, 'error');
    }
  });

  // Allow pressing Enter in OTP inputs
  ['mfa-setup-code','mfa-verify-code'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById(id === 'mfa-setup-code' ? 'btn-setup-submit' : 'btn-verify-submit').click();
      }
    });
  });

  // ── Dashboard ─────────────────────────────────────────────────────────────

  function showDashboard() {
    show('section-dashboard');
    refreshStats();
  }

  async function refreshStats() {
    try {
      const r = await fetch('https://dekuthostels-cache.giwme1socialtalk.workers.dev/hostels.json');
      document.getElementById('stat-age').textContent     = r.headers.get('X-Cache-Age-Seconds') ?? '—';
      document.getElementById('stat-hostels').textContent = r.headers.get('X-Hostel-Count')      ?? '—';
    } catch (_) {}
  }

  // Refresh Cache Button
  document.getElementById('btn-refresh-cache').addEventListener('click', async () => {
    const btn = document.getElementById('btn-refresh-cache');
    const box = document.getElementById('cache-status-box');
    btn.disabled = true;
    btn.classList.add('spinning');
    box.style.display = 'none';

    try {
      const headers = {};
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      const res  = await fetch(API_CACHE, { method: 'POST', headers: headers });
      const body = await res.json();
      if (res.ok && body.success) {
        box.className = 'status-box success';
        box.textContent = `✓ Cache updated — ${body.count} hostels refreshed from Firestore.`;
        box.style.display = 'block';
        toast(`Cache refreshed! ${body.count} hostels live.`, 'success');
        setTimeout(refreshStats, 800);
      } else {
        throw new Error(body.error || 'Unknown error');
      }
    } catch (err) {
      box.className = 'status-box error';
      box.textContent = `✗ ${err.message}`;
      box.style.display = 'block';
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.classList.remove('spinning');
    }
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    try {
      const headers = {};
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      await fetch(`${API_AUTH}?action=logout`, { method: 'POST', headers: headers });
      if (window.DKUT?.auth) await window.DKUT.auth.signOut();
    } catch (_) {}
    sessionStorage.removeItem('dkut_admin_token');
    sessionToken = null;
    location.reload();
  });

  // ── Theme Selector Sync ───────────────────────────────────────────────────

  function initThemeSelectors() {
    const selLogin = document.getElementById('theme-toggle-select');
    const selDash  = document.getElementById('theme-toggle-select-dash');
    
    if (window.DKUT && window.DKUT.app) {
      const activeTheme = window.DKUT.app.getTheme();
      if (selLogin) selLogin.value = activeTheme;
      if (selDash)  selDash.value  = activeTheme;
      
      const changeHandler = e => {
        window.DKUT.app.setTheme(e.target.value);
        if (selLogin) selLogin.value = e.target.value;
        if (selDash)  selDash.value  = e.target.value;
      };
      
      if (selLogin) selLogin.addEventListener('change', changeHandler);
      if (selDash)  selDash.addEventListener('change', changeHandler);

      document.addEventListener('dkut-theme-change', () => {
        const t = window.DKUT.app.getTheme();
        if (selLogin) selLogin.value = t;
        if (selDash)  selDash.value  = t;
      });
    }
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  function init() {
    initThemeSelectors();
    checkSession();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
