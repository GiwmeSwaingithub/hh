(function () {
  'use strict';

  // Toggle active tab panel inside each location card
  window.switchLocationTab = function(event, cardId, tab) {
    event.stopPropagation(); // prevent card container clicks

    const card = document.getElementById(cardId);
    if (!card) return;

    // Toggle panels
    ['info', 'photos', 'video', 'map'].forEach(t => {
      const panel = card.querySelector('.tab-content-' + t);
      if (panel) {
        panel.style.display = (t === tab) ? 'flex' : 'none';
      }
    });

    // Toggle active classes on tab buttons
    const btns = card.querySelectorAll('.location-mode-switch .tab-btn');
    btns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
  };

  // Clear search state and set location filter in sessionStorage when clicking location cards
  window.selectLocation = function (locId) {
    try {
      sessionStorage.setItem('dkut_home_state', JSON.stringify({
        filters: { query: '', location: locId, gender: 'all', sort: 'id-asc', accessibility: 'all' },
        page: 1,
        scroll: 0
      }));
    } catch (_) {}
    location.href = '../home/index.html?loc=' + locId;
  };
})();
