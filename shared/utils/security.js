/* ============================================================
   DKUT HOSTELS — SECURITY.JS
   XSS protection, rate limiting, input validation, sanitization
   ============================================================ */

(function (global) {
  'use strict';

  /* ── HTML Escape / XSS Prevention ── */
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#039;')
      .replace(/\//g, '&#x2F;');
  }

  function unescapeHtml(str) {
    const el = document.createElement('div');
    el.innerHTML = str;
    return el.textContent || el.innerText || '';
  }

  /* ── Sanitize URL (allow only safe schemes) ── */
  function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '#';
    const trimmed = url.trim();
    if (/^(javascript|data|vbscript):/i.test(trimmed)) return '#';
    return trimmed;
  }

  /* ── Sanitize text input (strip HTML, trim) ── */
  function sanitizeInput(val, maxLength = 500) {
    if (val == null) return '';
    return String(val)
      .replace(/<[^>]*>/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .trim()
      .slice(0, maxLength);
  }

  /* ── Validation Helpers ── */
  function isValidEmail(email) {
    if (!email) return false;
    const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    return re.test(String(email).toLowerCase());
  }

  function isValidPhone(phone) {
    if (!phone) return false;
    // Accept formats: 07xx, +2547xx, 2547xx, 01xx
    const cleaned = String(phone).replace(/[\s\-().]/g, '');
    return /^(\+254|254|0)[17]\d{8}$/.test(cleaned) ||
           /^(\+254|254|0)[0-9]{9,10}$/.test(cleaned);
  }

  function normalizePhone(phone) {
    if (!phone) return '';
    const cleaned = String(phone).replace(/[\s\-().]/g, '');
    if (cleaned.startsWith('+254')) return cleaned.slice(1);       // remove +
    if (cleaned.startsWith('0'))   return '254' + cleaned.slice(1);
    if (cleaned.startsWith('254')) return cleaned;
    return cleaned;
  }

  function isValidName(name, { min = 2, max = 100 } = {}) {
    if (!name) return false;
    const n = String(name).trim();
    return n.length >= min && n.length <= max && /^[a-zA-Z\s'\-\.]+$/.test(n);
  }

  /* ── Password Strength ── */
  function getPasswordStrength(pw) {
    if (!pw) return { score: 0, label: 'none', color: 'transparent' };
    let score = 0;
    if (pw.length >= 8)  score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    const map = [
      { score: 0, label: 'Too short',  color: '#ef4444' },
      { score: 1, label: 'Weak',       color: '#f97316' },
      { score: 2, label: 'Fair',       color: '#f59e0b' },
      { score: 3, label: 'Good',       color: '#3b82f6' },
      { score: 4, label: 'Strong',     color: '#0d9948' },
      { score: 5, label: 'Very Strong',color: '#059669' },
    ];
    return map[Math.min(score, map.length - 1)];
  }

  /* ── Rate Limiter ── */
  function createRateLimiter({ maxRequests = 5, windowMs = 60000, key = 'default' } = {}) {
    const storageKey = `dkut_rl_${key}`;

    return {
      check() {
        try {
          const now = Date.now();
          const raw = sessionStorage.getItem(storageKey);
          const data = raw ? JSON.parse(raw) : { count: 0, reset: now + windowMs };

          if (now > data.reset) {
            data.count = 0;
            data.reset = now + windowMs;
          }

          if (data.count >= maxRequests) {
            const wait = Math.ceil((data.reset - now) / 1000);
            return { allowed: false, retryAfter: wait };
          }

          data.count++;
          sessionStorage.setItem(storageKey, JSON.stringify(data));
          return { allowed: true, remaining: maxRequests - data.count };
        } catch {
          return { allowed: true };
        }
      },
      reset() {
        try { sessionStorage.removeItem(storageKey); } catch {}
      }
    };
  }

  /* ── CSRF Token (for form submissions) ── */
  function getCsrfToken() {
    const key = 'dkut_csrf';
    let token = sessionStorage.getItem(key);
    if (!token) {
      token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      sessionStorage.setItem(key, token);
    }
    return token;
  }

  /* ── Cookie helpers (read-only on client) ── */
  function getCookie(name) {
    const cookies = document.cookie.split(';');
    for (const c of cookies) {
      const [k, v] = c.trim().split('=');
      if (k === name) return decodeURIComponent(v || '');
    }
    return null;
  }

  /* ── Content Security Policy nonce getter ── */
  function getNonce() {
    const meta = document.querySelector('meta[name="csp-nonce"]');
    return meta ? meta.content : '';
  }

  /* ── Expose ── */
  global.DKUT = global.DKUT || {};
  global.DKUT.security = {
    escapeHtml,
    unescapeHtml,
    sanitizeUrl,
    sanitizeInput,
    isValidEmail,
    isValidPhone,
    normalizePhone,
    isValidName,
    getPasswordStrength,
    createRateLimiter,
    getCsrfToken,
    getCookie,
    getNonce,
  };

})(window);
