(function () {
  'use strict';

  let grids = {};
  let tabs = [];

  const typeMap = {
    1: 'wifi-grid',
    2: 'transport-grid',
    3: 'cleaning-grid'
  };

  function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function selectTab(tabName) {
    const tabButton = Array.from(tabs).find(t => t.dataset.tab === tabName);
    if (tabButton) {
      // Update active tab button
      tabs.forEach(t => t.classList.remove('active'));
      tabButton.classList.add('active');

      // Toggle visibility of grids
      Object.keys(grids).forEach(k => {
        if (grids[k]) {
          grids[k].style.display = (k === tabName) ? 'grid' : 'none';
        }
      });
    }
  }

  function bindTabs() {
    tabs = document.querySelectorAll('.service-tab-btn');
    grids = {
      wifi: document.getElementById('wifi-grid'),
      transport: document.getElementById('transport-grid'),
      cleaning: document.getElementById('cleaning-grid')
    };

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        selectTab(target);
      });
    });
  }

  async function fetchServices() {
    const cacheKey = 'dkut_services_cache';
    let cfServicesUrl = 'https://api.listing.dekut.site/services.json';
    const githubRawServicesUrl = 'https://raw.githubusercontent.com/GiwmeSwaingithub/hh/main/backups/latest_services.json';

    // Dynamically retrieve from global config if available
    if (window.DKUT && window.DKUT.CONFIG && window.DKUT.CONFIG.SETTINGS) {
      cfServicesUrl = window.DKUT.CONFIG.SETTINGS.cfWorkerUrl.replace('hostels.json', 'services.json');
    }

    const localUrl = new URL('shared/data/services.json', new URL(
      (window.DKUT && window.DKUT.CONFIG && window.DKUT.CONFIG.getAppRoot) ? window.DKUT.CONFIG.getAppRoot() : '/hostel/',
      location.origin
    )).href;

    // 1. Try fetching live from Cloudflare Worker
    try {
      console.log('[Services] Fetching from worker:', cfServicesUrl);
      const res = await fetch(cfServicesUrl, { 
        cache: 'no-cache',
        headers: { 'X-DKUT-Client': 'dkut-web-app' }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          try { localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data })); } catch (_) {}
          return data;
        }
      }
    } catch (e) {
      console.warn('[Services] Worker fetch failed, trying GitHub Raw fallback:', e);
    }

    // 2. Cloudflare Daily Limit / Failure Fallback: GitHub Raw Latest Services JSON
    try {
      console.log('[Services] Fetching latest services backup from GitHub Raw...');
      const ghRes = await fetch(githubRawServicesUrl, { cache: 'no-cache' });
      if (ghRes.ok) {
        const data = await ghRes.json();
        if (Array.isArray(data) && data.length > 0) {
          try { localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data })); } catch (_) {}
          console.log('[Services] Served from GitHub Raw backup.');
          return data;
        }
      }
    } catch (ghErr) {
      console.warn('[Services] GitHub Raw backup fetch failed:', ghErr);
    }

    // 3. Fallback to localStorage cache
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { data } = JSON.parse(cached);
        if (Array.isArray(data) && data.length > 0) {
          console.log('[Services] Serving from local cache fallback');
          return data;
        }
      } catch (_) {}
    }

    // 4. Final Fallback to local copy
    try {
      console.log('[Services] Loading local fallback:', localUrl);
      const res = await fetch(localUrl, { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch (e) {
      console.error('[Services] Local fallback load failed:', e);
    }

    return null;
  }

  function renderServices(services) {
    // Clear grids first
    Object.values(grids).forEach(g => { if (g) g.innerHTML = ''; });

    services.forEach(item => {
      const gridId = typeMap[item.type];
      const grid = document.getElementById(gridId);
      if (!grid) return;

      const li = document.createElement('li');
      li.className = 'project-item active';

      if (item.type === 2) {
        li.setAttribute('data-service-id', item.id);
        li.setAttribute('data-locations', item.coverage || '');
      }

      const tagsHtml = (item.tags || []).map(t => `<span class="project-tag">${esc(t)}</span>`).join('');
      const coverageHtml = item.type === 2 ? `
        <div class="location-coverage" style="font-size: 0.85rem; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
          <svg style="width: 14px; height: 14px; opacity: 0.8; flex-shrink: 0;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          <span><strong>Coverage:</strong> ${esc(item.coverage || '')}</span>
        </div>` : '';

      li.innerHTML = `
        <div class="macos-location-card">
          <img class="service-card-img" src="${esc(item.image || '')}" alt="${esc(item.title || '')}" />
          <div>
            <h4 class="location-title">${esc(item.title || '')}</h4>
            <span class="location-distance">${esc(item.subtitle || '')}</span>
            <p class="location-desc">${esc(item.description || '')}</p>
            ${coverageHtml}
          </div>
          <div class="location-footer">
            <span><strong>Price:</strong> ${esc(item.price || '')}</span>
            <div class="location-tags">
              ${tagsHtml}
            </div>
          </div>
        </div>
      `;
      grid.appendChild(li);
    });
  }

  function handleQueryParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const serviceParam = urlParams.get('service') || urlParams.get('provider');
    const locationParam = urlParams.get('location');

    if (serviceParam) {
      selectTab('transport');

      const targetId = serviceParam.toLowerCase().trim().replace(/_/g, '-');
      const card = document.querySelector(`#transport-grid li[data-service-id="${targetId}"]`);
      
      if (card) {
        card.classList.add('highlight-card');
        
        setTimeout(() => {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);

        setTimeout(() => {
          card.classList.remove('highlight-card');
        }, 6000);
      }
    } else if (locationParam) {
      selectTab('transport');

      const normalizedLoc = locationParam.toLowerCase().trim().replace(/[-_]/g, ' ');
      const cards = document.querySelectorAll('#transport-grid li');

      cards.forEach(card => {
        const locationsAttr = card.getAttribute('data-locations');
        if (locationsAttr) {
          const locsList = locationsAttr.split(',').map(l => l.toLowerCase().trim());
          const isMatch = locsList.some(loc => 
            loc === normalizedLoc || 
            loc.includes(normalizedLoc) || 
            normalizedLoc.includes(loc)
          );

          if (isMatch) {
            card.style.opacity = '1';
            card.style.transform = 'scale(1.02)';
            card.style.transition = 'all 0.3s ease';
            
            const desc = card.querySelector('.location-desc');
            if (desc && !card.querySelector('.location-card-badge')) {
              const badge = document.createElement('span');
              badge.className = 'location-card-badge';
              badge.textContent = `✓ Supports ${locationParam}`;
              desc.parentNode.insertBefore(badge, desc.nextSibling);
            }
          } else {
            card.style.opacity = '0.4';
            card.style.transition = 'all 0.3s ease';
          }
        }
      });
    }
  }

  async function init() {
    bindTabs();

    // Show loading spinner
    Object.values(grids).forEach(g => {
      if (g) {
        g.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-secondary);">
            <div style="margin: 0 auto 16px auto; width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite;"></div>
            Loading services...
          </div>
        `;
      }
    });

    const services = await fetchServices();
    if (services) {
      renderServices(services);
      handleQueryParams();
    } else {
      Object.values(grids).forEach(g => {
        if (g) {
          g.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #f87171;">
              Failed to load services. Please refresh or try again later.
            </div>
          `;
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
