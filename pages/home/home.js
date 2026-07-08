(function () {
  'use strict';

  const FAQ = [
    { q: 'How do I find a hostel near DKUT?', a: 'Use the search bar or location chips to filter by area. Each card shows price, amenities, and contact options.' },
    { q: 'What is the average price?', a: 'Shared rooms typically range from KES 3,500–6,000 per semester. Single rooms go from KES 7,000–15,000.' },
    { q: 'Are listings verified?', a: 'We verify listings through visits and landlord contact. Report suspicious listings using the Scam Alerts page.' },
    { q: 'How do I contact a hostel?', a: 'Click View Details on any card for full info, phone numbers, and WhatsApp contact.' },
    { q: 'How do I report a scam?', a: 'Use Scam Alerts to check phone numbers or flag suspicious landlord details.' },
  ];

  let allHostels = [];
  let filtered = [];
  let page = 1;
  const PAGE_SIZE = 20;
  const MOCK_PAGE_SIZE = 50;
  let filters = {
    query: '',
    location: 'all',
    gender: 'all',
    sort: 'id-asc',
    accessibility: 'all',
    minPrice: '',
    maxPrice: '',
    roomType: 'all',
    rentIncludes: []
  };
  let started = false;

  const LOCATION_INFO = {
    embassy: {
      name: 'Embassy Area',
      distance: '1-3 mins walk to campus',
      desc: 'Embassy is located right opposite Dedan Kimathi University main campus. It is highly popular due to its close proximity, high-speed Wi-Fi, and steady water supply. Highly convenient for students attending early/late lectures.',
      averagePrice: 'KSh 4,500 - 7,000 per sem (Sharing)',
      features: ['WiFi', 'Water', 'Close to campus', 'Security']
    },
    'gate-a': {
      name: 'Gate A Area',
      distance: '2-5 mins walk to campus',
      desc: 'Gate A is the main entrance area of DeKUT. Hostels here are highly sought after, offering quick access to the university library, administration block, and main lecture halls. Expect a bustling student environment.',
      averagePrice: 'KSh 4,000 - 6,500 per sem (Sharing)',
      features: ['Main Entrance', 'Shops', 'Security', 'Bustling Life']
    },
    'gate-b': {
      name: 'Gate B Area',
      distance: '5-10 mins walk to campus',
      desc: 'Gate B area offers a quieter environment, located near the secondary university entrance. It is ideal for students who prefer peace and quiet for studies. Hostels here are generally newer with modern finishes.',
      averagePrice: 'KSh 3,500 - 5,500 per sem (Sharing)',
      features: ['Quiet study', 'Newer buildings', 'Budget friendly', 'Safe neighborhood']
    },
    boma: {
      name: 'Boma Area',
      distance: '8-12 mins walk to campus',
      desc: 'Boma is a vibrant student hub located slightly further from the campus. It is well-known for budget-friendly student housing, social student communities, and easy access to Nyeri-Nyahururu highway transport.',
      averagePrice: 'KSh 3,000 - 5,000 per sem (Sharing)',
      features: ['Affordable', 'Highway access', 'Social hubs', 'Borehole water']
    },
    'nyeri-view': {
      name: 'Nyeri View Area',
      distance: '10-15 mins walk / short commute',
      desc: 'Nyeri View area offers scenic, premium apartments with beautiful views of Mount Kenya. It features spacious rooms and quiet environments, preferred by senior students or those looking for solo residency.',
      averagePrice: 'KSh 6,000 - 10,000 per sem (Solo)',
      features: ['Premium spacing', 'Scenic views', 'Quiet & peaceful', 'High-end perks']
    }
  };

  function startLocationsAutoSwipe() {
    const track = document.getElementById('locations-carousel-track');
    if (!track) return;
    const cards = track.children;
    if (cards.length <= 1) return;

    let index = 0;
    const total = cards.length;

    function getVisibleCount() {
      if (window.innerWidth >= 1024) return 3;
      if (window.innerWidth >= 768) return 2;
      return 1;
    }

    function updateSlide() {
      if (cards.length === 0) return;
      const visible = getVisibleCount();
      const maxIndex = total - visible;
      
      if (window.__carouselController && window.__carouselController.locked) {
        if (index > maxIndex) index = maxIndex;
        if (index < 0) index = 0;
      } else {
        if (index > maxIndex) index = 0;
        if (index < 0) index = maxIndex;
      }

      const cardWidth = cards[0].getBoundingClientRect().width;
      const gap = 20; // gap in px

      let offset = 0;
      if (visible === 1) {
        const container = document.querySelector('.locations-carousel-container');
        const containerWidth = container ? container.getBoundingClientRect().width : window.innerWidth;
        offset = (containerWidth - cardWidth) / 2;
      }

      track.style.transform = `translateX(-${index * (cardWidth + gap) - offset}px)`;

      // Toggle active-slide class for floating effect
      for (let i = 0; i < cards.length; i++) {
        if (window.__carouselController && window.__carouselController.locked) {
          const locAttr = cards[i].getAttribute('data-location');
          cards[i].classList.toggle('active-slide', locAttr === filters.location);
        } else {
          cards[i].classList.toggle('active-slide', i === index);
        }
      }
    }

    let interval = null;
    function startTimer() {
      stopTimer();
      if (window.__carouselController && window.__carouselController.locked) return;
      interval = setInterval(() => {
        index++;
        updateSlide();
      }, 4000);
    }
    function stopTimer() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }

    window.__carouselController = {
      lockTo: function(targetIndex) {
        stopTimer();
        this.locked = true;
        index = targetIndex;
        updateSlide();
      },
      unlock: function() {
        if (this.locked) {
          this.locked = false;
          startTimer();
          updateSlide();
        }
      },
      locked: false
    };

    // Left/Right manual buttons
    const btnLeft = document.getElementById('locations-arrow-left');
    const btnRight = document.getElementById('locations-arrow-right');

    if (btnLeft) {
      btnLeft.addEventListener('click', () => {
        if (window.__carouselController && window.__carouselController.locked) return;
        index--;
        updateSlide();
        startTimer();
      });
    }
    if (btnRight) {
      btnRight.addEventListener('click', () => {
        if (window.__carouselController && window.__carouselController.locked) return;
        index++;
        updateSlide();
        startTimer();
      });
    }

    // Touch gesture swipe support
    const container = document.querySelector('.locations-carousel-container');
    if (container) {
      let touchStartX = 0;
      let touchStartY = 0;

      container.addEventListener('touchstart', (e) => {
        if (window.__carouselController && window.__carouselController.locked) return;
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        stopTimer();
      }, { passive: true });

      container.addEventListener('touchend', (e) => {
        if (window.__carouselController && window.__carouselController.locked) return;
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        const diffX = touchStartX - touchEndX;
        const diffY = touchStartY - touchEndY;
        const threshold = 50;

        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > threshold) {
          if (diffX > 0) {
            index++;
          } else {
            index--;
          }
          updateSlide();
        }
        startTimer();
      });

      container.addEventListener('mouseenter', () => {
        if (window.__carouselController && window.__carouselController.locked) return;
        stopTimer();
      });
      container.addEventListener('mouseleave', () => {
        if (window.__carouselController && window.__carouselController.locked) return;
        startTimer();
      });
    }

    window.addEventListener('resize', updateSlide);
    // Align on load
    setTimeout(updateSlide, 200);
    startTimer();
  }

  function showLoading() {
    const list = document.getElementById('hostel-list');
    if (!list) return;
    list.innerHTML = Array.from({ length: 4 }, (_, i) =>
      '<li class="project-item active" aria-hidden="true">' +
        '<div class="project-card skeleton-card">' +
          '<div class="skeleton-img"></div>' +
          '<div class="skeleton-line wide"></div>' +
          '<div class="skeleton-line mid"></div>' +
        '</div>' +
      '</li>'
    ).join('');
  }

  function renderFAQ() {
    const el = document.getElementById('faq-list');
    if (!el) return;
    el.innerHTML = FAQ.map((item, i) => `
      <div class="faq-item" id="faq-${i}">
        <button type="button" class="faq-question" aria-expanded="false">
          <span>${DKUT.app.esc(item.q)}</span><span>+</span>
        </button>
        <div class="faq-answer-wrap"><div class="faq-answer">${DKUT.app.esc(item.a)}</div></div>
      </div>
    `).join('');
    el.querySelectorAll('.faq-question').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const open = item.classList.contains('open');
        el.querySelectorAll('.faq-item').forEach(f => f.classList.remove('open'));
        if (!open) item.classList.add('open');
      });
    });
  }

  function renderLocationChips() {
    const bar = document.getElementById('location-chips-bar');
    const panel = document.getElementById('location-chips');
    const locs = (DKUT.CONFIG && DKUT.CONFIG.LOCATIONS) || [];
    const html = locs.map(l =>
      `<button type="button" class="location-chip${l.id === filters.location ? ' active' : ''}" data-location="${l.id}">${DKUT.app.esc(l.label)}</button>`
    ).join('');
    if (bar) bar.innerHTML = html;
    if (panel) panel.innerHTML = html;

    document.querySelectorAll('.location-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        filters.location = chip.dataset.location;
        page = 1;
        document.querySelectorAll('.location-chip').forEach(c => {
          c.classList.toggle('active', c.dataset.location === filters.location);
        });
        const genderEl = document.getElementById('filter-gender');
        const sortEl = document.getElementById('filter-sort');
        if (genderEl) genderEl.value = filters.gender;
        if (sortEl) sortEl.value = filters.sort;
        applyAndRender();
      });
    });
  }

  function updateStats() {
    const el = document.getElementById('hero-stats');
    if (!el || !allHostels.length) return;
    const locs = new Set(allHostels.map(h => (h.location || '').trim())).size;
    const priced = allHostels.filter(h => h.price > 0);
    const min = priced.length ? priced.reduce((m, h) => Math.min(m, h.price), Infinity) : Infinity;
    el.innerHTML = `
      <div class="hero-stat"><div class="hero-stat-num">${allHostels.length}</div><div class="hero-stat-label">${DKUT.app.isMockMode() ? 'Mock hostels' : 'Hostels in JSON'}</div></div>
      <div class="hero-stat"><div class="hero-stat-num">${locs}</div><div class="hero-stat-label">Locations</div></div>
      <div class="hero-stat"><div class="hero-stat-num">${min < Infinity ? DKUT.app.fmtPrice(min) : 'N/A'}</div><div class="hero-stat-label">Lowest / Sem</div></div>
    `;
  }

  function clearAllFilters() {
    filters.query = '';
    filters.location = 'all';
    filters.gender = 'all';
    filters.accessibility = 'all';
    filters.minPrice = '';
    filters.maxPrice = '';
    filters.roomType = 'all';
    filters.rentIncludes = [];
    filters.sort = 'id-asc';
    
    // Clear sessionStorage
    try {
      sessionStorage.removeItem('dkut_home_state');
    } catch (_) {}

    // Sync UI inputs if they exist
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    const genderSelect = document.getElementById('filter-gender');
    if (genderSelect) genderSelect.value = 'all';
    const accessSelect = document.getElementById('filter-accessibility');
    if (accessSelect) accessSelect.value = 'all';
    
    const minPriceEl = document.getElementById('filter-min-price');
    if (minPriceEl) minPriceEl.value = '';
    const maxPriceEl = document.getElementById('filter-max-price');
    if (maxPriceEl) maxPriceEl.value = '';
    const roomTypeEl = document.getElementById('filter-room-type');
    if (roomTypeEl) roomTypeEl.value = 'all';

    document.querySelectorAll('.filter-amenity-checkbox').forEach(cb => {
      cb.checked = false;
    });

    // Clear highlights from location chips and activate 'all'
    document.querySelectorAll('.location-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.location === 'all');
    });

    // Clear highlights from carousel
    const carouselCards = document.querySelectorAll('#locations-carousel-track .location-card-wrapper');
    carouselCards.forEach(c => c.classList.remove('active-slide'));

    // Remove URL parameters
    const cleanUrl = location.protocol + "//" + location.host + location.pathname;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);

    applyAndRender();
  }

  function applyAndRender() {
    filtered = DKUT.app.filterHostels(
      allHostels,
      filters.query,
      filters.location,
      filters.gender,
      filters.sort,
      filters.accessibility,
      filters.minPrice,
      filters.maxPrice,
      filters.roomType,
      filters.rentIncludes
    );
    const countEl = document.getElementById('results-count');
    const empty = document.getElementById('hostel-empty');
    const list = document.getElementById('hostel-list');
    const loadWrap = document.getElementById('load-more-wrap');
    const pageSize = DKUT.app.isMockMode() ? MOCK_PAGE_SIZE : PAGE_SIZE;
    const visible = filtered.slice(0, page * pageSize);

    // Render active filter banner at the top of the listings
    const banner = document.getElementById('filter-info-banner');
    if (banner) {
      const activeFilters = [];
      if (filters.query) activeFilters.push(`"${filters.query}"`);
      if (filters.location && filters.location !== 'all') {
        const locName = filters.location.replace(/-/g, ' ');
        activeFilters.push(`Location: ${locName.charAt(0).toUpperCase() + locName.slice(1)}`);
      }
      if (filters.gender && filters.gender !== 'all') {
        activeFilters.push(`Gender: ${filters.gender.charAt(0).toUpperCase() + filters.gender.slice(1)}`);
      }
      if (filters.accessibility && filters.accessibility !== 'all') {
        activeFilters.push(`Accessibility: ${filters.accessibility.replace(/-/g, ' ')}`);
      }

      if (activeFilters.length > 0) {
        banner.hidden = false;
        banner.innerHTML = `
          <span style="font-size: 0.85rem; font-weight: 500;">Showing results for: <strong style="color: var(--accent);">${activeFilters.join(' • ')}</strong></span>
          <button type="button" class="macos-download-btn" id="clear-filters-banner-btn" style="font-size: 0.75rem !important; padding: 6px 12px !important; margin: 0; background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); color: #fff;">Clear Filters</button>
        `;
        document.getElementById('clear-filters-banner-btn')?.addEventListener('click', clearAllFilters);
      } else {
        banner.hidden = true;
      }
    }

    if (countEl) {
      countEl.innerHTML = filtered.length
        ? `Showing <strong>${visible.length}</strong> of <strong>${filtered.length}</strong> hostels` +
          (filtered.length < allHostels.length ? ` <span style="opacity:0.7">(${allHostels.length} total in database)</span>` : '')
        : `No matches — <strong>${allHostels.length}</strong> hostels in database`;
    }

    const hasFilter = filters.query || (filters.location && filters.location !== 'all') || (filters.gender && filters.gender !== 'all') || (filters.accessibility && filters.accessibility !== 'all');

    if (!filtered.length) {
      if (list) list.innerHTML = '';
      if (empty) {
        empty.style.display = 'block';
        if (hasFilter) {
          empty.innerHTML = `No hostels match your active filters. <a href="#" id="reset-empty-btn" style="color: var(--accent); font-weight: bold; text-decoration: underline;">Clear filters & view all</a>`;
          document.getElementById('reset-empty-btn')?.addEventListener('click', (ev) => {
            ev.preventDefault();
            clearAllFilters();
          });
        } else {
          empty.innerHTML = `No hostels found. Try adjusting your search or filters.`;
        }
      }
      if (loadWrap) loadWrap.hidden = true;
      saveState();
      return;
    }

    if (empty) empty.style.display = 'none';
    if (list) list.innerHTML = visible.map((h, i) => DKUT.app.buildHostelCard(h, i, { linkToDetails: true })).join('');

    const hasMore = visible.length < filtered.length;
    if (loadWrap) {
      loadWrap.hidden = false;
      if (hasMore) {
        loadWrap.innerHTML = `<button type="button" class="btn-ghost" id="load-more-btn" style="width: 100%;">Load More (${filtered.length - visible.length} remaining)</button>`;
        document.getElementById('load-more-btn')?.addEventListener('click', () => {
          page++;
          applyAndRender();
        });
      } else {
        if (hasFilter) {
          loadWrap.innerHTML = `
            <div style="text-align: center; color: var(--light-gray); font-size: 0.9rem; padding: 20px 0;">
              No more hostels match your criteria. <a href="#" id="reset-end-btn" style="color: var(--accent); font-weight: bold; text-decoration: underline; cursor: pointer;">Go back to all</a>
            </div>
          `;
          document.getElementById('reset-end-btn')?.addEventListener('click', (ev) => {
            ev.preventDefault();
            clearAllFilters();
          });
        } else {
          loadWrap.innerHTML = `
            <div style="text-align: center; color: var(--light-gray); font-size: 0.9rem; padding: 20px 0;">
              End of listings.
            </div>
          `;
        }
      }
    }

    // Lock or unlock carousel slider to target location if active
    if (window.__carouselController) {
      const activeLoc = filters.location;
      if (activeLoc && activeLoc !== 'all') {
        const track = document.getElementById('locations-carousel-track');
        if (track) {
          let targetIdx = -1;
          const children = track.children;
          for (let i = 0; i < children.length; i++) {
            if (children[i].getAttribute('data-location') === activeLoc) {
              targetIdx = i;
              break;
            }
          }
          if (targetIdx !== -1) {
            window.__carouselController.lockTo(targetIdx);
          } else {
            window.__carouselController.unlock();
          }
        }
      } else {
        window.__carouselController.unlock();
      }
    }

    saveState();

    if (window.__pendingScroll != null) {
      const targetScroll = window.__pendingScroll;
      setTimeout(() => {
        window.scrollTo({
          top: targetScroll,
          behavior: 'instant'
        });
      }, 50);
      delete window.__pendingScroll;
    }
  }

  function bindSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;

    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        filters.query = input.value;
        page = 1;
        applyAndRender();
      }, 200);
    });

    const genderEl = document.getElementById('filter-gender');
    const sortEl = document.getElementById('filter-sort');
    const accessibilityEl = document.getElementById('filter-accessibility');
    const applyBtn = document.getElementById('apply-filters-btn');

    if (sortEl) sortEl.value = filters.sort;
    if (genderEl) genderEl.value = filters.gender;
    if (accessibilityEl) accessibilityEl.value = filters.accessibility;

    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        filters.gender = genderEl ? genderEl.value : 'all';
        filters.sort = sortEl ? sortEl.value : 'id-asc';
        filters.accessibility = accessibilityEl ? accessibilityEl.value : 'all';

        const minPriceEl = document.getElementById('filter-min-price');
        const maxPriceEl = document.getElementById('filter-max-price');
        const roomTypeEl = document.getElementById('filter-room-type');
        
        filters.minPrice = minPriceEl ? minPriceEl.value : '';
        filters.maxPrice = maxPriceEl ? maxPriceEl.value : '';
        filters.roomType = roomTypeEl ? roomTypeEl.value : 'all';
        
        const includes = [];
        if (document.getElementById('filter-inc-water')?.checked) includes.push('water');
        if (document.getElementById('filter-inc-electricity')?.checked) includes.push('electricity');
        if (document.getElementById('filter-inc-wifi')?.checked) includes.push('wifi');
        filters.rentIncludes = includes;

        page = 1;
        applyAndRender();
        document.getElementById('filter-panel')?.setAttribute('hidden', '');
      });
    }

    document.getElementById('load-more-btn')?.addEventListener('click', () => {
      page++;
      applyAndRender();
    });

    const loadWrap = document.getElementById('load-more-wrap');
    if (loadWrap && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !loadWrap.hidden) {
          const pageSize = DKUT.app.isMockMode() ? MOCK_PAGE_SIZE : PAGE_SIZE;
          const hasMore = (page * pageSize) < filtered.length;
          if (hasMore) {
            page++;
            applyAndRender();
          }
        }
      }, {
        rootMargin: '150px',
      });
      observer.observe(loadWrap);
    }
  }

  function showError(err) {
    const list = document.getElementById('hostel-list');
    const msg = (err && err.message) ? err.message : 'Unknown error';
    if (list) {
      list.innerHTML = `
        <li style="color:#ff5f56;text-align:center;padding:40px 20px;list-style:none;">
          <p style="margin:0 0 12px;font-size:1rem;">Failed to load hostels.json</p>
          <p style="margin:0 0 16px;font-size:0.85rem;color:#8a8298;">${DKUT.app.esc(msg)}</p>
          <p style="margin:0 0 16px;font-size:0.85rem;color:#8a8298;">Serve this folder over HTTP (not file://) and open <strong>/pages/home/</strong></p>
          <button type="button" class="btn-ghost" id="retry-load-btn">Retry</button>
        </li>`;
      document.getElementById('retry-load-btn')?.addEventListener('click', () => {
        try { localStorage.removeItem('dkut_hostels_cache'); } catch (_) {}
        loadData();
      });
    }
    const countEl = document.getElementById('results-count');
    if (countEl) countEl.textContent = 'Could not load hostel data';
  }

  async function loadData() {
    showLoading();
    try {
      allHostels = await DKUT.app.fetchHostels();
    } catch (err) {
      console.error('[DKUT Home]', err);
      showError(err);
      return;
    }
    updateStats();
    renderLocationChips();
    bindSearch();
    applyAndRender();
    if (DKUT.app.showToast) {
      const label = DKUT.app.isMockMode() ? 'mock' : 'live';
      DKUT.app.showToast('Loaded ' + allHostels.length + ' ' + label + ' hostels', 'success', 2500);
    }
  }

  function saveState() {
    try {
      const state = {
        filters: filters,
        page: page,
        scroll: window.scrollY
      };
      sessionStorage.setItem('dkut_home_state', JSON.stringify(state));

      // Sync URL query parameters
      const url = new URL(location.href);
      if (filters.query) url.searchParams.set('q', filters.query);
      else url.searchParams.delete('q');

      if (filters.location && filters.location !== 'all') url.searchParams.set('loc', filters.location);
      else url.searchParams.delete('loc');

      if (filters.minPrice) url.searchParams.set('minPrice', filters.minPrice);
      else url.searchParams.delete('minPrice');

      if (filters.maxPrice) url.searchParams.set('maxPrice', filters.maxPrice);
      else url.searchParams.delete('maxPrice');

      if (filters.roomType && filters.roomType !== 'all') url.searchParams.set('roomType', filters.roomType);
      else url.searchParams.delete('roomType');

      if (filters.rentIncludes && filters.rentIncludes.length > 0) url.searchParams.set('rentIncludes', filters.rentIncludes.join(','));
      else url.searchParams.delete('rentIncludes');

      history.replaceState(null, '', url.toString());
    } catch (_) {}
  }

  function restoreState() {
    let hasSavedState = false;
    try {
      const saved = sessionStorage.getItem('dkut_home_state');
      if (saved) {
        const state = JSON.parse(saved);
        if (state) {
          if (state.filters) {
            filters = state.filters;
            hasSavedState = true;
            
            const input = document.getElementById('search-input');
            if (input) input.value = filters.query || '';
            
            const genderEl = document.getElementById('filter-gender');
            if (genderEl) genderEl.value = filters.gender || 'all';
            
            const sortEl = document.getElementById('filter-sort');
            if (sortEl) sortEl.value = filters.sort || 'id-asc';
            
            const accessibilityEl = document.getElementById('filter-accessibility');
            if (accessibilityEl) accessibilityEl.value = filters.accessibility || 'all';

            const minPriceEl = document.getElementById('filter-min-price');
            if (minPriceEl) minPriceEl.value = filters.minPrice || '';

            const maxPriceEl = document.getElementById('filter-max-price');
            if (maxPriceEl) maxPriceEl.value = filters.maxPrice || '';

            const roomTypeEl = document.getElementById('filter-room-type');
            if (roomTypeEl) roomTypeEl.value = filters.roomType || 'all';

            if (document.getElementById('filter-inc-water')) {
              document.getElementById('filter-inc-water').checked = (filters.rentIncludes || []).includes('water');
            }
            if (document.getElementById('filter-inc-electricity')) {
              document.getElementById('filter-inc-electricity').checked = (filters.rentIncludes || []).includes('electricity');
            }
            if (document.getElementById('filter-inc-wifi')) {
              document.getElementById('filter-inc-wifi').checked = (filters.rentIncludes || []).includes('wifi');
            }
          }
          if (state.page) page = state.page;
          if (state.scroll != null) window.__pendingScroll = state.scroll;
        }
      }
    } catch (_) {}

    if (!hasSavedState) {
      const params = new URLSearchParams(location.search);
      if (params.get('q')) {
        filters.query = params.get('q');
        const input = document.getElementById('search-input');
        if (input) input.value = filters.query;
      }
      if (params.get('loc')) filters.location = params.get('loc');
      if (params.get('minPrice')) {
        filters.minPrice = params.get('minPrice');
        const el = document.getElementById('filter-min-price');
        if (el) el.value = filters.minPrice;
      }
      if (params.get('maxPrice')) {
        filters.maxPrice = params.get('maxPrice');
        const el = document.getElementById('filter-max-price');
        if (el) el.value = filters.maxPrice;
      }
      if (params.get('roomType')) {
        filters.roomType = params.get('roomType');
        const el = document.getElementById('filter-room-type');
        if (el) el.value = filters.roomType;
      }
      if (params.get('rentIncludes')) {
        filters.rentIncludes = params.get('rentIncludes').split(',').filter(Boolean);
        if (document.getElementById('filter-inc-water')) {
          document.getElementById('filter-inc-water').checked = filters.rentIncludes.includes('water');
        }
        if (document.getElementById('filter-inc-electricity')) {
          document.getElementById('filter-inc-electricity').checked = filters.rentIncludes.includes('electricity');
        }
        if (document.getElementById('filter-inc-wifi')) {
          document.getElementById('filter-inc-wifi').checked = filters.rentIncludes.includes('wifi');
        }
      }
    }
  }

  function bindGridLayout() {
    const btns = document.querySelectorAll('.grid-layout-btn');
    const list = document.getElementById('hostel-list');
    if (!list) return;

    let pref = 'auto';
    try {
      pref = localStorage.getItem('dkut_grid_cols') || 'auto';
    } catch (_) {}

    list.classList.remove('cols-1', 'cols-2', 'cols-3', 'cols-auto');
    list.classList.add('cols-' + pref);
    btns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cols === pref);
    });

    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const cols = btn.dataset.cols;
        list.classList.remove('cols-1', 'cols-2', 'cols-3', 'cols-auto');
        list.classList.add('cols-' + cols);
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        try {
          localStorage.setItem('dkut_grid_cols', cols);
        } catch (_) {}
      });
    });
  }

  function start() {
    if (started) return;
    started = true;
    restoreState();
    startLocationsAutoSwipe();
    renderFAQ();
    bindGridLayout();

    // Listen for scroll to save state
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(saveState, 200);
    });

    loadData();
  }

  function boot() {
    if (document.getElementById('search-input')) {
      start();
    } else {
      document.addEventListener('dkut-layout-ready', start, { once: true });
      setTimeout(start, 500);
    }
  }

  window.selectLocation = function (locId) {
    try {
      sessionStorage.setItem('dkut_home_state', JSON.stringify({
        filters: { query: '', location: locId, gender: 'all', sort: 'id-asc', accessibility: 'all' },
        page: 1,
        scroll: 0
      }));
    } catch (_) {}
    location.href = 'index.html?loc=' + locId;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
