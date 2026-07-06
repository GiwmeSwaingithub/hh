(function () {
  'use strict';

  let grids = {};
  let tabs = [];

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

  function handleQueryParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const serviceParam = urlParams.get('service') || urlParams.get('provider');
    const locationParam = urlParams.get('location');

    if (serviceParam) {
      // Ensure we switch to transport grid
      selectTab('transport');

      const targetId = serviceParam.toLowerCase().trim().replace(/_/g, '-');
      const card = document.querySelector(`#transport-grid li[data-service-id="${targetId}"]`);
      
      if (card) {
        // Apply highlight class
        card.classList.add('highlight-card');
        
        // Scroll to card after DOM settles
        setTimeout(() => {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);

        // Remove the pulsing effect after 6 seconds
        setTimeout(() => {
          card.classList.remove('highlight-card');
        }, 6000);
      }
    } else if (locationParam) {
      // Ensure we switch to transport grid
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
            // Keep fully visible and highlighted
            card.style.opacity = '1';
            card.style.transform = 'scale(1.02)';
            card.style.transition = 'all 0.3s ease';
            
            // Add a badge under the description if not already added
            const desc = card.querySelector('.location-desc');
            if (desc && !card.querySelector('.location-card-badge')) {
              const badge = document.createElement('span');
              badge.className = 'location-card-badge';
              badge.textContent = `✓ Supports ${locationParam}`;
              desc.parentNode.insertBefore(badge, desc.nextSibling);
            }
          } else {
            // Dim non-matching transport services
            card.style.opacity = '0.4';
            card.style.transition = 'all 0.3s ease';
          }
        }
      });
    }
  }

  function init() {
    bindTabs();
    handleQueryParams();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
