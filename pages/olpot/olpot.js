/* ============================================================
   DKUT Admin Console — olpot.js  (v5)
   Fixes:
   - stuck spinner (via 3.5s timeout on check-mfa fetch)
   - firestore path (uses cloudflare/sync)
   - api paths (getApiBase() base URL helper for local/production)
   - enroll mfa click handler
   ============================================================ */
(function () {
  'use strict';

  var FIREBASE_CONFIG = {
    apiKey:            'AIzaSyBy2E0rFGh0quXssZSiQVofwE2C-f5Mt2w',
    authDomain:        'dekuthostels.firebaseapp.com',
    projectId:         'dekuthostels',
    storageBucket:     'dekuthostels.firebasestorage.app',
    messagingSenderId: '984307401520',
    appId:             '1:984307401520:web:ac69f3b466d9030ce0fef5'
  };

  var CF_STATS_URL    = 'https://dekuthostels-cache.giwme1socialtalk.workers.dev/hostels.json';
  var ADMIN_AUTH_PATH = '/api/admin-auth';

  /* ─── State ─── */
  var auth        = null;
  var db          = null;
  var currentUser = null;
  var mfaSecret   = null;
  var authResolved = false;

  /* ─── Hostel Manager State ─── */
  var hostelsList = [];
  var selectedHostel = null;
  var isAddingNew = false;
  var activeTab = 'visual';

  /* ─── Sections ─── */
  var SECTIONS = ['section-loading', 'section-login', 'section-forgot', 'section-mfa-challenge', 'section-dashboard'];

  function show(id) {
    console.log('[DKUT] show section:', id);
    SECTIONS.forEach(function (s) {
      var el = document.getElementById(s);
      if (el) el.style.display = (s === id) ? '' : 'none';
    });
  }

  /* ─── API Base Helper ─── */
  function getApiBase() {
    return (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      ? 'https://hostel-gray-kappa.vercel.app' : '';
  }

  /* ─── Status / Message helpers ─── */
  function setStatus(elId, msg, type) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.hidden = false; el.style.display = '';
    el.className = 'form-status ' + (type || 'info');
    el.textContent = msg;
  }
  function clearStatus(elId) {
    var el = document.getElementById(elId);
    if (el) { el.hidden = true; el.textContent = ''; }
  }
  function setMsg(elId, msg, type) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.className = 'settings-msg ' + (type || 'info');
    el.textContent = msg;
  }
  function clearMsg(elId) {
    var el = document.getElementById(elId);
    if (el) { el.className = 'settings-msg'; el.textContent = ''; }
  }
  function toast(msg, type) {
    var t = document.getElementById('dkut-toast');
    if (!t) return;
    t.className = 'dkut-toast ' + (type || 'info') + ' show';
    t.textContent = msg;
    setTimeout(function () { t.classList.remove('show'); }, 3500);
  }

  /* ─── Firebase init ─── */
  function initFirebase() {
    console.log('[DKUT] initFirebase…');
    if (typeof firebase === 'undefined') {
      show('section-login');
      setStatus('login-status', 'Firebase SDK failed to load. Check your internet.', 'error');
      return false;
    }
    try {
      var app = (firebase.apps && firebase.apps.length > 0)
        ? firebase.apps[0]
        : firebase.initializeApp(FIREBASE_CONFIG);
      auth = app.auth();
      db = app.firestore();
      console.log('[DKUT] Firebase Auth and Firestore initialized.');
      return true;
    } catch (e) {
      console.error('[DKUT] Firebase init error:', e);
      show('section-login');
      setStatus('login-status', 'Firebase init error: ' + e.message, 'error');
      return false;
    }
  }

  /* ─── Auth state listener ─── */
  function watchAuth() {
    if (!auth) return;
    console.log('[DKUT] watchAuth registered.');
    auth.onAuthStateChanged(function (user) {
      try {
        console.log('[DKUT] onAuthStateChanged user:', user ? user.email : 'null');
        authResolved = true;
        currentUser = user;
        if (user) {
          // Check if MFA challenge is active on this account (with 3.5s timeout)
          var mfaCheckPromise = user.getIdToken(false)
            .then(function (idToken) {
              return fetch(getApiBase() + ADMIN_AUTH_PATH + '?action=check-mfa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: idToken })
              });
            })
            .then(function (r) { return r.json(); });

          var timeoutPromise = new Promise(function (_, reject) {
            setTimeout(function () { reject(new Error('MFA check timeout')); }, 3500);
          });

          Promise.race([mfaCheckPromise, timeoutPromise])
            .then(function (data) {
              if (data && data.mfaEnabled) {
                console.log('[DKUT] MFA challenge required.');
                show('section-mfa-challenge');
              } else {
                console.log('[DKUT] No MFA challenge required, going to dashboard.');
                showDashboard(user);
              }
            })
            .catch(function (err) {
              console.warn('[DKUT] check-mfa failed or timed out, falling back to dashboard:', err);
              showDashboard(user);
            });
        } else {
          show('section-login');
        }
      } catch (e) {
        console.error('[DKUT] auth changed callback error:', e);
        show('section-login');
      }
    });
  }

  /* ─── Login ─── */
  function handleLogin(e) {
    e.preventDefault();
    if (!auth) { setStatus('login-status', 'Firebase not ready.', 'error'); return; }
    var email    = (document.getElementById('login-email').value || '').trim();
    var password = document.getElementById('login-password').value || '';
    if (!email || !password) { setStatus('login-status', 'Please enter both email and password.', 'error'); return; }

    var btn = document.getElementById('btn-login-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }
    setStatus('login-status', 'Signing in, please wait…', 'info');

    auth.signInWithEmailAndPassword(email, password)
      .then(function () {
        clearStatus('login-status');
        toast('Welcome back!', 'success');
        if (btn) { btn.disabled = false; btn.textContent = 'Continue'; }
      })
      .catch(function (err) {
        setStatus('login-status', friendlyAuthError(err.code, err.message), 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Continue'; }
      });
  }

  /* ─── Forgot password ─── */
  function handleForgotForm(e) {
    e.preventDefault();
    if (!auth) return;
    var email = (document.getElementById('forgot-email').value || '').trim();
    if (!email) { setStatus('forgot-status', 'Please enter your email.', 'error'); return; }

    var btn = document.getElementById('btn-forgot-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    setStatus('forgot-status', 'Sending…', 'info');

    auth.sendPasswordResetEmail(email)
      .then(function () {
        setStatus('forgot-status', 'Reset link sent! Check your inbox.', 'success');
        if (btn) { btn.disabled = false; btn.textContent = 'Send Reset Link'; }
      })
      .catch(function (err) {
        setStatus('forgot-status', friendlyAuthError(err.code, err.message), 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Send Reset Link'; }
      });
  }

  /* ─── MFA Login Challenge Verification ─── */
  function handleMfaChallenge(e) {
    e.preventDefault();
    if (!currentUser) return;
    var codeEl = document.getElementById('mfa-login-code');
    var code   = codeEl ? (codeEl.value || '').replace(/\s/g,'') : '';
    if (code.length !== 6 || !/^\d+$/.test(code)) {
      setStatus('mfa-login-status', 'Enter a 6-digit numeric code.', 'error');
      return;
    }

    var btn = document.getElementById('btn-mfa-verify-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Verifying…'; }
    setStatus('mfa-login-status', 'Verifying…', 'info');

    currentUser.getIdToken(false)
      .then(function (idToken) {
        return fetch(getApiBase() + ADMIN_AUTH_PATH + '?action=verify-mfa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: idToken, code: code })
        });
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        clearStatus('mfa-login-status');
        toast('Code verified successfully!', 'success');
        showDashboard(currentUser);
      })
      .catch(function (err) {
        setStatus('mfa-login-status', err.message, 'error');
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = 'Verify & Continue'; }
      });
  }

  /* ─── Error map ─── */
  function friendlyAuthError(code, fallback) {
    var map = {
      'auth/user-not-found':         'No account found with that email.',
      'auth/wrong-password':         'Incorrect password. Please try again.',
      'auth/invalid-email':          'Please enter a valid email address.',
      'auth/invalid-credential':     'Invalid email or password.',
      'auth/too-many-requests':      'Too many attempts. Please wait and try again.',
      'auth/network-request-failed': 'Network error. Check your internet connection.',
      'auth/email-already-in-use':   'An account already exists with this email.',
      'auth/weak-password':          'Password must be at least 6 characters.',
      'auth/user-disabled':          'This account has been disabled.',
      'auth/requires-recent-login':  'Please sign out and sign back in, then try again.',
      'auth/unauthorized-domain':    'This domain is not authorised. Contact the admin.',
      'auth/operation-not-allowed':  'This sign-in method is not enabled.'
    };
    return map[code] || fallback || ('Auth error: ' + code);
  }

  /* ─── Dashboard ─── */
  function showDashboard(user) {
    show('section-dashboard');
    var emailEl = document.getElementById('dash-user-email');
    if (emailEl) emailEl.textContent = user.email;
    var uidEl = document.getElementById('dash-user-uid');
    if (uidEl) uidEl.textContent = user.uid;
    refreshStats();
    checkMfaStatus();
    initHostelManager();
  }

  /* ─── Hostel Manager ─── */
  var HOSTEL_TEMPLATE = {
    "id": 0,
    "name": "New Hostel Name",
    "location": {
      "gate": "Gate A",
      "coordinates": {
        "latitude": -0.397,
        "longitude": 36.960
      }
    },
    "description": "Short description of the new hostel.",
    "contact": {
      "phone": [
        "0700000000"
      ],
      "whatsapp": "0700000000"
    },
    "availability": {
      "vacancies": true,
      "lastUpdated": ""
    },
    "rooms": [
      {
        "id": "single",
        "name": "Single Room",
        "occupancy": {
          "minimumPeople": 1,
          "maximumPeople": 1
        },
        "price": {
          "amountAlone": 7500,
          "amountSharing": 5000,
          "currency": "KES",
          "period": "month"
        },
        "deposit": {
          "required": true,
          "amount": 7500,
          "refundable": true
        },
        "available": true
      }
    ],
    "utilities": {
      "water": {
        "type": "included",
        "description": "Water included in rent"
      },
      "electricity": {
        "type": "meter",
        "description": "Electricity tokens paid by tenant"
      },
      "wifi": {
        "type": "included",
        "description": "Free WiFi"
      },
      "garbageCollection": {
        "type": "included",
        "amount": 0,
        "period": "month"
      },
      "hotShower": {
        "available": true,
        "included": true
      },
      "bed": {
        "included": true,
        "mattressIncluded": false
      },
      "laundry": {
        "available": true,
        "selfService": true
      },
      "parking": {
        "available": false
      }
    },
    "fees": {
      "agreementFee": {
        "required": false,
        "amount": 0
      }
    },
    "media": {
      "coverImage": "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
      "gallery": [
        {
          "category": "Rooms",
          "images": []
        }
      ],
      "videos": []
    },
    "security": {
      "fingerprintAccess": false,
      "cctv": true,
      "securityGuard": true,
      "fenced": true
    },
    "accessibility": {
      "wheelchairAccessible": false
    },
    "rules": {
      "gateClosingTime": "10:00 PM",
      "visitors": {
        "allowed": true,
        "allowedUntil": "8:00 PM"
      },
      "sleepovers": {
        "allowed": false
      },
      "parties": {
        "allowed": false
      },
      "alcohol": {
        "allowed": false
      },
      "smoking": {
        "allowed": false
      },
      "pets": {
        "allowed": false
      },
      "quietHours": {
        "start": "10:00 PM",
        "end": "6:00 AM"
      },
      "noticeBeforeVacating": {
        "required": true,
        "duration": 30,
        "unit": "days"
      },
      "cleanliness": {
        "tenantResponsible": true
      }
    }
  };

  function initHostelManager() {
    var modeBadge = document.getElementById('hostel-mode-badge');
    var mock = false;
    try {
      mock = (window.DKUT && window.DKUT.app && window.DKUT.app.isMockMode && window.DKUT.app.isMockMode());
    } catch (e) {
      console.warn('[DKUT] failed to check mock mode:', e);
    }
    if (modeBadge) {
      modeBadge.textContent = mock ? 'Mock Mode (Local Storage)' : 'Live Mode (Firestore)';
      modeBadge.style.background = mock ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)';
      modeBadge.style.color = mock ? '#fcd34d' : '#6ee7b7';
    }

    loadHostelsList();
  }

  function loadHostelsList() {
    var select = document.getElementById('hostel-select');
    if (select) {
      select.innerHTML = '<option value="">Choose a hostel to edit...</option>';
    }
    setHostelEditorMsg('Loading hostels...', 'info');

    try {
      if (window.DKUT && window.DKUT.app && window.DKUT.app.fetchHostels) {
        window.DKUT.app.fetchHostels()
          .then(function (list) {
            hostelsList = list || [];
            populateHostelDropdown();
            clearHostelEditorMsg();
          })
          .catch(function (err) {
            setHostelEditorMsg('Failed to load hostels: ' + err.message, 'error');
          });
      } else {
        setHostelEditorMsg('Hostel fetch helper not found.', 'error');
      }
    } catch (err) {
      setHostelEditorMsg('Failed to initiate hostel load: ' + err.message, 'error');
    }
  }

  function populateHostelDropdown() {
    var select = document.getElementById('hostel-select');
    if (!select) return;
    select.innerHTML = '<option value="">Choose a hostel to edit...</option>';
    hostelsList.forEach(function (h) {
      var opt = document.createElement('option');
      opt.value = h.id;
      opt.textContent = (h.name || 'Unnamed') + ' (ID: ' + h.id + ')';
      select.appendChild(opt);
    });
  }

  function syncJsonToVisual(jsonObj) {
    if (!jsonObj) return;
    
    document.getElementById('hostel-name').value = jsonObj.name || '';
    document.getElementById('hostel-gate').value = (jsonObj.location && jsonObj.location.gate) || 'Gate A';
    document.getElementById('hostel-lat').value = (jsonObj.location && jsonObj.location.coordinates && jsonObj.location.coordinates.latitude) || '';
    document.getElementById('hostel-lng').value = (jsonObj.location && jsonObj.location.coordinates && jsonObj.location.coordinates.longitude) || '';
    document.getElementById('hostel-desc').value = jsonObj.description || '';
    
    var phoneStr = '';
    if (jsonObj.contact && Array.isArray(jsonObj.contact.phone)) {
      phoneStr = jsonObj.contact.phone.join(', ');
    }
    document.getElementById('hostel-phones').value = phoneStr;
    document.getElementById('hostel-whatsapp').value = (jsonObj.contact && jsonObj.contact.whatsapp) || '';
    document.getElementById('hostel-cover').value = (jsonObj.media && jsonObj.media.coverImage) || '';
    
    document.getElementById('hostel-vacancies').checked = !!(jsonObj.availability && jsonObj.availability.vacancies);
    document.getElementById('hostel-wheelchair').checked = !!(jsonObj.accessibility && jsonObj.accessibility.wheelchairAccessible);
    
    document.getElementById('hostel-cctv').checked = !!(jsonObj.security && jsonObj.security.cctv);
    document.getElementById('hostel-guard').checked = !!(jsonObj.security && jsonObj.security.securityGuard);
    document.getElementById('hostel-fenced').checked = !!(jsonObj.security && jsonObj.security.fenced);
    document.getElementById('hostel-fingerprint').checked = !!(jsonObj.security && jsonObj.security.fingerprintAccess);
  }

  function syncVisualToJson() {
    var rawText = document.getElementById('hostel-json').value;
    var jsonObj = {};
    try {
      jsonObj = JSON.parse(rawText);
    } catch (e) {
      return;
    }

    jsonObj.name = document.getElementById('hostel-name').value;
    
    if (!jsonObj.location) jsonObj.location = {};
    jsonObj.location.gate = document.getElementById('hostel-gate').value;
    
    if (!jsonObj.location.coordinates) jsonObj.location.coordinates = {};
    jsonObj.location.coordinates.latitude = parseFloat(document.getElementById('hostel-lat').value) || 0;
    jsonObj.location.coordinates.longitude = parseFloat(document.getElementById('hostel-lng').value) || 0;
    
    jsonObj.description = document.getElementById('hostel-desc').value;
    
    if (!jsonObj.contact) jsonObj.contact = {};
    var phones = document.getElementById('hostel-phones').value.split(',');
    jsonObj.contact.phone = phones.map(function(p) { return p.trim(); }).filter(Boolean);
    jsonObj.contact.whatsapp = document.getElementById('hostel-whatsapp').value;
    
    if (!jsonObj.media) jsonObj.media = {};
    jsonObj.media.coverImage = document.getElementById('hostel-cover').value;
    
    if (!jsonObj.availability) jsonObj.availability = {};
    jsonObj.availability.vacancies = document.getElementById('hostel-vacancies').checked;
    
    if (!jsonObj.accessibility) jsonObj.accessibility = {};
    jsonObj.accessibility.wheelchairAccessible = document.getElementById('hostel-wheelchair').checked;
    
    if (!jsonObj.security) jsonObj.security = {};
    jsonObj.security.cctv = document.getElementById('hostel-cctv').checked;
    jsonObj.security.securityGuard = document.getElementById('hostel-guard').checked;
    jsonObj.security.fenced = document.getElementById('hostel-fenced').checked;
    jsonObj.security.fingerprintAccess = document.getElementById('hostel-fingerprint').checked;

    document.getElementById('hostel-json').value = JSON.stringify(jsonObj, null, 2);
  }

  function handleJsonTextareaChange() {
    var rawText = document.getElementById('hostel-json').value;
    var saveBtn = document.getElementById('btn-save-hostel');
    try {
      var parsed = JSON.parse(rawText);
      syncJsonToVisual(parsed);
      clearHostelEditorMsg();
      if (saveBtn) saveBtn.disabled = false;
    } catch (e) {
      setHostelEditorMsg('Invalid JSON syntax: ' + e.message, 'error');
      if (saveBtn) saveBtn.disabled = true;
    }
  }

  function handleHostelSelection() {
    try {
      var select = document.getElementById('hostel-select');
      var panel = document.getElementById('hostel-editor-panel');
      var hostelId = select.value;
      
      if (!hostelId) {
        if (panel) panel.style.display = 'none';
        selectedHostel = null;
        isAddingNew = false;
        return;
      }
      
      var hostel = hostelsList.find(function (h) { return String(h.id) === String(hostelId); });
      if (!hostel) return;
      
      selectedHostel = JSON.parse(JSON.stringify(hostel));
      isAddingNew = false;
      
      document.getElementById('editor-title').textContent = 'Edit Hostel';
      document.getElementById('hostel-id-indicator').textContent = 'ID: ' + selectedHostel.id;
      
      document.getElementById('hostel-json').value = JSON.stringify(selectedHostel, null, 2);
      syncJsonToVisual(selectedHostel);
      clearHostelEditorMsg();
      switchHostelTab('visual');
      
      if (panel) panel.style.display = 'block';
    } catch (err) {
      console.error('[DKUT] Error selecting hostel:', err);
      setHostelEditorMsg('Error loading selected hostel: ' + err.message, 'error');
    }
  }

  function handleAddHostelTrigger() {
    try {
      var select = document.getElementById('hostel-select');
      if (select) select.value = '';
      
      var panel = document.getElementById('hostel-editor-panel');
      isAddingNew = true;
      
      var maxId = 0;
      if (Array.isArray(hostelsList)) {
        hostelsList.forEach(function (h) {
          var idNum = parseInt(h.id, 10);
          if (!isNaN(idNum) && idNum > maxId) maxId = idNum;
        });
      }
      var nextId = maxId + 1;
      
      selectedHostel = JSON.parse(JSON.stringify(HOSTEL_TEMPLATE));
      selectedHostel.id = nextId;
      
      document.getElementById('editor-title').textContent = 'Add New Hostel';
      document.getElementById('hostel-id-indicator').textContent = 'ID: ' + nextId;
      
      document.getElementById('hostel-json').value = JSON.stringify(selectedHostel, null, 2);
      syncJsonToVisual(selectedHostel);
      clearHostelEditorMsg();
      switchHostelTab('visual');
      
      if (panel) panel.style.display = 'block';
    } catch (err) {
      console.error('[DKUT] Error triggering add hostel:', err);
      setHostelEditorMsg('Error initializing new hostel: ' + err.message, 'error');
    }
  }

  function switchHostelTab(tab) {
    try {
      activeTab = tab;
      var visualBtn = document.getElementById('tab-visual');
      var jsonBtn = document.getElementById('tab-json');
      var visualSec = document.getElementById('editor-visual-section');
      var jsonSec = document.getElementById('editor-json-section');
      
      if (tab === 'visual') {
        if (visualBtn) {
          visualBtn.style.color = '#fff';
          visualBtn.style.borderBottomColor = 'var(--accent)';
        }
        if (jsonBtn) {
          jsonBtn.style.color = 'rgba(255,255,255,0.5)';
          jsonBtn.style.borderBottomColor = 'transparent';
        }
        if (visualSec) visualSec.style.display = 'block';
        if (jsonSec) jsonSec.style.display = 'none';
        
        handleJsonTextareaChange();
      } else {
        if (visualBtn) {
          visualBtn.style.color = 'rgba(255,255,255,0.5)';
          visualBtn.style.borderBottomColor = 'transparent';
        }
        if (jsonBtn) {
          jsonBtn.style.color = '#fff';
          jsonBtn.style.borderBottomColor = 'var(--accent)';
        }
        if (visualSec) visualSec.style.display = 'none';
        if (jsonSec) jsonSec.style.display = 'block';
        
        syncVisualToJson();
      }
    } catch (err) {
      console.error('[DKUT] Error switching tab:', err);
    }
  }

  function handleFormatJson() {
    var rawText = document.getElementById('hostel-json').value;
    try {
      var parsed = JSON.parse(rawText);
      document.getElementById('hostel-json').value = JSON.stringify(parsed, null, 2);
      clearHostelEditorMsg();
    } catch (e) {
      setHostelEditorMsg('Cannot format. Invalid JSON syntax: ' + e.message, 'error');
    }
  }

  function handleSaveHostel() {
    try {
      var saveBtn = document.getElementById('btn-save-hostel');
      
      if (activeTab === 'visual') {
        syncVisualToJson();
      }
      
      var rawText = document.getElementById('hostel-json').value;
      var hostelData = null;
      try {
        hostelData = JSON.parse(rawText);
      } catch (e) {
        setHostelEditorMsg('Invalid JSON. Fix syntax errors before saving.', 'error');
        return;
      }
      
      if (!hostelData.id) {
        setHostelEditorMsg('Hostel must have a valid unique ID.', 'error');
        return;
      }
      if (!hostelData.name || !hostelData.name.trim()) {
        setHostelEditorMsg('Hostel must have a valid name.', 'error');
        return;
      }
      
      var todayStr = new Date().toISOString().split('T')[0];
      if (!hostelData.availability) hostelData.availability = {};
      hostelData.availability.lastUpdated = todayStr;
      
      document.getElementById('hostel-json').value = JSON.stringify(hostelData, null, 2);
      
      if (saveBtn) saveBtn.disabled = true;
      setHostelEditorMsg('Saving hostel data...', 'info');
      
      var mock = (window.DKUT && window.DKUT.app && window.DKUT.app.isMockMode && window.DKUT.app.isMockMode());
      if (mock) {
        try {
          var cacheKey = (window.DKUT.CONFIG && window.DKUT.CONFIG.SETTINGS && window.DKUT.CONFIG.SETTINGS.mockCacheKey) || 'dkut_hostels_mock_cache';
          var cfCacheKey = (window.DKUT.CONFIG && window.DKUT.CONFIG.SETTINGS && window.DKUT.CONFIG.SETTINGS.cacheKey) || 'dkut_hostels_cf_cache';
          
          var idx = hostelsList.findIndex(function (h) { return String(h.id) === String(hostelData.id); });
          if (idx >= 0) {
            hostelsList[idx] = hostelData;
          } else {
            hostelsList.push(hostelData);
          }
          
          var payload = { ts: Date.now(), data: hostelsList };
          localStorage.setItem(cacheKey, JSON.stringify(payload));
          localStorage.setItem(cfCacheKey, JSON.stringify(payload));
          
          setHostelEditorMsg('Hostel saved locally in mock mode!', 'success');
          toast('Hostel saved locally.', 'success');
          
          loadHostelsList();
          
          setTimeout(function() {
            var panel = document.getElementById('hostel-editor-panel');
            if (panel) panel.style.display = 'none';
            var select = document.getElementById('hostel-select');
            if (select) select.value = '';
          }, 1500);
        } catch (err) {
          setHostelEditorMsg('Failed to save to localStorage: ' + err.message, 'error');
        } finally {
          if (saveBtn) saveBtn.disabled = false;
        }
      } else {
        if (db) {
          db.collection('hostels').doc(String(hostelData.id)).set(hostelData)
            .then(function () {
              setHostelEditorMsg('Hostel saved successfully! Please refresh Cloudflare Cache to apply updates.', 'success');
              toast('Hostel saved to database.', 'success');
              
              loadHostelsList();
              
              var refreshBtn = document.getElementById('btn-refresh-cache');
              if (refreshBtn) {
                refreshBtn.style.boxShadow = '0 0 15px rgba(99,102,241,0.8)';
                setTimeout(function () { refreshBtn.style.boxShadow = ''; }, 5000);
              }
              
              setTimeout(function() {
                var panel = document.getElementById('hostel-editor-panel');
                if (panel) panel.style.display = 'none';
                var select = document.getElementById('hostel-select');
                if (select) select.value = '';
              }, 2000);
            })
            .catch(function (err) {
              setHostelEditorMsg('Firebase save failed: ' + err.message, 'error');
            })
            .finally(function () {
              if (saveBtn) saveBtn.disabled = false;
            });
        } else {
          setHostelEditorMsg('Firestore is not ready.', 'error');
          if (saveBtn) saveBtn.disabled = false;
        }
      }
    } catch (err) {
      console.error('[DKUT] Error saving hostel:', err);
      setHostelEditorMsg('Error saving hostel: ' + err.message, 'error');
    }
  }

  function handleCancelHostel() {
    var panel = document.getElementById('hostel-editor-panel');
    if (panel) panel.style.display = 'none';
    var select = document.getElementById('hostel-select');
    if (select) select.value = '';
    selectedHostel = null;
    isAddingNew = false;
    clearHostelEditorMsg();
  }

  function setHostelEditorMsg(msg, type) {
    var el = document.getElementById('hostel-editor-msg');
    if (!el) return;
    el.className = 'settings-msg ' + (type || 'info');
    el.textContent = msg;
    el.style.display = 'block';
  }

  function clearHostelEditorMsg() {
    var el = document.getElementById('hostel-editor-msg');
    if (el) {
      el.className = 'settings-msg';
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  /* ─── Fallback stats fetch (if Firestore document doesn't exist yet) ─── */
  function fallbackStatsFetch(countEl, ageEl) {
    fetch(CF_STATS_URL)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var list  = Array.isArray(data) ? data
                  : (Array.isArray(data.hostels) ? data.hostels : null);
        var count = list ? list.length
                  : (typeof data.count === 'number' ? data.count : '?');

        var ageMin = 'live';
        if (list && list.length > 0) {
          var newest = 0;
          list.forEach(function (h) {
            var ts = h.availability && h.availability.lastUpdated;
            if (ts) {
              var t = new Date(ts).getTime();
              if (t > newest) newest = t;
            }
          });
          if (newest > 0) {
            var diffMin = Math.floor((Date.now() - newest) / 60000);
            ageMin = diffMin < 2 ? 'just now' : diffMin + ' min ago';
          }
        } else {
          var ts = data.updatedAt || data.lastUpdated || data.timestamp;
          if (ts) {
            var diffMin = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
            ageMin = diffMin < 2 ? 'just now' : diffMin + ' min ago';
          }
        }

        if (countEl) countEl.textContent = count;
        if (ageEl)   ageEl.textContent   = ageMin;
      })
      .catch(function (err) {
        console.error('[DKUT] Fallback stats fetch error:', err);
        if (countEl) countEl.textContent = 'err';
        if (ageEl)   ageEl.textContent   = 'err';
      });
  }

  /* ─── Stats: Reads cloudflare sync path from Firestore ─── */
  function refreshStats() {
    var countEl = document.getElementById('stat-hostels');
    var ageEl   = document.getElementById('stat-age');
    if (countEl) countEl.textContent = '\u2026';
    if (ageEl)   ageEl.textContent   = '\u2026';

    if (db) {
      // Prioritize cloudflare/sync path in Firestore
      db.collection('cloudflare').doc('sync').get()
        .then(function (doc) {
          if (doc.exists) {
            var data = doc.data();
            var count = data.count || 0;
            var lastSync = data.lastSync || 0;
            var diffMin = Math.floor((Date.now() - lastSync) / 60000);
            
            var ageMin = 'just now';
            if (diffMin >= 2 && diffMin < 60) {
              ageMin = diffMin + ' min ago';
            } else if (diffMin >= 60 && diffMin < 1440) {
              ageMin = Math.floor(diffMin / 60) + ' hrs ago';
            } else if (diffMin >= 1440) {
              ageMin = Math.floor(diffMin / 1440) + ' days ago';
            }

            if (countEl) countEl.textContent = count;
            if (ageEl)   ageEl.textContent   = ageMin;
            console.log('[DKUT] Loaded sync stats from cloudflare/sync:', count, ageMin);
          } else {
            // Check secondary path sync/cloudflare
            return db.collection('sync').doc('cloudflare').get().then(function (doc2) {
              if (doc2.exists) {
                var data = doc2.data();
                var count = data.count || 0;
                var lastSync = data.lastSync || 0;
                var diffMin = Math.floor((Date.now() - lastSync) / 60000);
                
                var ageMin = 'just now';
                if (diffMin >= 2 && diffMin < 60) {
                  ageMin = diffMin + ' min ago';
                } else if (diffMin >= 60 && diffMin < 1440) {
                  ageMin = Math.floor(diffMin / 60) + ' hrs ago';
                } else if (diffMin >= 1440) {
                  ageMin = Math.floor(diffMin / 1440) + ' days ago';
                }

                if (countEl) countEl.textContent = count;
                if (ageEl)   ageEl.textContent   = ageMin;
                console.log('[DKUT] Loaded sync stats from sync/cloudflare:', count, ageMin);
              } else {
                console.log('[DKUT] Sync docs not found, falling back to JSON.');
                fallbackStatsFetch(countEl, ageEl);
              }
            });
          }
        })
        .catch(function (err) {
          console.error('[DKUT] Firestore stats read error:', err);
          fallbackStatsFetch(countEl, ageEl);
        });
    } else {
      fallbackStatsFetch(countEl, ageEl);
    }
  }

  /* ─── Cache refresh ─── */
  function handleCacheRefresh() {
    var btn = document.getElementById('btn-refresh-cache');
    var box = document.getElementById('cache-status-box');
    if (btn) { btn.disabled = true; btn.classList.add('spinning'); }
    if (box) { box.style.display = 'none'; }

    if (!currentUser) {
      showCacheBox(box, 'error', 'Not logged in.');
      if (btn) { btn.disabled = false; btn.classList.remove('spinning'); }
      return;
    }

    currentUser.getIdToken(true)
      .then(function (idToken) {
        return fetch(getApiBase() + '/api/cache-refresh', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + idToken }
        });
      })
      .then(function (res) {
        return res.json().then(function (body) { return { ok: res.ok, body: body }; });
      })
      .then(function (r) {
        if (r.ok && r.body.success) {
          showCacheBox(box, 'success', 'Cache updated \u2014 ' + r.body.count + ' hostels refreshed from Firestore.');
          toast('Cache refreshed! ' + r.body.count + ' hostels live.', 'success');

          // Register sync metadata to cloudflare/sync AND sync/cloudflare
          if (db) {
            console.log('[DKUT] Registering cloudflare sync metadata in Firestore…');
            var batch = db.batch();
            var ref1 = db.collection('cloudflare').doc('sync');
            var ref2 = db.collection('sync').doc('cloudflare');
            batch.set(ref1, { lastSync: Date.now(), count: r.body.count }, { merge: true });
            batch.set(ref2, { lastSync: Date.now(), count: r.body.count }, { merge: true });
            batch.commit()
              .then(function () {
                console.log('[DKUT] Registered cloudflare sync documents successfully.');
                refreshStats();
              })
              .catch(function (err) {
                console.error('[DKUT] Error registering cloudflare sync:', err);
                refreshStats();
              });
          } else {
            refreshStats();
          }
        } else {
          throw new Error(r.body.error || 'Unknown error from server.');
        }
      })
      .catch(function (err) {
        showCacheBox(box, 'error', err.message);
        toast(err.message, 'error');
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.classList.remove('spinning'); }
      });
  }

  function showCacheBox(box, type, msg) {
    if (!box) return;
    box.className     = 'status-box ' + type;
    box.textContent   = (type === 'success' ? '\u2713 ' : '\u2717 ') + msg;
    box.style.display = 'block';
  }

  /* ─── MFA status check ─── */
  function checkMfaStatus() {
    if (!currentUser) return;
    currentUser.getIdToken(false)
      .then(function (idToken) {
        return fetch(getApiBase() + ADMIN_AUTH_PATH + '?action=check-mfa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: idToken })
        });
      })
      .then(function (r) { return r.json(); })
      .then(function (data) { updateMfaUI(data.mfaEnabled === true); })
      .catch(function () { updateMfaUI(false); });
  }

  function updateMfaUI(enabled) {
    var warningBar = document.getElementById('mfa-warning-bar');
    var chip       = document.getElementById('mfa-status-chip');
    var setupBtn   = document.getElementById('btn-setup-mfa');
    var disableBtn = document.getElementById('btn-disable-mfa');

    if (warningBar) warningBar.style.display = enabled ? 'none' : 'flex';
    if (chip) {
      chip.className   = 'mfa-status-chip ' + (enabled ? 'enabled' : 'disabled');
      chip.textContent = enabled ? '\u25cf Enrolled' : '\u25cf Not Enrolled';
    }
    if (setupBtn)   setupBtn.style.display   = enabled ? 'none' : '';
    if (disableBtn) disableBtn.style.display = enabled ? ''     : 'none';

    var totpPanel = document.getElementById('totp-setup-panel');
    if (totpPanel && enabled) totpPanel.classList.remove('visible');
  }

  /* ─── MFA setup ─── */
  function handleMfaSetup() {
    console.log('[DKUT] handleMfaSetup called');
    if (!currentUser) {
      setMsg('mfa-action-msg', 'User session not found. Please log in again.', 'error');
      return;
    }
    var btn = document.getElementById('btn-setup-mfa');
    if (btn) btn.disabled = true;
    clearMsg('mfa-action-msg');

    currentUser.getIdToken(false)
      .then(function (idToken) {
        return fetch(getApiBase() + ADMIN_AUTH_PATH + '?action=setup-mfa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: idToken })
        });
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        mfaSecret = data.secret;

        var qr     = document.getElementById('totp-qr-img');
        var secBox = document.getElementById('totp-secret-box');
        var panel  = document.getElementById('totp-setup-panel');
        if (qr)     qr.src             = data.qrUrl;
        if (secBox) secBox.textContent = data.secret;
        if (panel)  panel.classList.add('visible');

        setMsg('mfa-action-msg', 'Scan the QR code, then enter the 6-digit code below.', 'info');
      })
      .catch(function (err) { setMsg('mfa-action-msg', err.message, 'error'); })
      .finally(function () { if (btn) btn.disabled = false; });
  }

  /* ─── MFA verify & enable ─── */
  function handleMfaVerify() {
    if (!currentUser || !mfaSecret) {
      setMsg('totp-verify-msg', 'Please click Enroll MFA to restart setup.', 'error');
      return;
    }
    var codeEl = document.getElementById('totp-code-input');
    var code   = codeEl ? (codeEl.value || '').replace(/\s/g,'') : '';
    if (code.length !== 6 || !/^\d+$/.test(code)) {
      setMsg('totp-verify-msg', 'Enter a 6-digit numeric code.', 'error');
      return;
    }

    var btn = document.getElementById('btn-verify-totp');
    if (btn) btn.disabled = true;
    setMsg('totp-verify-msg', 'Verifying…', 'info');

    currentUser.getIdToken(false)
      .then(function (idToken) {
        return fetch(getApiBase() + ADMIN_AUTH_PATH + '?action=enable-mfa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: idToken, code: code, secret: mfaSecret })
        });
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        mfaSecret = null;
        if (codeEl) codeEl.value = '';
        var panel = document.getElementById('totp-setup-panel');
        if (panel) panel.classList.remove('visible');
        updateMfaUI(true);
        setMsg('mfa-action-msg', 'MFA enabled successfully!', 'success');
        toast('MFA enabled!', 'success');
      })
      .catch(function (err) { setMsg('totp-verify-msg', err.message, 'error'); })
      .finally(function () { if (btn) btn.disabled = false; });
  }

  /* ─── MFA disable ─── */
  function handleMfaDisable() {
    if (!currentUser) return;
    if (!window.confirm('Disable MFA? This reduces account security.')) return;

    var btn = document.getElementById('btn-disable-mfa');
    if (btn) btn.disabled = true;
    clearMsg('mfa-action-msg');

    currentUser.getIdToken(false)
      .then(function (idToken) {
        return fetch(getApiBase() + ADMIN_AUTH_PATH + '?action=disable-mfa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: idToken })
        });
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        updateMfaUI(false);
        setMsg('mfa-action-msg', 'MFA has been disabled.', 'success');
        toast('MFA disabled.', 'info');
      })
      .catch(function (err) { setMsg('mfa-action-msg', err.message, 'error'); })
      .finally(function () { if (btn) btn.disabled = false; });
  }

  /* ─── Change Email ─── */
  function handleChangeEmail() {
    if (!currentUser) return;
    var newEmail = (document.getElementById('new-email').value || '').trim();
    var password = document.getElementById('reauth-email-password').value || '';
    if (!newEmail || !password) { setMsg('email-change-msg', 'Please fill in both fields.', 'error'); return; }

    var btn = document.getElementById('btn-change-email');
    if (btn) btn.disabled = true;
    setMsg('email-change-msg', 'Re-authenticating…', 'info');

    var credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, password);
    currentUser.reauthenticateWithCredential(credential)
      .then(function () { return currentUser.updateEmail(newEmail); })
      .then(function () {
        setMsg('email-change-msg', 'Email updated! Verification link sent to ' + newEmail, 'success');
        var emailEl = document.getElementById('dash-user-email');
        if (emailEl) emailEl.textContent = newEmail;
        document.getElementById('new-email').value = '';
        document.getElementById('reauth-email-password').value = '';
        toast('Email updated.', 'success');
      })
      .catch(function (err) { setMsg('email-change-msg', friendlyAuthError(err.code, err.message), 'error'); })
      .finally(function () { if (btn) btn.disabled = false; });
  }

  /* ─── Change Password ─── */
  function handleChangePassword() {
    if (!currentUser) return;
    var currentPass = document.getElementById('reauth-current-password').value || '';
    var newPass     = document.getElementById('new-password').value || '';
    if (!currentPass || !newPass) { setMsg('password-change-msg', 'Please fill in both fields.', 'error'); return; }
    if (newPass.length < 8) { setMsg('password-change-msg', 'New password must be at least 8 characters.', 'error'); return; }

    var btn = document.getElementById('btn-change-password');
    if (btn) btn.disabled = true;
    setMsg('password-change-msg', 'Re-authenticating…', 'info');

    var credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, currentPass);
    currentUser.reauthenticateWithCredential(credential)
      .then(function () { return currentUser.updatePassword(newPass); })
      .then(function () {
        setMsg('password-change-msg', 'Password updated successfully!', 'success');
        document.getElementById('reauth-current-password').value = '';
        document.getElementById('new-password').value = '';
        toast('Password updated.', 'success');
      })
      .catch(function (err) { setMsg('password-change-msg', friendlyAuthError(err.code, err.message), 'error'); })
      .finally(function () { if (btn) btn.disabled = false; });
  }

  /* ─── Send reset email from dashboard ─── */
  function handleSendReset() {
    if (!auth || !currentUser) return;
    var btn = document.getElementById('btn-send-reset');
    if (btn) btn.disabled = true;
    clearMsg('reset-msg');

    auth.sendPasswordResetEmail(currentUser.email)
      .then(function () {
        setMsg('reset-msg', 'Reset link sent to ' + currentUser.email, 'success');
        toast('Reset email sent!', 'success');
      })
      .catch(function (err) { setMsg('reset-msg', friendlyAuthError(err.code, err.message), 'error'); })
      .finally(function () { if (btn) btn.disabled = false; });
  }

  /* ─── Logout ─── */
  function handleLogout() {
    if (auth) {
      auth.signOut().then(function () {
        currentUser = null; mfaSecret = null;
        show('section-login');
        toast('Signed out.', 'info');
      }).catch(console.error);
    } else {
      show('section-login');
    }
  }

  /* ─── Theme selectors ─── */
  function initThemeSelectors() {
    var selectors = [
      document.getElementById('theme-toggle-select'),
      document.getElementById('theme-toggle-select-dash')
    ].filter(Boolean);
    if (!window.DKUT || !window.DKUT.app) return;
    var active = window.DKUT.app.getTheme();
    selectors.forEach(function (s) { s.value = active; });
    selectors.forEach(function (sel) {
      sel.addEventListener('change', function (e) {
        window.DKUT.app.setTheme(e.target.value);
        selectors.forEach(function (s) { s.value = e.target.value; });
      });
    });
    document.addEventListener('dkut-theme-change', function () {
      if (window.DKUT && window.DKUT.app) {
        var t = window.DKUT.app.getTheme();
        selectors.forEach(function (s) { s.value = t; });
      }
    });
  }

  /* ─── Bind events ─── */
  function bindEvents() {
    var loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    var forgotLink = document.getElementById('link-show-forgot');
    if (forgotLink) {
      forgotLink.addEventListener('click', function (e) {
        e.preventDefault();
        clearStatus('login-status');
        var emailEl  = document.getElementById('login-email');
        var forgotEl = document.getElementById('forgot-email');
        if (emailEl && forgotEl) forgotEl.value = emailEl.value;
        show('section-forgot');
        var fe = document.getElementById('forgot-email');
        if (fe) fe.focus();
      });
    }

    var forgotForm = document.getElementById('forgot-form');
    if (forgotForm) forgotForm.addEventListener('submit', handleForgotForm);

    var backBtn = document.getElementById('link-back-login');
    if (backBtn) {
      backBtn.addEventListener('click', function (e) {
        e.preventDefault();
        clearStatus('forgot-status');
        show('section-login');
      });
    }

    // MFA Challenge verified login
    var mfaChallengeForm = document.getElementById('mfa-challenge-form');
    if (mfaChallengeForm) mfaChallengeForm.addEventListener('submit', handleMfaChallenge);

    var mfaCancelLink = document.getElementById('link-mfa-cancel');
    if (mfaCancelLink) {
      mfaCancelLink.addEventListener('click', function (e) {
        e.preventDefault();
        handleLogout();
      });
    }

    var logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    var refreshBtn = document.getElementById('btn-refresh-cache');
    if (refreshBtn) refreshBtn.addEventListener('click', handleCacheRefresh);

    var mfaWarnBtn = document.getElementById('btn-mfa-warning-enroll');
    if (mfaWarnBtn) {
      mfaWarnBtn.addEventListener('click', function () {
        handleMfaSetup();
        setTimeout(function () {
          var el = document.getElementById('btn-setup-mfa');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
      });
    }

    var setupMfaBtn = document.getElementById('btn-setup-mfa');
    if (setupMfaBtn) setupMfaBtn.addEventListener('click', handleMfaSetup);

    var verifyBtn = document.getElementById('btn-verify-totp');
    if (verifyBtn) verifyBtn.addEventListener('click', handleMfaVerify);

    var totpInput = document.getElementById('totp-code-input');
    if (totpInput) {
      totpInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); handleMfaVerify(); }
      });
    }

    var disableMfaBtn = document.getElementById('btn-disable-mfa');
    if (disableMfaBtn) disableMfaBtn.addEventListener('click', handleMfaDisable);

    var changeEmailBtn = document.getElementById('btn-change-email');
    if (changeEmailBtn) changeEmailBtn.addEventListener('click', handleChangeEmail);

    var changePwBtn = document.getElementById('btn-change-password');
    if (changePwBtn) changePwBtn.addEventListener('click', handleChangePassword);

    var sendResetBtn = document.getElementById('btn-send-reset');
    if (sendResetBtn) sendResetBtn.addEventListener('click', handleSendReset);

    // Hostel Management Selection & Trigger
    var select = document.getElementById('hostel-select');
    if (select) select.addEventListener('change', handleHostelSelection);

    var addTrigger = document.getElementById('btn-add-hostel-trigger');
    if (addTrigger) addTrigger.addEventListener('click', handleAddHostelTrigger);

    // Tab buttons
    var tabVisual = document.getElementById('tab-visual');
    if (tabVisual) tabVisual.addEventListener('click', function () { switchHostelTab('visual'); });

    var tabJson = document.getElementById('tab-json');
    if (tabJson) tabJson.addEventListener('click', function () { switchHostelTab('json'); });

    // Format & Save & Cancel buttons
    var btnFormat = document.getElementById('btn-format-json');
    if (btnFormat) btnFormat.addEventListener('click', handleFormatJson);

    var btnSave = document.getElementById('btn-save-hostel');
    if (btnSave) btnSave.addEventListener('click', handleSaveHostel);

    var btnCancel = document.getElementById('btn-cancel-hostel');
    if (btnCancel) btnCancel.addEventListener('click', handleCancelHostel);

    // JSON Input change
    var textareaJson = document.getElementById('hostel-json');
    if (textareaJson) textareaJson.addEventListener('input', handleJsonTextareaChange);

    // Form inputs change (to sync to JSON)
    var syncInputs = [
      'hostel-name', 'hostel-gate', 'hostel-lat', 'hostel-lng', 
      'hostel-desc', 'hostel-phones', 'hostel-whatsapp', 'hostel-cover'
    ];
    syncInputs.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', syncVisualToJson);
    });

    var syncChecks = [
      'hostel-vacancies', 'hostel-wheelchair', 'hostel-cctv', 
      'hostel-guard', 'hostel-fenced', 'hostel-fingerprint'
    ];
    syncChecks.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', syncVisualToJson);
    });
  }

  /* ─── Boot: show loading immediately ─── */
  function boot() {
    console.log('[DKUT] boot starting…');
    try {
      show('section-loading');

      var ok = initFirebase();
      if (ok) {
        watchAuth();
      } else {
        show('section-login');
      }

      initThemeSelectors();
      bindEvents();
    } catch (e) {
      console.error('[DKUT] boot crashed:', e);
      show('section-login');
    }

    // Safety timeout: if auth does not resolve in 3.5 seconds, show login
    setTimeout(function () {
      if (!authResolved) {
        console.warn('[DKUT] Boot safety timeout triggered.');
        authResolved = true;
        show('section-login');
      }
    }, 3500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();

