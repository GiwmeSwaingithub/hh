(function (global) {
  'use strict';

  const DKUT = global.DKUT || {};
  const esc = s => (DKUT.security && DKUT.security.escapeHtml) ? DKUT.security.escapeHtml(s) : String(s || '');

  const FALLBACK_IMG = 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=600&q=80';

  function fmtPrice(val) {
    if (val == null || val === '' || isNaN(val)) return 'Contact for price';
    const n = Number(val);
    if (n > 0 && n < 200) return 'KES ' + n + '/night';
    return 'KES ' + n.toLocaleString('en-KE') + '/sem';
  }

  function normalizeHostels(data) {
    const raw = Array.isArray(data) ? data : (data && Array.isArray(data.hostels) ? data.hostels : []);
    return raw.map((h, i) => {
      const isNewStructure = h.location && typeof h.location === 'object' && h.location.gate;
      
      if (isNewStructure) {
        const locationName = h.location.gate;
        const coordinatesStr = h.location.coordinates ? `${h.location.coordinates.latitude}, ${h.location.coordinates.longitude}` : '';
        const phoneList = h.contact && Array.isArray(h.contact.phone) ? h.contact.phone.join(', ') : (h.contact && h.contact.phone ? h.contact.phone : '');
        
        const defaultRoom = h.rooms && h.rooms[0];
        const priceSharing = defaultRoom && defaultRoom.price ? defaultRoom.price.amountSharing : 0;
        const priceAlone = defaultRoom && defaultRoom.price ? defaultRoom.price.amountAlone : 0;
        const roomTypeStr = defaultRoom ? defaultRoom.name : '';
        const occupancyStr = defaultRoom && defaultRoom.occupancy && defaultRoom.occupancy.maximumPeople > 1 ? 'shared' : 'stay-alone';
        
        const utilitiesArray = [];
        if (h.utilities) {
          const u = h.utilities;
          if (u.water) {
            if (u.water.type === 'included') {
              utilitiesArray.push('Free Water');
            } else {
              const desc = u.water.description || 'metered';
              utilitiesArray.push(`Water (${desc})`);
            }
          }
          if (u.electricity) {
            if (u.electricity.type === 'included') {
              utilitiesArray.push('Free Electricity');
            } else {
              const desc = u.electricity.description || 'paid separately';
              utilitiesArray.push(`Electricity (${desc})`);
            }
          }
          if (u.wifi && u.wifi.type === 'included') utilitiesArray.push('Free WiFi');
          if (u.hotShower && u.hotShower.available) utilitiesArray.push('Hot Water');
          if (u.bed && u.bed.included) utilitiesArray.push(u.bed.mattressIncluded ? 'Free Bed with mattress' : 'Free Bed');
          if (u.laundry && u.laundry.available) utilitiesArray.push('Laundry Area');
          if (u.parking && u.parking.available) utilitiesArray.push('Parking Available');
        }
        
        if (h.security) {
          const s = h.security;
          if (s.fingerprintAccess) utilitiesArray.push('FingerPrint Security');
          if (s.cctv) utilitiesArray.push('CCTV');
          if (s.securityGuard) utilitiesArray.push('Security Guard');
          if (s.fenced) utilitiesArray.push('Fenced Compound');
        }
        
        if (h.accessibility && h.accessibility.wheelchairAccessible) {
          utilitiesArray.push('Wheelchair Access');
        }

        return {
          ...h,
          id: h.id != null && h.id !== '' ? h.id : i + 1,
          name: (h.name && String(h.name).trim()) || ('Hostel ' + (i + 1)),
          location: locationName,
          coordinates: coordinatesStr,
          contact: phoneList,
          price: priceSharing,
          priceAlone: priceAlone,
          roomType: roomTypeStr,
          occupancy: occupancyStr,
          utilities: utilitiesArray,
          image: h.media && h.media.coverImage ? h.media.coverImage : (h.image || ''),
          images: h.media && Array.isArray(h.media.gallery) 
            ? h.media.gallery.flatMap(g => g.images || []) 
            : (Array.isArray(h.images) ? h.images : []),
          videos: h.media && Array.isArray(h.media.videos)
            ? h.media.videos.map(v => v.url).filter(Boolean)
            : (Array.isArray(h.videos) ? h.videos : [])
        };
      } else {
        return {
          ...h,
          id: h.id != null && h.id !== '' ? h.id : i + 1,
          name: (h.name && String(h.name).trim()) || ('Hostel ' + (i + 1)),
          location: h.location || 'Nyeri',
          utilities: Array.isArray(h.utilities) ? h.utilities : [],
          images: Array.isArray(h.images) ? h.images.filter(Boolean) : (h.image ? [h.image] : []),
          videos: Array.isArray(h.videos) ? h.videos.filter(Boolean) : (h.video ? [h.video] : []),
        };
      }
    });
  }

  const MOCK_STORAGE_KEY = 'dkut_mock_mode';

  function isMockMode() {
    const params = new URLSearchParams(location.search);
    if (params.get('mock') === '1' || params.get('demo') === '1') return true;
    if (params.get('mock') === '0' || params.get('demo') === '0') return false;
    try { return localStorage.getItem(MOCK_STORAGE_KEY) === '1'; } catch (_) { return false; }
  }

  function setMockMode(on) {
    try {
      if (on) localStorage.setItem(MOCK_STORAGE_KEY, '1');
      else localStorage.removeItem(MOCK_STORAGE_KEY);
    } catch (_) {}
    document.dispatchEvent(new CustomEvent('dkut-mock-change', { detail: { mock: !!on } }));
  }

  function getMockDataUrls() {
    const urls = [];
    if (DKUT.CONFIG && DKUT.CONFIG.mockDataUrl) {
      try { urls.push(DKUT.CONFIG.mockDataUrl()); } catch (_) {}
    }
    try { urls.push(new URL('../../shared/data/hostels.mock.json', location.href).href); } catch (_) {}
    urls.push('/hostel/shared/data/hostels.mock.json');
    urls.push('/shared/data/hostels.mock.json');
    return [...new Set(urls)];
  }

  function getDataUrls() {
    const urls = [];
    if (DKUT.CONFIG && DKUT.CONFIG.dataUrl) {
      try { urls.push(DKUT.CONFIG.dataUrl()); } catch (_) {}
    }
    try { urls.push(new URL('../../shared/data/hostels.json', location.href).href); } catch (_) {}
    try { urls.push(new URL('../shared/data/hostels.json', location.href).href); } catch (_) {}
    urls.push('/hostel/shared/data/hostels.json');
    urls.push('/shared/data/hostels.json');
    return [...new Set(urls)];
  }

  async function fetchFromUrls(urls, cacheKey, label) {
    let lastErr = null;
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) { lastErr = new Error('HTTP ' + res.status + ' for ' + url); continue; }
        const data = await res.json();
        const normalized = normalizeHostels(data);
        if (normalized.length === 0) { lastErr = new Error('Empty list from ' + url); continue; }
        if (cacheKey) {
          try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: normalized })); } catch (_) {}
        }
        console.info('[DKUT] Loaded', normalized.length, label, 'from', url);
        return normalized;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('Could not load ' + label);
  }

  async function fetchMockHostels() {
    const cacheKey = (DKUT.CONFIG && DKUT.CONFIG.SETTINGS && DKUT.CONFIG.SETTINGS.mockCacheKey) || 'dkut_hostels_mock_cache';
    const cacheTTL = (DKUT.CONFIG && DKUT.CONFIG.SETTINGS && DKUT.CONFIG.SETTINGS.cacheTTL) || 3600000;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.ts && parsed.data && (Date.now() - parsed.ts < cacheTTL)) {
          const normalized = normalizeHostels(parsed.data);
          if (normalized.length > 0) return normalized;
        }
      }
    } catch (_) {}

    return fetchFromUrls(getMockDataUrls(), cacheKey, 'mock hostels');
  }

  function clearCache() {
    try {
      const cfg = DKUT.CONFIG && DKUT.CONFIG.SETTINGS;
      const cacheKey = (cfg && cfg.cacheKey) || 'dkut_hostels_cf_cache';
      localStorage.removeItem(cacheKey);
      console.info('[DKUT] Local hostel cache cleared.');
    } catch (_) {}
  }

  async function fetchHostels(forceRefresh) {
    if (isMockMode()) return fetchMockHostels();

    const cfg      = DKUT.CONFIG && DKUT.CONFIG.SETTINGS;
    const workerUrl = (cfg && cfg.cfWorkerUrl) || 'https://dekuthostels-cache.giwme1socialtalk.workers.dev/hostels.json';
    const cacheKey  = (cfg && cfg.cacheKey)    || 'dkut_hostels_cf_cache';

    if (forceRefresh) {
      clearCache();
    }

    // --- 1. Fetch live from Cloudflare Worker (single source of truth) ------
    try {
      const res = await fetch(workerUrl, { cache: 'no-cache' });
      if (res.ok) {
        const raw = await res.json();
        const normalized = normalizeHostels(raw);
        if (normalized.length > 0) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: normalized }));
          } catch (_) {}
          console.info('[DKUT] Loaded', normalized.length, 'hostels from Cloudflare Worker.');
          return normalized;
        }
      }
    } catch (err) {
      console.warn('[DKUT] Cloudflare fetch failed, attempting local cache fallback:', err);
    }

    // --- 2. Offline Fallback: Serve from browser localStorage ----------
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.data) {
          const normalized = normalizeHostels(parsed.data);
          if (normalized.length > 0) {
            console.info('[DKUT] Served', normalized.length, 'hostels from browser cache fallback.');
            return normalized;
          }
        }
      }
    } catch (_) {}

    // --- 3. Final Fallback: Static json files ----------
    return fetchFromUrls(getDataUrls(), cacheKey, 'hostels fallback');
  }

  // Watch Firestore cloudflare/sync document for live invalidation across open tabs
  (function initLiveCacheInvalidation() {
    let listening = false;
    function setupListener() {
      if (listening) return;
      try {
        if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
          const db = window.firebase.firestore();
          let initial = true;
          db.collection('cloudflare').doc('sync').onSnapshot(doc => {
            if (initial) { initial = false; return; }
            console.info('[DKUT] Cloudflare sync update detected! Invalidating cache...');
            clearCache();
            document.dispatchEvent(new CustomEvent('dkut-cache-invalidated', { detail: doc.data() }));
          }, () => {});
          listening = true;
        }
      } catch (_) {}
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(setupListener, 1000));
    } else {
      setTimeout(setupListener, 1000);
    }
  })();

  function detailsUrl(hostelId) {
    if (DKUT.CONFIG && DKUT.CONFIG.pageUrl) {
      return DKUT.CONFIG.pageUrl('pages/hostel-details/index.html?h=' + encodeURIComponent(hostelId));
    }
    return '../hostel-details/index.html?h=' + encodeURIComponent(hostelId);
  }

  function homeLocationUrl(locationName) {
    const locSlug = String(locationName || '').toLowerCase().trim().replace(/\s+/g, '-');
    const locs = (DKUT.CONFIG && DKUT.CONFIG.LOCATIONS) || [];
    const found = locs.find(l => (l.label || l.name || '').toLowerCase() === locationName.toLowerCase() || l.id === locSlug);
    const id = found ? found.id : locSlug;
    if (DKUT.CONFIG && DKUT.CONFIG.pageUrl) {
      return DKUT.CONFIG.pageUrl('pages/home/index.html?loc=' + encodeURIComponent(id));
    }
    if (location.pathname.includes('/pages/home') || location.pathname === '/' || location.pathname === '/home') {
      return 'index.html?loc=' + encodeURIComponent(id);
    }
    return '../home/index.html?loc=' + encodeURIComponent(id);
  }

  function switchTab(cardId, tab, btn) {
    ['info', 'photos', 'map'].forEach(t => {
      const el = document.getElementById(cardId + '-' + t);
      if (el) el.style.display = (t === tab) ? 'block' : 'none';
    });
    if (btn && btn.closest) {
      const btns = btn.closest('.mode-switch').querySelectorAll('.mode-btn');
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
  }

  function buildHostelCard(h, idx, options) {
    options = options || {};
    const hostelId = h.id != null ? h.id : idx;
    const utils = h.utilities || [];
    const imgs = h.images && h.images.length ? h.images : (h.image ? [h.image] : []);
    const thumb = imgs[0] || h.image || FALLBACK_IMG;
    const reqMsg = encodeURIComponent(`Hello, I would like to request the caretaker's number for "${h.name}" (Hostel ID: ${hostelId}).`);
    const whatsapp = 'https://wa.me/254769486775?text=' + reqMsg;
    const detailHref = detailsUrl(hostelId);
    const desc = String(h.description || '');
    const descShort = desc.length > 120 ? desc.slice(0, 120) + '…' : desc;

    const badges = utils.slice(0, 4).map(u => '<span class="project-tag">' + esc(u) + '</span>').join('');

    const stripPeriod = s => String(s || '').replace(/\/sem/i, '').replace(/\/night/i, '').replace(/\/month/i, '').replace(/\/day/i, '');
    const priceLines = [];
    if (h.rooms && Array.isArray(h.rooms) && h.rooms.length > 0) {
      h.rooms.forEach(room => {
        const amtStr = room.price.amountSharing ? stripPeriod(fmtPrice(room.price.amountSharing)) : '';
        if (amtStr) {
          priceLines.push(room.name + ' (Sharing): ' + amtStr);
        }
        const aloneStr = room.price.amountAlone ? stripPeriod(fmtPrice(room.price.amountAlone)) : '';
        if (aloneStr) {
          priceLines.push(room.name + ' (Solo): ' + aloneStr);
        }
      });
    } else {
      if (h.price > 0) {
        priceLines.push('Sharing: ' + stripPeriod(fmtPrice(h.price)));
      }
      if (h.priceAlone > 0) {
        priceLines.push('Solo: ' + stripPeriod(fmtPrice(h.priceAlone)));
      }
    }

    let pricingHtml = '';
    if (priceLines.length > 0) {
      pricingHtml = '<div class="page card-notebook-pricing">' +
        '<div class="margin"></div>' +
        '<div class="card-notebook-lines">' +
          priceLines.map(line => '<p class="rule-item">' + esc(line) + '</p>').join('') +
        '</div>' +
      '</div>';
    }

    const actionBtn = options.linkToDetails
      ? '<a class="enquire-btn" href="' + esc(detailHref) + '"><em>View Details</em><i>&#10095;&#10095;</i></a>'
      : '<a1' + (whatsapp ? ' href="' + esc(whatsapp) + '" target="_blank" rel="noopener noreferrer"' : '') + '><em>Enquire Now</em><i>&#10095;&#10095;</i></a1>';

    return '<li class="project-item active" data-name="' + esc((h.name || '').toLowerCase()) + '" data-loc="' + esc((h.location || '').toLowerCase()) + '" data-id="' + esc(hostelId) + '">' +
      '<div class="project-card">' +
        '<div class="card-hero-wrap">' +
          '<img src="' + esc(thumb) + '" alt="' + esc(h.name) + '" class="card-hero-img" loading="lazy" onerror="this.src=\'' + FALLBACK_IMG + '\'">' +
          '<span class="card-hero-badge">#' + esc(hostelId) + '</span>' +
        '</div>' +
        '<div class="card-simple-info" style="margin-top:16px; text-align:left;">' +
          '<h3 class="project-title" style="margin: 0 0 8px 0;"><a href="' + esc(detailHref) + '">' + esc(h.name) + '</a></h3>' +
          '<div class="project-meta" style="margin-bottom: 8px;">' +
            '<a class="project-date" href="' + esc(homeLocationUrl(h.location)) + '" style="text-decoration:none;cursor:pointer;">' + esc(h.location) + '</a>' +
            '<span class="project-tag">' + esc(h.roomType || h.occupancy || 'Room') + '</span>' +
          '</div>' +
          '<p class="project-description" style="text-align:left; margin-bottom:12px; font-size:0.85rem; color:#8a8298; line-height:1.5;">' + esc(descShort || 'No description available.') + '</p>' +
          '<div class="project-meta" style="flex-wrap:wrap;gap:6px;margin-bottom:12px;">' + badges + '</div>' +
          pricingHtml +
        '</div>' +
        actionBtn +
      '</div>' +
    '</li>';
  }

  function showToast(msg, type, dur) {
    const t = document.getElementById('dkut-toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'dkut-toast ' + (type || 'info') + ' show';
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), dur || 3000);
  }

  function filterHostels(hostels, query, location, gender, sort, accessibility, minPrice, maxPrice, roomType, rentIncludes) {
    let list = Array.isArray(hostels) ? [...hostels] : [];
    const q = (query || '').trim().toLowerCase();

    if (q) {
      list = list.filter(h =>
        String(h.id).includes(q) ||
        (h.name || '').toLowerCase().includes(q) ||
        (h.location || '').toLowerCase().includes(q) ||
        (h.roomType || '').toLowerCase().includes(q) ||
        (h.description || '').toLowerCase().includes(q) ||
        (h.utilities || []).join(' ').toLowerCase().includes(q)
      );
    }

    if (location && location !== 'all') {
      const locEntry = (DKUT.CONFIG && DKUT.CONFIG.LOCATIONS || []).find(l => l.id === location);
      const locLabel = locEntry ? locEntry.label.toLowerCase() : location.toLowerCase().replace(/-/g, ' ');
      const locSlug = location.toLowerCase();
      list = list.filter(h => {
        const loc = (h.location || '').toLowerCase();
        return loc.includes(locLabel) || loc.includes(locSlug) || loc.replace(/\s/g, '').includes(locSlug.replace(/-/g, ''));
      });
    }

    if (gender && gender !== 'all') {
      list = list.filter(h => {
        const occ = (h.occupancy || '').toLowerCase();
        const name = (h.name || '').toLowerCase();
        if (gender === 'male') return occ.includes('male') || name.includes('male') || name.includes('men');
        if (gender === 'female') return occ.includes('female') || name.includes('female') || name.includes('ladies');
        return true;
      });
    }

    if (accessibility && accessibility !== 'all') {
      list = list.filter(h => {
        const utils = (h.utilities || []).map(u => u.toLowerCase());
        const desc = (h.description || '').toLowerCase();
        if (accessibility === 'wheelchair') {
          return utils.includes('wheelchair access') || desc.includes('wheelchair');
        }
        if (accessibility === 'ground-floor') {
          return utils.includes('ground floor room') || desc.includes('ground floor');
        }
        if (accessibility === 'special-needs') {
          return utils.includes('special needs approved') || desc.includes('special needs');
        }
        return true;
      });
    }

    // Price Range Filter
    if (minPrice != null && minPrice !== '') {
      const min = Number(minPrice);
      list = list.filter(h => {
        const p = h.price || 0;
        const pa = h.priceAlone || 0;
        return (p > 0 && p >= min) || (pa > 0 && pa >= min);
      });
    }
    if (maxPrice != null && maxPrice !== '') {
      const max = Number(maxPrice);
      list = list.filter(h => {
        const p = h.price || 0;
        const pa = h.priceAlone || 0;
        const effectivePrice = p > 0 ? (pa > 0 ? Math.min(p, pa) : p) : pa;
        return effectivePrice > 0 && effectivePrice <= max;
      });
    }

    // Room Type Filter
    if (roomType && roomType !== 'all') {
      list = list.filter(h => {
        const rt = (h.roomType || '').toLowerCase();
        const desc = (h.description || '').toLowerCase();
        const name = (h.name || '').toLowerCase();
        const hasRoomInArray = h.rooms && h.rooms.some(r => (r.name || '').toLowerCase().includes(roomType.toLowerCase()));
        
        if (roomType === 'bedsitter') {
          return rt.includes('bedsitter') || desc.includes('bedsitter') || name.includes('bedsitter') || hasRoomInArray;
        } else if (roomType === 'single') {
          return rt.includes('single') || desc.includes('single') || name.includes('single') || hasRoomInArray;
        } else if (roomType === 'sharing') {
          return rt.includes('sharing') || rt.includes('shared') || desc.includes('sharing') || desc.includes('shared') || name.includes('sharing') || hasRoomInArray;
        } else if (roomType === 'one-bedroom') {
          return rt.includes('1 bedroom') || rt.includes('one bedroom') || desc.includes('1 bedroom') || desc.includes('one bedroom') || hasRoomInArray;
        }
        
        return rt.includes(roomType.toLowerCase()) || hasRoomInArray;
      });
    }

    // Rent Includes Utilities Filter
    if (Array.isArray(rentIncludes) && rentIncludes.length > 0) {
      list = list.filter(h => {
        const utils = (h.utilities || []).map(u => u.toLowerCase());
        return rentIncludes.every(amenity => {
          if (amenity === 'water') return utils.includes('free water');
          if (amenity === 'electricity') return utils.includes('free electricity');
          if (amenity === 'wifi') return utils.includes('free wifi');
          return false;
        });
      });
    }

    switch (sort) {
      case 'price-asc': list.sort((a, b) => (a.price || 999999) - (b.price || 999999)); break;
      case 'price-desc': list.sort((a, b) => (b.price || 0) - (a.price || 0)); break;
      case 'name-asc': list.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
      case 'id-asc': list.sort((a, b) => Number(a.id) - Number(b.id)); break;
      default: list.sort((a, b) => Number(a.id) - Number(b.id)); break;
    }

    return list;
  }

  /* ── Global Theme and Accent Managers ── */
  function getTheme() {
    try { return localStorage.getItem('dkut_theme') || 'system'; } catch (_) { return 'system'; }
  }

  function getAccent() {
    try { return localStorage.getItem('dkut_accent') || 'green'; } catch (_) { return 'green'; }
  }

  function applyTheme(theme) {
    let active = theme;
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      active = isDark ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', active);
    document.dispatchEvent(new CustomEvent('dkut-theme-change', { detail: { theme: active } }));
  }

  function applyAccent(accent) {
    document.documentElement.setAttribute('data-accent', accent);
    document.dispatchEvent(new CustomEvent('dkut-accent-change', { detail: { accent } }));
  }

  function setTheme(theme) {
    try { localStorage.setItem('dkut_theme', theme); } catch (_) {}
    applyTheme(theme);
  }

  function setAccent(accent) {
    try { localStorage.setItem('dkut_accent', accent); } catch (_) {}
    applyAccent(accent);
  }

  // Initialize immediately
  try {
    applyTheme(getTheme());
    applyAccent(getAccent());
  } catch (_) {}

  // Watch for system color scheme changes
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getTheme() === 'system') {
        applyTheme('system');
      }
    });
  } catch (_) {}

  DKUT.app = {
    fetchHostels, fetchMockHostels, buildHostelCard, switchTab, fmtPrice, showToast, clearCache,
    filterHostels, esc, normalizeHostels, detailsUrl, homeLocationUrl, FALLBACK_IMG,
    isMockMode, setMockMode, getTheme, getAccent, setTheme, setAccent, applyTheme, applyAccent,
  };
  global.DKUT = DKUT;
})(window);
