(function () {
  'use strict';

  function show(msg, type) {
    const el = document.getElementById('signup-status');
    if (!el) return;
    el.hidden = false;
    el.className = 'form-status ' + type;
    el.textContent = msg;
  }

  function init() {
    document.getElementById('signup-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      if (!DKUT.auth) { show('Auth service unavailable.', 'error'); return; }
      const name = document.getElementById('signup-name').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      if (password.length < 8) { show('Password must be at least 8 characters.', 'error'); return; }
      try {
        const cred = await DKUT.auth.createUserWithEmailAndPassword(email, password);
        if (cred.user && name) await cred.user.updateProfile({ displayName: name });
        location.href = '../../pages/home/';
      } catch (err) {
        show(err.message || 'Sign up failed.', 'error');
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
