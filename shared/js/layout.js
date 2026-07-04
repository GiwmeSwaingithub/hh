(function (global) {
  'use strict';

  function href(path) {
    if (global.DKUT && global.DKUT.CONFIG && global.DKUT.CONFIG.pageUrl) {
      return global.DKUT.CONFIG.pageUrl(path);
    }
    return '/hostel/' + path.replace(/^\//, '');
  }

  function getActivePage() {
    const path = location.pathname.toLowerCase();
    if (path.includes('/locations')) return 'locations';
    if (path.includes('/services')) return 'services';
    if (path.includes('/scam-reports')) return 'scam-reports';
    if (path.includes('/report-issue')) return 'report-issue';
    if (path.includes('/hostel-details')) return 'hostel-details';
    if (path.includes('/login')) return 'login';
    if (path.includes('/signup')) return 'signup';
    if (path.includes('/legal')) return 'legal';
    return 'home';
  }

  function bindFilterPanel() {
    const filterBtn = document.getElementById('filter-icon');
    const panel = document.getElementById('filter-panel');
    if (!filterBtn || !panel) return;

    filterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = panel.hasAttribute('hidden');
      if (open) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
      filterBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    document.addEventListener('click', e => {
      if (!panel.hasAttribute('hidden') && !panel.contains(e.target) && !filterBtn.contains(e.target)) {
        panel.setAttribute('hidden', '');
        filterBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function bindSearchFocus() {
    document.querySelectorAll('[data-focus-search]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        const searchBar = document.getElementById('poda');
        if (searchBar) searchBar.classList.add('search-visible');
        const input = document.getElementById('search-input');
        if (input) {
          input.focus();
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });
  }

  function bindSearchToggle() {
    const searchBar = document.getElementById('poda');
    if (!searchBar) return;

    const toggleButtons = [
      document.getElementById('topbar-search-toggle'),
      document.getElementById('nav-search-btn')
    ];

    toggleButtons.forEach(btn => {
      if (!btn) return;
      btn.addEventListener('click', e => {
        e.preventDefault();
        const isOpen = searchBar.classList.contains('search-visible');
        if (isOpen) {
          searchBar.classList.remove('search-visible');
        } else {
          searchBar.classList.add('search-visible');
          const input = document.getElementById('search-input');
          if (input) {
            input.focus();
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    });
  }

  function syncMockFromUrl() {
    const params = new URLSearchParams(location.search);
    if (!global.DKUT || !global.DKUT.app) return;
    if (params.has('mock')) global.DKUT.app.setMockMode(params.get('mock') === '1');
    if (params.has('demo')) global.DKUT.app.setMockMode(params.get('demo') === '1');
  }

  function updateMockBanner() {
    const banner = document.getElementById('mock-banner');
    const btn = document.getElementById('mock-toggle-btn');
    if (!banner || !global.DKUT || !global.DKUT.app) return;
    const mock = global.DKUT.app.isMockMode();
    banner.hidden = !mock;
    document.body.classList.toggle('mock-mode-active', mock);
    if (btn) {
      btn.textContent = mock ? 'Switch to live data' : 'Switch to mock data';
    }
  }

  // Helper function to build dynamic location chips in filter panel
  function buildLocationChips() {
    const chipsContainer = document.getElementById('location-chips');
    if (!chipsContainer) return;
    
    // Check if it already has chips. If it does, we don't need to build them.
    if (chipsContainer.children.length > 0) return;
    
    const locs = (global.DKUT && global.DKUT.CONFIG && global.DKUT.CONFIG.LOCATIONS) || [];
    const html = locs.map(l => `
      <button type="button" class="location-chip${l.id === 'all' ? ' active' : ''}" data-location="${l.id}" aria-pressed="${l.id === 'all'}">${l.label}</button>
    `).join('');
    chipsContainer.innerHTML = html;
  }

  function bindMockBanner() {
    document.getElementById('mock-toggle-btn')?.addEventListener('click', () => {
      if (!global.DKUT || !global.DKUT.app) return;
      const next = !global.DKUT.app.isMockMode();
      global.DKUT.app.setMockMode(next);
      const url = new URL(location.href);
      if (next) url.searchParams.set('mock', '1');
      else url.searchParams.delete('mock');
      url.searchParams.delete('demo');
      location.href = url.toString();
    });
    document.addEventListener('dkut-mock-change', updateMockBanner);
  }

  function initThemeSelector() {
    const sel = document.getElementById('theme-toggle-select');
    if (!sel) return;

    if (global.DKUT && global.DKUT.app) {
      sel.value = global.DKUT.app.getTheme();
      sel.addEventListener('change', e => {
        global.DKUT.app.setTheme(e.target.value);
      });
      document.addEventListener('dkut-theme-change', () => {
        sel.value = global.DKUT.app.getTheme();
      });
    }
  }

  function inject() {
    // Only bind event listeners since markup is pre-rendered in HTML
    buildLocationChips();
    bindFilterPanel();
    bindSearchFocus();
    bindSearchToggle();
    bindMockBanner();
    syncMockFromUrl();
    updateMockBanner();
    initThemeSelector();

    document.dispatchEvent(new CustomEvent('dkut-layout-ready'));
  }

  function bindScrollHide() {
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY;
      const topbar = document.getElementById('topbar');
      const navbar = document.getElementById('nav-bar');
      
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        // Scrolling down - hide bars
        if (topbar) topbar.classList.add('hide');
        if (navbar) navbar.classList.add('hide');
      } else {
        // Scrolling up - show bars
        if (topbar) topbar.classList.remove('hide');
        if (navbar) navbar.classList.remove('hide');
      }
      lastScrollY = currentScrollY;
    }, { passive: true });
  }

  function bindHomeLinks() {
    document.querySelectorAll('a[href="../home/"], a[href="../home/index.html"], #nav-btn-home, .topbar-left a, .footer-links a[href*="/home/"]').forEach(link => {
      if (link.classList.contains('back-link-topbar')) return;
      link.addEventListener('click', () => {
        try {
          sessionStorage.removeItem('dkut_home_state');
        } catch (_) {}
      });
    });
  }

  function checkCookieConsent() {
    try {
      if (localStorage.getItem('dkut_cookies_accepted') === 'true') return;
    } catch (_) { return; }

    const overlay = document.createElement('div');
    overlay.className = 'cookie-popup-overlay';
    overlay.id = 'cookie-popup';
    overlay.innerHTML = `
      <div class="cookie-popup-content">
        <span class="cookie-popup-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" height="46" width="65">
            <path stroke="#000" fill="#EAB789" d="M49.157 15.69L44.58.655l-12.422 1.96L21.044.654l-8.499 2.615-6.538 5.23-4.576 9.153v11.114l4.576 8.5 7.846 5.23 10.46 1.96 7.845-2.614 9.153 2.615 11.768-2.615 7.846-7.846 1.96-5.884.655-7.191-7.846-1.308-6.537-3.922z"></path>
            <path fill="#9C6750" d="M32.286 3.749c-6.94 3.65-11.69 11.053-11.69 19.591 0 8.137 4.313 15.242 10.724 19.052a20.513 20.513 0 01-8.723 1.937c-11.598 0-21-9.626-21-21.5 0-11.875 9.402-21.5 21-21.5 3.495 0 6.79.874 9.689 2.42z" clip-rule="evenodd" fill-rule="evenodd"></path>
            <path fill="#634647" d="M64.472 20.305a.954.954 0 00-1.172-.824 4.508 4.508 0 01-3.958-.934.953.953 0 00-1.076-.11c-.46.252-.977.383-1.502.382a3.154 3.154 0 01-2.97-2.11.954.954 0 00-.833-.634 4.54 4.54 0 01-4.205-4.507c.002-.23.022-.46.06-.687a.952.952 0 00-.213-.767 3.497 3.497 0 01-.614-3.5.953.953 0 00-.382-1.138 3.522 3.522 0 01-1.5-3.992.951.951 0 00-.762-1.227A22.611 22.611 0 0032.3 2.16 22.41 22.41 0 0022.657.001a22.654 22.654 0 109.648 43.15 22.644 22.644 0 0032.167-22.847zM22.657 43.4a20.746 20.746 0 110-41.493c2.566-.004 5.11.473 7.501 1.407a22.64 22.64 0 00.003 38.682 20.6 20.6 0 01-7.504 1.404zm19.286 0a20.746 20.746 0 112.131-41.384 5.417 5.417 0 001.918 4.635 5.346 5.346 0 00-.133 1.182A5.441 5.441 0 0046.879 11a5.804 5.804 0 00-.028.568 6.456 6.456 0 005.38 6.345 5.053 5.053 0 006.378 2.472 6.412 6.412 0 004.05 1.12 20.768 20.768 0 01-20.716 21.897z"></path>
            <path fill="#644647" d="M54.962 34.3a17.719 17.719 0 01-2.602 2.378.954.954 0 001.14 1.53 19.637 19.637 0 002.884-2.634.955.955 0 00-1.422-1.274z"></path>
            <path stroke-width="1.8" stroke="#644647" fill="#845556" d="M44.5 32.829c-.512 0-1.574.215-2 .5-.426.284-.342.263-.537.736a2.59 2.59 0 104.98.99c0-.686-.458-1.241-.943-1.726-.485-.486-.814-.5-1.5-.5zm-30.916-2.5c-.296 0-.912.134-1.159.311-.246.177-.197.164-.31.459a1.725 1.725 0 00-.086.932c.058.312.2.6.41.825.21.226.477.38.768.442.291.062.593.03.867-.092s.508-.329.673-.594a1.7 1.7 0 00.253-.896c0-.428-.266-.774-.547-1.076-.281-.302-.471-.31-.869-.311zm17.805-11.375c-.143-.492-.647-1.451-1.04-1.78-.392-.33-.348-.255-.857-.31a2.588 2.588 0 10.441 5.06c.66-.194 1.064-.788 1.395-1.39.33-.601.252-.92.06-1.58zm-22 2c-.143-.492-.647-1.451-1.04-1.78-.391-.33-.347-.255-.856-.31a2.589 2.589 0 10.44 5.06c.66-.194 1.064-.788 1.395-1.39.33-.601.252-.92.06-1.58zM38.112 7.329c-.395 0-1.216.179-1.545.415-.328.236-.263.218-.415.611-.151.393-.19.826-.114 1.243.078.417.268.8.548 1.1.28.301.636.506 1.024.59.388.082.79.04 1.155-.123.366-.163.678-.438.898-.792.22-.354.337-.77.337-1.195 0-.57-.354-1.031-.73-1.434-.374-.403-.628-.415-1.158-.415zm-19.123.703c.023-.296-.062-.92-.219-1.18-.157-.26-.148-.21-.432-.347a1.726 1.726 0 00-.922-.159 1.654 1.654 0 00-.856.344 1.471 1.471 0 00-.501.73c-.085.285-.077.589.023.872.1.282.287.532.538.718a1.7 1.7 0 00.873.323c.427.033.793-.204 1.116-.46.324-.256.347-.445.38-.841z"></path>
            <path fill="#634647" d="M15.027 15.605a.954.954 0 00-1.553 1.108l1.332 1.863a.955.955 0 001.705-.77.955.955 0 00-.153-.34l-1.331-1.861z"></path>
            <path fill="#644647" d="M43.31 23.21a.954.954 0 101.553-1.11l-1.266-1.772a.954.954 0 10-1.552 1.11l1.266 1.772z"></path>
            <path fill="#634647" d="M19.672 35.374a.954.954 0 00-.954.953v2.363a.954.954 0 001.907 0v-2.362a.954.954 0 00-.953-.954z"></path>
            <path fill="#644647" d="M33.129 29.18l-2.803 1.065a.953.953 0 00-.053 1.764.957.957 0 00.73.022l2.803-1.065a.953.953 0 00-.677-1.783v-.003zm24.373-3.628l-2.167.823a.956.956 0 00-.054 1.764.954.954 0 00.73.021l2.169-.823a.954.954 0 10-.678-1.784v-.001z"></path>
          </svg>
        </span>
        <h5 class="cookie-popup-title">Your privacy is important to us</h5>
        <p class="cookie-popup-desc">
          We process your personal information to measure and improve our sites and services, to assist our campaigns and to provide personalised content.
          <br>
          For more information see our <a href="../legal/" target="_blank">Privacy Policy</a>
        </p>
        <a href="../legal/" class="cookie-popup-more-btn" target="_blank">More Options</a>
        <button type="button" class="cookie-popup-accept-btn" id="cookie-accept-btn">Accept</button>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('cookie-accept-btn')?.addEventListener('click', () => {
      try {
        localStorage.setItem('dkut_cookies_accepted', 'true');
      } catch (_) {}
      overlay.style.opacity = '0';
      overlay.style.transform = 'translateY(20px)';
      setTimeout(() => overlay.remove(), 300);
    });
  }

  function setupAccessibilityTTS() {
    if (!('speechSynthesis' in window)) return;

    const container = document.createElement('div');
    container.className = 'tts-float-container';
    container.id = 'tts-accessibility-widget';
    container.innerHTML = `
      <button class="tts-toggle-btn" aria-label="Accessibility Options" title="Accessibility Audio Text Reader">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="speaker-icon">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
      </button>
      <div class="tts-controls-panel">
        <div class="tts-btn-row">
          <button class="tts-ctrl-btn" id="tts-play-btn" title="Play Text Reader">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </button>
          <button class="tts-ctrl-btn" id="tts-pause-btn" title="Pause Text Reader">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
          </button>
          <button class="tts-ctrl-btn" id="tts-stop-btn" title="Stop Text Reader">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16"></rect></svg>
          </button>
        </div>
        <div class="tts-slider-wrap">
          <span>Speed: <label id="tts-speed-val">1x</label></span>
          <input type="range" id="tts-speed-slider" min="0.5" max="2" step="0.1" value="1">
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const toggleBtn = container.querySelector('.tts-toggle-btn');
    const playBtn = container.querySelector('#tts-play-btn');
    const pauseBtn = container.querySelector('#tts-pause-btn');
    const stopBtn = container.querySelector('#tts-stop-btn');
    const speedSlider = container.querySelector('#tts-speed-slider');
    const speedVal = container.querySelector('#tts-speed-val');

    let currentUtterance = null;
    let isSpeaking = false;

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      container.classList.toggle('expanded');
    });

    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        container.classList.remove('expanded');
      }
    });

    speedSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      speedVal.textContent = val + 'x';
      if (window.speechSynthesis.speaking) {
        const wasPlaying = !window.speechSynthesis.paused;
        window.speechSynthesis.cancel();
        speakPageText(val);
        if (!wasPlaying) window.speechSynthesis.pause();
      }
    });

    function cleanTextForSpeech() {
      const mainContent = document.querySelector('main') || document.body;
      const clone = mainContent.cloneNode(true);
      
      // Remove elements we don't want to read
      clone.querySelectorAll('script, style, svg, iframe, button, .nav-group, .topbar-right, .filter-panel, .cookie-popup-overlay, .tts-float-container').forEach(el => el.remove());
      
      // Clean up whitespace
      return clone.innerText.replace(/\s+/g, ' ').trim();
    }

    function speakPageText(rate) {
      window.speechSynthesis.cancel();
      const text = cleanTextForSpeech();
      if (!text) return;

      currentUtterance = new SpeechSynthesisUtterance(text);
      currentUtterance.rate = rate || parseFloat(speedSlider.value);
      
      currentUtterance.onstart = () => {
        isSpeaking = true;
        updateUI();
      };
      
      currentUtterance.onend = () => {
        isSpeaking = false;
        currentUtterance = null;
        updateUI();
      };

      currentUtterance.onerror = () => {
        isSpeaking = false;
        currentUtterance = null;
        updateUI();
      };

      window.speechSynthesis.speak(currentUtterance);
    }

    function updateUI() {
      const activeSpeaking = window.speechSynthesis.speaking;
      const activePaused = window.speechSynthesis.paused;

      playBtn.classList.toggle('active', activeSpeaking && !activePaused);
      pauseBtn.classList.toggle('active', activeSpeaking && activePaused);
      stopBtn.classList.toggle('active', false);
    }

    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        updateUI();
      } else {
        speakPageText();
      }
    });

    pauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        updateUI();
      }
    });

    stopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.speechSynthesis.cancel();
      isSpeaking = false;
      currentUtterance = null;
      updateUI();
    });

    // Periodically update UI to stay in sync with synthesis engine states
    setInterval(updateUI, 500);
  }

  function init() {
    inject();
    bindScrollHide();
    bindHomeLinks();
    checkCookieConsent();
    setupAccessibilityTTS();
    document.addEventListener('dkut-auth-change', e => {
      const user = e.detail && e.detail.user;
      const loginBtn = document.getElementById('nav-login-btn');
      if (loginBtn && user) {
        loginBtn.href = '#';
        loginBtn.title = 'Sign out';
        loginBtn.setAttribute('aria-label', 'Sign out');
        loginBtn.onclick = ev => {
          ev.preventDefault();
          if (global.DKUT && global.DKUT.authState) global.DKUT.authState.signOut();
        };
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.DKUT = global.DKUT || {};
  global.DKUT.layout = { getActivePage, inject };
})(window);
