(function () {
  'use strict';

  const WA = (DKUT.CONFIG && DKUT.CONFIG.SITE && DKUT.CONFIG.SITE.whatsapp) || '254700000000';
  let selectedType = 'listing';
  let submitting = false;

  function selectType(type) {
    selectedType = type;
    document.querySelectorAll('.type-card').forEach(c => c.classList.toggle('selected', c.dataset.type === type));
    document.querySelectorAll('.dynamic-fields').forEach(el => el.classList.remove('visible'));
    const dyn = document.getElementById('fields-' + (type === 'scam' ? 'listing' : type));
    if (dyn) dyn.classList.add('visible');
    const card = document.querySelector(`.type-card[data-type="${type}"]`);
    const heading = document.getElementById('form-heading');
    if (heading && card) heading.textContent = card.querySelector('h4')?.textContent || 'Report Issue';
    updateWhatsApp();
  }

  function updateWhatsApp() {
    const btn = document.getElementById('wa-fallback-btn');
    if (!btn) return;
    const title = document.getElementById('issue-title')?.value || selectedType + ' issue';
    const desc = document.getElementById('issue-description')?.value || '';
    const msg = encodeURIComponent(`[DKUT Hostels Report]\nType: ${selectedType}\nTitle: ${title}\nDescription: ${desc}\nURL: ${location.href}`);
    btn.href = `https://wa.me/${WA}?text=${msg}`;
  }

  function showStatus(msg, type) {
    const el = document.getElementById('report-status');
    if (!el) return;
    el.hidden = false;
    el.className = 'form-status ' + type;
    el.textContent = msg;
  }

  function bind() {
    document.querySelectorAll('.type-card').forEach(card => {
      card.addEventListener('click', () => selectType(card.dataset.type));
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectType(card.dataset.type); }
      });
    });

    ['issue-title', 'issue-description'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', updateWhatsApp);
    });

    document.getElementById('report-issue-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      if (submitting) return;

      const title = DKUT.security.sanitizeInput(document.getElementById('issue-title')?.value || '');
      const description = DKUT.security.sanitizeInput(document.getElementById('issue-description')?.value || '', 2000);
      const contact = DKUT.security.sanitizeInput(document.getElementById('issue-contact')?.value || '');

      if (title.length < 5) { showStatus('Title must be at least 5 characters.', 'error'); return; }
      if (description.length < 20) { showStatus('Description must be at least 20 characters.', 'error'); return; }
      if (contact && !DKUT.security.isValidEmail(contact)) { showStatus('Invalid email address.', 'error'); return; }

      const report = {
        type: selectedType,
        title,
        description,
        contact: contact || null,
        hostelRef: DKUT.security.sanitizeInput(document.getElementById('hostel-ref')?.value || ''),
        url: location.href,
        timestamp: new Date().toISOString(),
      };

      submitting = true;
      const btn = document.getElementById('submit-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

      let ok = false;
      if (DKUT.db) {
        try {
          await DKUT.db.collection('websiteIssues').add(report);
          ok = true;
        } catch (_) {}
      }

      submitting = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Submit Report'; }

      if (ok) {
        document.getElementById('report-form-section').innerHTML = `
          <div style="text-align:center;padding:20px;">
            <div style="font-size:3rem;color:#0bda83;margin-bottom:16px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width: 48px; height: 48px; margin: 0 auto;"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
            <h3 style="color:#d5d0e8;">Report Submitted</h3>
            <p class="quickstart-note">Thank you! We'll review within 24 hours.</p>
            <a href="../../pages/home/" class="macos-download-btn" style="display:inline-flex;margin-top:16px;font-size:0.85rem;padding:12px 24px;">Back to Listings</a>
          </div>`;
      } else {
        showStatus('Database unavailable. Use the WhatsApp link below.', 'error');
        updateWhatsApp();
      }
    });

    updateWhatsApp();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
