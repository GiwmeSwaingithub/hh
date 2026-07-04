(function () {
  'use strict';

  function show(msg, type) {
    const el = document.getElementById('login-status');
    if (!el) return;
    el.hidden = false;
    el.className = 'form-status ' + type;
    el.textContent = msg;
  }

  function init() {
    document.getElementById('login-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      if (!DKUT.auth) { show('Auth service unavailable.', 'error'); return; }
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      try {
        await DKUT.auth.signInWithEmailAndPassword(email, password);
        const next = new URLSearchParams(location.search).get('next') || '../../pages/home/';
        location.href = next;
      } catch (err) {
        show(err.message || 'Sign in failed.', 'error');
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
