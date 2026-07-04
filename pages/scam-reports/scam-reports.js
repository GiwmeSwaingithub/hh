(function () {
  'use strict';

  const esc = s => DKUT.app.esc(s);
  const WA = (DKUT.CONFIG && DKUT.CONFIG.SITE && DKUT.CONFIG.SITE.whatsapp) || '254700000000';

  function normalizePhone(raw) {
    if (DKUT.security && DKUT.security.normalizePhone) return DKUT.security.normalizePhone(raw);
    const c = String(raw).replace(/[^\d+]/g, '');
    if (c.startsWith('0')) return '254' + c.slice(1);
    if (c.startsWith('+254')) return c.slice(1);
    return c.replace('+', '');
  }

  function maskPhone(n) {
    if (!n || n.length < 6) return n;
    return n.slice(0, 4) + '*'.repeat(Math.max(0, n.length - 8)) + n.slice(-4);
  }

  async function checkPhone(phone) {
    const norm = normalizePhone(phone);
    const result = document.getElementById('checker-result');
    result.hidden = false;

    if (!DKUT.security || !DKUT.security.isValidPhone(phone)) {
      result.className = 'checker-result flagged';
      result.innerHTML = '<strong>Invalid number.</strong> Enter a valid Kenyan phone (e.g. 0712345678).';
      return;
    }

    let reports = [];
    if (DKUT.db) {
      try {
        const snap = await DKUT.db.collection('scamReports').where('phoneNumber', '==', norm).get();
        snap.forEach(doc => reports.push(doc.data()));
      } catch (_) {}
    }

    if (!reports.length) {
      result.className = 'checker-result clean';
      result.innerHTML = `<strong>Not in database.</strong> No reports for <strong>${esc(maskPhone(norm))}</strong>. Always verify in person before paying.`;
    } else {
      result.className = 'checker-result flagged';
      result.innerHTML = `<strong>Warning: ${reports.length} report(s) found</strong> for <strong>${esc(maskPhone(norm))}</strong>. Exercise caution.`;
    }
  }

  async function loadAlerts() {
    const grid = document.getElementById('scam-grid');
    let items = [];

    if (DKUT.db) {
      try {
        const snap = await DKUT.db.collection('scamReports').orderBy('timestamp', 'desc').limit(20).get();
        snap.forEach(doc => items.push(doc.data()));
      } catch (_) {}
    }

    if (!items.length) {
      grid.innerHTML = `
        <div class="scam-card" style="grid-column:1/-1;">
          <p>No verified alerts in database yet. Use the form above to report scams and help protect fellow students.</p>
        </div>`;
      return;
    }

    grid.innerHTML = items.map(r => `
      <div class="scam-card">
        <h4>${esc(maskPhone(r.phoneNumber || ''))}</h4>
        <p>${esc((r.description || '').slice(0, 120))}</p>
        ${r.hostelAffected ? `<p style="margin-top:8px;font-size:0.75rem;color:#cf30aa;">${esc(r.hostelAffected)}</p>` : ''}
      </div>
    `).join('');
  }

  function bindForm() {
    document.getElementById('checker-btn')?.addEventListener('click', () => {
      const v = document.getElementById('checker-phone').value;
      if (v) checkPhone(v);
    });

    document.getElementById('scam-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const status = document.getElementById('scam-status');
      const phone = document.getElementById('scam-phone').value.trim();
      const desc = document.getElementById('scam-desc').value.trim();
      const hostel = document.getElementById('scam-hostel').value.trim();

      if (!DKUT.security.isValidPhone(phone)) {
        status.hidden = false;
        status.className = 'form-status error';
        status.textContent = 'Enter a valid phone number.';
        return;
      }
      if (desc.length < 20) {
        status.hidden = false;
        status.className = 'form-status error';
        status.textContent = 'Please provide more detail (at least 20 characters).';
        return;
      }

      const report = {
        phoneNumber: normalizePhone(phone),
        description: DKUT.security.sanitizeInput(desc, 2000),
        hostelAffected: DKUT.security.sanitizeInput(hostel),
        timestamp: new Date().toISOString(),
        status: 'pending',
      };

      let ok = false;
      if (DKUT.db) {
        try {
          await DKUT.db.collection('scamReports').add(report);
          ok = true;
        } catch (_) {}
      }

      if (ok) {
        status.hidden = false;
        status.className = 'form-status success';
        status.textContent = 'Report submitted. Thank you for helping keep students safe.';
        e.target.reset();
        loadAlerts();
      } else {
        const msg = encodeURIComponent(`[DKUT Scam Report]\nPhone: ${phone}\nHostel: ${hostel}\nDetails: ${desc}`);
        window.open(`https://wa.me/${WA}?text=${msg}`, '_blank');
        status.hidden = false;
        status.className = 'form-status error';
        status.textContent = 'Database unavailable. Opened WhatsApp fallback — please send your report there.';
      }
    });
  }

  async function init() {
    bindForm();
    await new Promise(r => setTimeout(r, 800));
    loadAlerts();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
