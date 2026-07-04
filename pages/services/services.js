(function () {
  'use strict';

  function bindTabs() {
    const tabs = document.querySelectorAll('.service-tab-btn');
    const grids = {
      wifi: document.getElementById('wifi-grid'),
      transport: document.getElementById('transport-grid'),
      cleaning: document.getElementById('cleaning-grid')
    };

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        
        // Update active tab button
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Toggle visibility of grids
        Object.keys(grids).forEach(k => {
          if (grids[k]) {
            grids[k].style.display = (k === target) ? 'grid' : 'none';
          }
        });
      });
    });
  }

  function init() {
    bindTabs();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
