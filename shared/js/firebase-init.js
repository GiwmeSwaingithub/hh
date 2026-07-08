/* ============================================================
   DKUT HOSTELS — FIREBASE-INIT.JS
   Firebase initialization and Firestore/Auth setup
   ============================================================ */

(function (global) {
  'use strict';

  function initFirebase() {
    const cfg = global.DKUT && global.DKUT.CONFIG && global.DKUT.CONFIG.FIREBASE;
    if (!cfg) {
      console.warn('[DKUT] Firebase config not found. Ensure config.js is loaded first.');
      return;
    }
    if (typeof firebase === 'undefined') {
      console.warn('[DKUT] Firebase SDK not loaded.');
      return;
    }

    // Prevent double-init
    if (firebase.apps && firebase.apps.length > 0) {
      global.DKUT.firebaseApp  = firebase.apps[0];
    } else {
      global.DKUT.firebaseApp  = firebase.initializeApp(cfg);
    }

    global.DKUT.auth = typeof firebase.auth === 'function' ? firebase.auth() : null;
    
    if (typeof firebase.firestore === 'function') {
      global.DKUT.db   = firebase.firestore();

      // Firestore settings
      global.DKUT.db.settings({
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
      });

      global.DKUT.db.enablePersistence({ synchronizeTabs: true })
        .catch(err => {
          if (err.code === 'failed-precondition') {
            console.warn('[DKUT] Multiple tabs open — offline persistence disabled.');
          } else if (err.code === 'unimplemented') {
            console.warn('[DKUT] Browser does not support offline persistence.');
          }
        });
    } else {
      global.DKUT.db = null;
      console.log('[DKUT] Firestore SDK not loaded (omitted for pages that do not query database).');
    }

    console.log('[DKUT] Firebase initialized.');
  }

  // Run on script load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFirebase);
  } else {
    initFirebase();
  }

})(window);
