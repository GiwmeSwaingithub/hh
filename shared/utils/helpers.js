/* ============================================================
   DKUT HOSTELS — HELPERS.JS
   Walk time, pricing, amenities, image categorization, formatting
   ============================================================ */

(function (global) {
  'use strict';

  const sec = () => global.DKUT && global.DKUT.security;

  /* ── Walk Time Calculator ── */
  function walkTime(distanceKm) {
    if (!distanceKm || isNaN(distanceKm)) return null;
    const mins = Math.round((parseFloat(distanceKm) / 5) * 60); // ~5 km/h walking
    if (mins < 1) return 'Under 1 min walk';
    if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} walk`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}h ${rem}min walk` : `${hrs}h walk`;
  }

  /* ── Distance between two lat/lon points (Haversine) ── */
  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  function toRad(deg) { return deg * (Math.PI / 180); }

  /* ── Format Price ── */
  function formatPrice(amount, { short = false, currency = 'KSh' } = {}) {
    if (amount == null || isNaN(amount)) return 'N/A';
    const n = Number(amount);
    if (short && n >= 1000) {
      return `${currency} ${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
    }
    return `${currency} ${n.toLocaleString('en-KE')}`;
  }

  /* ── Detect image category from URL or filename ── */
  function detectImageCategory(url) {
    if (!url || typeof url !== 'string') return 'other';
    const lower = url.toLowerCase();
    const cats = (global.DKUT && global.DKUT.CONFIG && global.DKUT.CONFIG.IMAGE_CATEGORIES) || {
      bedroom:  ['bedroom','bed','room','sleeping','single','double','bedsitter','interior','inside'],
      kitchen:  ['kitchen','cook','cooking','stove','gas','appliance'],
      bathroom: ['bathroom','toilet','shower','wash','bath','wc','restroom'],
      exterior: ['exterior','outside','gate','entrance','building','compound','front','facade'],
      common:   ['common','lounge','lobby','hall','corridor','sitting','living'],
    };
    for (const [cat, keywords] of Object.entries(cats)) {
      if (keywords.some(kw => lower.includes(kw))) return cat;
    }
    return 'exterior'; // default assumption for hostel images
  }

  /* ── Group images by category ── */
  function groupImagesByCategory(images) {
    if (!Array.isArray(images)) return {};
    const groups = {};
    images.filter(Boolean).forEach(url => {
      const cat = detectImageCategory(url);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(url);
    });
    return groups;
  }

  /* ── Category display label ── */
  function categoryLabel(cat) {
    const labels = {
      bedroom:  'Bedroom',
      kitchen:  'Kitchen',
      bathroom: 'Bathroom',
      exterior: 'Exterior',
      common:   'Common Areas',
      other:    'Gallery',
    };
    return labels[cat] || 'Gallery';
  }

  /* ── Category icon ── */
  function categoryIcon(cat) {
    const icons = {
      bedroom:  'fa-bed',
      kitchen:  'fa-utensils',
      bathroom: 'fa-shower',
      exterior: 'fa-building',
      common:   'fa-couch',
      other:    'fa-image',
    };
    return icons[cat] || 'fa-image';
  }

  /* ── Parse amenities from hostel utilities array ── */
  function parseAmenities(utilities) {
    if (!Array.isArray(utilities)) return [];
    const iconMap = (global.DKUT && global.DKUT.CONFIG && global.DKUT.CONFIG.AMENITY_ICONS) || {};

    return utilities.map(raw => {
      const text = String(raw).trim();
      const lower = text.toLowerCase();

      let icon = 'fa-check-circle';
      let matched = false;

      for (const [key, val] of Object.entries(iconMap)) {
        if (lower.includes(key)) {
          icon = val.icon;
          matched = true;
          break;
        }
      }

      return {
        raw: text,
        label: text,
        icon,
        matched,
      };
    }).filter(a => a.raw.length > 0);
  }

  /* ── Build pricing cards data ── */
  function buildPricingData(hostel) {
    const cards = [];
    const esc = sec() ? sec().escapeHtml : s => s;

    // Shared pricing
    if (hostel.price) {
      cards.push({
        type:         'Shared Room',
        icon:         'fa-users',
        pricePerSem:  hostel.price,
        priceLabel:   formatPrice(hostel.price) + '/sem',
        deposit:      hostel.price,
        refundable:   true,
        available:    true,
        occupancy:    'Shared',
      });
    }

    // Single/private pricing
    if (hostel.priceAlone) {
      cards.push({
        type:         'Single Room',
        icon:         'fa-user',
        pricePerSem:  hostel.priceAlone,
        priceLabel:   formatPrice(hostel.priceAlone) + '/sem',
        deposit:      hostel.priceAlone,
        refundable:   true,
        available:    true,
        occupancy:    'Private',
      });
    }

    // Bedsitter if listed in roomType
    if (hostel.roomType && /bedsitter/i.test(hostel.roomType)) {
      const price = hostel.priceAlone || hostel.price;
      if (price && !cards.some(c => c.type === 'Single Room')) {
        cards.push({
          type:         'Bedsitter',
          icon:         'fa-door-open',
          pricePerSem:  price,
          priceLabel:   formatPrice(price) + '/sem',
          deposit:      price,
          refundable:   true,
          available:    true,
          occupancy:    'Private',
        });
      }
    }

    return cards;
  }

  /* ── Truncate text ── */
  function truncate(str, maxLen = 100, ellipsis = '…') {
    if (!str) return '';
    const s = String(str);
    return s.length > maxLen ? s.slice(0, maxLen).trimEnd() + ellipsis : s;
  }

  /* ── Pluralize ── */
  function pluralize(count, singular, plural) {
    return count === 1 ? `${count} ${singular}` : `${count} ${plural || singular + 's'}`;
  }

  /* ── Debounce ── */
  function debounce(fn, wait = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  /* ── Throttle ── */
  function throttle(fn, wait = 300) {
    let last = 0;
    return function (...args) {
      const now = Date.now();
      if (now - last >= wait) {
        last = now;
        fn.apply(this, args);
      }
    };
  }

  /* ── Time since (relative) ── */
  function timeSince(date) {
    const now = Date.now();
    const ts  = date instanceof Date ? date.getTime() : Number(date);
    const diff = Math.floor((now - ts) / 1000);
    if (diff < 60)     return 'Just now';
    if (diff < 3600)   return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400)  return `${Math.floor(diff/3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
    return new Date(ts).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* ── Show Toast ── */
  function showToast(message, type = 'info', duration = 3000) {
    let toast = document.getElementById('dkut-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'dkut-toast';
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('show'), duration);
  }

  /* ── Expose ── */
  global.DKUT = global.DKUT || {};
  global.DKUT.helpers = {
    walkTime,
    haversineKm,
    formatPrice,
    detectImageCategory,
    groupImagesByCategory,
    categoryLabel,
    categoryIcon,
    parseAmenities,
    buildPricingData,
    truncate,
    pluralize,
    debounce,
    throttle,
    timeSince,
    showToast,
  };

})(window);
