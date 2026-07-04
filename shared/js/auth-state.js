(function (global) {
  'use strict';

  let _currentUser = null;
  const BASE = (global.DKUT && global.DKUT.CONFIG && global.DKUT.CONFIG.BASE) || '/hostel/';

  function updateAuthUI(user) {
    _currentUser = user;
    document.dispatchEvent(new CustomEvent('dkut-auth-change', { detail: { user }, bubbles: true }));
  }

  function signOut() {
    if (!global.DKUT || !global.DKUT.auth) return;
    global.DKUT.auth.signOut().then(() => {
      if (global.DKUT.helpers && global.DKUT.helpers.showToast) {
        global.DKUT.helpers.showToast('Signed out successfully.', 'info');
      }
    });
  }

  function getCurrentUser() { return _currentUser; }

  function init() {
    if (!global.DKUT || !global.DKUT.auth) return;
    global.DKUT.auth.onAuthStateChanged(updateAuthUI);
    document.addEventListener('click', e => {
      if (e.target.closest('#sign-out-btn')) signOut();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.DKUT = global.DKUT || {};
  global.DKUT.authState = { getCurrentUser, signOut };
})(window);
