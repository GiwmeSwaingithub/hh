(function () {
  'use strict';

  const esc = s => (window.DKUT?.security && window.DKUT.security.escapeHtml) ? window.DKUT.security.escapeHtml(s) : String(s || '');
  const WA_NUMBER = (window.DKUT?.CONFIG?.SITE?.whatsapp) || '254769486775';
  const WA_URL = 'https://wa.me/' + WA_NUMBER;

  function normalizePhone(raw) {
    if (window.DKUT?.security?.normalizePhone) return window.DKUT.security.normalizePhone(raw);
    const c = String(raw).replace(/[^\d+]/g, '');
    if (c.startsWith('0') && c.length === 10) return '254' + c.slice(1);
    if (c.startsWith('+254')) return c.slice(1);
    if (c.startsWith('254') && c.length === 12) return c;
    return c.replace(/\+/g, '');
  }

  function isValidKenyanPhone(p) {
    return /^254[17]\d{8}$/.test(normalizePhone(p));
  }

  function maskPhone(n) {
    if (!n || n.length < 6) return n;
    return n.slice(0, 4) + '*'.repeat(Math.max(0, n.length - 8)) + n.slice(-4);
  }

  function sanitizeInput(s, m) {
    if (!s) return '';
    let t = String(s).replace(/<[^>]*>/g, '').trim();
    if (m && t.length > m) t = t.slice(0, m);
    return t;
  }

  function showToast(msg, type) {
    if (typeof Toastify === 'function') {
      Toastify({
        text: msg,
        duration: 4000,
        close: true,
        gravity: 'top',
        position: 'right',
        style: {
          background: type === 'error' ? 'rgba(255,59,48,0.9)' : type === 'success' ? 'rgba(76,175,80,0.9)' : 'rgba(124,77,255,0.9)',
          borderRadius: '12px',
          fontFamily: 'inherit'
        }
      }).showToast();
    }
  }

  // --- Lexical Scope Variables for DOM Elements ---
  let modeChips;
  let panels = {};
  let currentMode = 'report';
  let selectedReportMethod = 'anonymous';
  let methodChips, formContainer, waContainer;
  let imageInput, attachPreview, cameraBtn, sendAnonBtn, anonMsgBox;
  let wallLoadMoreBtn, wallLoadingSpinner, wallList;

  function setMode(mode) {
    if (modeChips) {
      modeChips.forEach(c => c.classList.remove('selected'));
    }
    const selectedBtn = document.querySelector(`.mode-chip[data-mode="${mode}"]`);
    if (selectedBtn) selectedBtn.classList.add('selected');
    
    Object.keys(panels).forEach(k => {
      if (panels[k]) {
        panels[k].style.display = (k === mode) ? '' : 'none';
      }
    });
    currentMode = mode;
    if (mode === 'check') {
      loadAlerts();
    } else if (mode === 'chat') {
      loadWall();
    }
  }

  // --- Check Scammer Panel ---
  async function checkPhone(phone) {
    const res = document.getElementById('checker-result');
    if (!res) return;
    res.hidden = false;

    if (!phone || !isValidKenyanPhone(phone)) {
      res.className = 'checker-result flagged';
      res.innerHTML = '<strong>Warning: Invalid number.</strong> Enter a valid Kenyan phone (e.g. 0712345678).';
      return;
    }

    const norm = normalizePhone(phone);
    let reports = [];
    if (window.DKUT?.db) {
      try {
        const snap = await window.DKUT.db.collection('scamReports').where('phoneNumber', '==', norm).get();
        snap.forEach(doc => reports.push(doc.data()));
      } catch (_) {}
    }

    if (!reports.length) {
      res.className = 'checker-result clean';
      res.innerHTML = `<strong>Success: Not in database.</strong> No reports for <strong>${esc(maskPhone(norm))}</strong>.`;
    } else {
      res.className = 'checker-result flagged';
      res.innerHTML = `<strong>Warning: ${reports.length} report(s) found</strong> for <strong>${esc(maskPhone(norm))}</strong>.`;
    }
  }

  async function loadAlerts() {
    const grid = document.getElementById('scam-grid');
    if (!grid) return;
    let items = [];

    if (window.DKUT?.db) {
      try {
        const snap = await window.DKUT.db.collection('scamReports').orderBy('timestamp', 'desc').limit(20).get();
        snap.forEach(doc => items.push(doc.data()));
      } catch (_) {}
    }

    if (!items.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted);">No verified alerts yet.</div>';
      return;
    }

    grid.innerHTML = items.map(r => `
      <div class="scam-card">
        <h4>Phone: ${esc(maskPhone(r.phoneNumber || ''))}</h4>
        <p>${esc((r.description || '').slice(0, 120))}</p>
        ${r.hostelAffected ? `<p style="margin-top:6px;font-size:0.72rem;color:#cf30aa;">Hostel: ${esc(r.hostelAffected)}</p>` : ''}
        <p style="font-size:0.68rem;color:var(--text-muted);margin-top:6px;">${r.method === 'whatsapp' ? 'WhatsApp' : 'Anonymous'} · ${moment(r.timestamp).fromNow()}</p>
      </div>
    `).join('');
  }

  // --- Anonymous Chat Panel (TwetLink Flow) ---
  const username = "dekutconnect";
  const profileImg = "https://cdn.twet.link/profile/img/2025/09/07/SBhXu07249.jpg";
  let attachedImages = []; // Stores local raw base64 dataUrls
  let lastId = -1;
  let isSendingMsg = false;

  function renderAttachedImages() {
    if (!attachPreview) return;
    if (attachedImages.length > 0) {
      attachPreview.style.display = 'flex';
      attachPreview.innerHTML = attachedImages.map((img, i) => `
        <div class="img-thumb" style="background-image:url('${esc(img)}');">
          <div class="remove-img" data-idx="${i}">&times;</div>
        </div>
      `).join('');

      document.querySelectorAll('.remove-img').forEach(b => {
        b.addEventListener('click', function() {
          attachedImages = [];
          renderAttachedImages();
          updateAnonSendBtn();
        });
      });
      if (cameraBtn) cameraBtn.style.display = 'none';
    } else {
      attachPreview.style.display = 'none';
      attachPreview.innerHTML = '';
      if (cameraBtn) cameraBtn.style.display = 'inline-flex';
    }
  }

  function updateAnonSendBtn() {
    if (!sendAnonBtn || !anonMsgBox) return;
    const txt = anonMsgBox.value.trim();
    sendAnonBtn.disabled = !(txt.length >= 1 || attachedImages.length > 0);
  }

  const fakeQuestions = [
    "a secret you kept from your parents",
    "any pets?",
    "are you close with your parents?",
    "are you looking to date someone right now",
    "are you talking to anyone?",
    "favorite movie or tv series",
    "biggest regret?",
    "dream job?",
    "favorite food?",
    "I have a crush on you",
    "do you love your life",
    "introvert or extrovert?",
    "one thing you can't survive without?",
    "Your biggest fear?",
    "personality or looks?",
    "single?",
    "spill some tea",
    "we should talk more",
    "what music do you listen to",
    "what was the best day so far this year?"
  ];

  function resetAnonState() {
    if (anonMsgBox) anonMsgBox.value = '';
    attachedImages = [];
    renderAttachedImages();
  }

  window.resetAnonForm = function() {
    resetAnonState();
    document.getElementById('anon-success-screen').style.display = 'none';
    document.getElementById('anon-msg-card').style.display = 'block';
    document.getElementById('anon-wall-card').style.display = 'block';
    updateAnonSendBtn();
    loadWall();
  };

  // --- Message Wall (TwetLink Wall Loading) ---
  async function loadWall(append = false) {
    if (!append) {
      lastId = -1;
      if (wallList) wallList.innerHTML = '';
    }

    if (wallLoadingSpinner) wallLoadingSpinner.style.display = 'block';
    if (wallLoadMoreBtn) wallLoadMoreBtn.style.display = 'none';

    try {
      const res = await $.ajax({
        url: '/api/getWall',
        type: "POST",
        data: JSON.stringify({
          username: username,
          lastId: lastId
        }),
        contentType: 'application/json'
      });

      if (wallLoadingSpinner) wallLoadingSpinner.style.display = 'none';
      
      const wall = res.wall;
      const wallElem = document.getElementById('anon-wall-card');
      
      if (wall && wall.length > 0) {
        if (wallElem) wallElem.style.display = 'block';
        
        for (let i = 0; i < wall.length; i++) {
          const element = wall[i];
          const time = moment(element.createdTime).fromNow();
          
          let imageUrl = null;
          if (element.images) {
            if (Array.isArray(element.images) && element.images.length > 0) {
              imageUrl = element.images[0];
            } else if (typeof element.images === 'string') {
              try {
                const parsed = JSON.parse(element.images);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  imageUrl = parsed[0];
                } else {
                  imageUrl = element.images;
                }
              } catch (_) {
                imageUrl = element.images;
              }
            }
          } else if (element.image) {
            imageUrl = element.image;
          }

          const imageHtml = imageUrl ? `
            <div class="msg-image" style="margin-top: 10px;">
              <img src="${imageUrl}" style="max-width: 100%; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
            </div>
          ` : "";

          const cardHtml = `
            <div class="default-answer ans-item">
              <div class="pinfo">
                <div class="pic" style="background-image: url('${profileImg}');"></div>
                <div class="col">
                  <span class="question">${esc(element.questionText) || 'Anonymous Message'}</span>
                  <span class="timeago">${time}</span>
                </div>
              </div>
              <div class="msg">
                <span class="text">${esc(element.text)}</span>
                ${imageHtml}
              </div>
              ${element.reply ? `
                <div class="reply">
                  <span class="text">${esc(element.reply)}</span>
                </div>
              ` : ''}
            </div>
          `;

          if (wallList) {
            wallList.insertAdjacentHTML('beforeend', cardHtml);
          }
          
          if (i === wall.length - 1) {
            lastId = element.id;
          }
        }

        if (wall.length >= 10 && wallLoadMoreBtn) {
          wallLoadMoreBtn.style.display = 'block';
        }
      } else {
        if (!append && wallElem) {
          wallElem.style.display = 'none';
        }
      }

    } catch (err) {
      console.error(err);
      if (wallLoadingSpinner) wallLoadingSpinner.style.display = 'none';
    }
  }

  // Last seen text updater
  function updateLastSeen() {
    const textEl = document.getElementById('lastseen-text');
    if (textEl) {
      textEl.textContent = 'Last seen ' + (Math.floor(Math.random() * 45) + 1) + ' minutes ago';
    }
  }
  
  // Resize Image helper
  function resizeImage(inputFile, maxWidth, maxHeight, callback) {
    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.src = event.target.result;
      img.onload = function() {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        const resizedDataUrl = canvas.toDataURL('image/jpeg');
        callback(resizedDataUrl);
      };
    };
    if (inputFile) {
      reader.readAsDataURL(inputFile);
    }
  }

  // Initialize
  async function init() {
    // 1. Query DOM elements
    modeChips = document.querySelectorAll('.mode-chip');
    panels = {
      report: document.getElementById('panel-report'),
      chat: document.getElementById('panel-chat'),
      check: document.getElementById('panel-check')
    };

    methodChips = document.querySelectorAll('#report-method-chips .chip');
    formContainer = document.getElementById('report-form-container');
    waContainer = document.getElementById('report-whatsapp-container');

    imageInput = document.getElementById('imageInput');
    attachPreview = document.getElementById('attach-preview');
    cameraBtn = document.getElementById('cameraBtn');
    sendAnonBtn = document.getElementById('sendAnonBtn');
    anonMsgBox = document.getElementById('anon-msg-box');

    wallLoadMoreBtn = document.getElementById('wall-load-more-btn');
    wallLoadingSpinner = document.getElementById('wall-loading');
    wallList = document.querySelector('.wall-list');

    // 2. Attach Event Listeners
    if (modeChips) {
      modeChips.forEach(chip => {
        chip.addEventListener('click', function() {
          setMode(this.dataset.mode);
        });
      });
    }

    if (methodChips) {
      methodChips.forEach(chip => {
        chip.addEventListener('click', function() {
          methodChips.forEach(c => c.classList.remove('selected'));
          this.classList.add('selected');
          selectedReportMethod = this.dataset.method;
          if (selectedReportMethod === 'whatsapp') {
            if (formContainer) formContainer.style.display = 'none';
            if (waContainer) waContainer.style.display = 'block';
          } else {
            if (formContainer) formContainer.style.display = 'block';
            if (waContainer) waContainer.style.display = 'none';
          }
        });
      });
    }

    document.getElementById('whatsapp-direct-btn')?.addEventListener('click', function() {
      window.open(WA_URL, '_blank');
    });

    document.getElementById('scam-form')?.addEventListener('submit', async function(e) {
      e.preventDefault();
      const status = document.getElementById('scam-status');
      if (!status) return;
      
      const phoneInput = document.getElementById('scam-phone');
      const descInput = document.getElementById('scam-desc');
      const hostelInput = document.getElementById('scam-hostel');
      
      const phone = phoneInput ? phoneInput.value.trim() : '';
      const desc = descInput ? descInput.value.trim() : '';
      const hostel = hostelInput ? hostelInput.value.trim() : '';

      if (!isValidKenyanPhone(phone)) {
        status.hidden = false;
        status.className = 'form-status error';
        status.textContent = 'Warning: Enter a valid Kenyan phone number.';
        return;
      }
      if (desc.length < 20) {
        status.hidden = false;
        status.className = 'form-status error';
        status.textContent = 'Warning: Please provide more detail (at least 20 characters).';
        return;
      }

      const norm = normalizePhone(phone);
      const report = {
        phoneNumber: norm,
        description: sanitizeInput(desc, 2000),
        hostelAffected: sanitizeInput(hostel, 200),
        timestamp: new Date().toISOString(),
        status: 'pending',
        method: 'anonymous'
      };

      let ok = false;
      if (window.DKUT?.db) {
        try {
          await window.DKUT.db.collection('scamReports').add(report);
          ok = true;
        } catch (_) {}
      }

      if (ok) {
        status.hidden = false;
        status.className = 'form-status success';
        status.textContent = 'Success: Report submitted anonymously.';
        this.reset();
        loadAlerts();
      } else {
        const msg = encodeURIComponent(`[DKUT Scam Report]\nPhone: ${phone}\nHostel: ${hostel}\nDetails: ${desc}`);
        window.open(`${WA_URL}?text=${msg}`, '_blank');
        status.hidden = false;
        status.className = 'form-status error';
        status.textContent = 'Database unavailable. Opened WhatsApp fallback - please send your report there.';
      }
    });

    document.getElementById('checker-btn')?.addEventListener('click', function() {
      const v = document.getElementById('checker-phone')?.value.trim();
      checkPhone(v);
    });

    cameraBtn?.addEventListener('click', () => {
      if (attachedImages.length >= 1) return;
      imageInput?.click();
    });

    imageInput?.addEventListener('change', function() {
      const file = this.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        showToast('Selected file must be an image', 'error');
        return;
      }

      resizeImage(file, 700, 700, (base64) => {
        attachedImages = [base64];
        renderAttachedImages();
        updateAnonSendBtn();
      });
      this.value = '';
    });

    anonMsgBox?.addEventListener('input', updateAnonSendBtn);

    sendAnonBtn?.addEventListener('click', async function() {
      if (isSendingMsg) return;
      const txt = anonMsgBox ? anonMsgBox.value.trim() : '';

      if (txt.length < 1 && attachedImages.length === 0) {
        showToast('Type a message or attach a photo', 'error');
        return;
      }

      isSendingMsg = true;
      sendAnonBtn.classList.add('loading');
      sendAnonBtn.disabled = true;

      try {
        let finalImages = [];
        if (attachedImages.length > 0) {
          const cleanBase64 = attachedImages[0].replace(/^data:image\/[a-z]+;base64,/, "");
          
          const uploadRes = await $.ajax({
            url: '/api/uploadImage',
            type: "POST",
            data: JSON.stringify({ image: cleanBase64 }),
            contentType: 'application/json'
          });
          
          if (uploadRes && uploadRes.imageUrl) {
            finalImages.push(uploadRes.imageUrl);
          }
        }

        await $.ajax({
          url: '/api/sendMsg',
          type: "POST",
          data: JSON.stringify({
            msg: txt,
            username: username,
            qid: "",
            images: finalImages
          }),
          contentType: 'application/json'
        });

        document.getElementById('anon-msg-card').style.display = 'none';
        document.getElementById('anon-wall-card').style.display = 'none';
        document.getElementById('anon-success-screen').style.display = 'block';
        showToast('Message sent anonymously!', 'success');
        resetAnonState();

      } catch (err) {
        console.error(err);
        showToast('Error, please try again', 'error');
      } finally {
        isSendingMsg = false;
        sendAnonBtn.classList.remove('loading');
        updateAnonSendBtn();
      }
    });

    if (wallLoadMoreBtn) {
      wallLoadMoreBtn.addEventListener('click', () => loadWall(true));
    }

    // 3. Last seen updater setup
    updateLastSeen();
    setInterval(updateLastSeen, 60000);

    // 4. Set Initial State
    setMode('report');
    updateAnonSendBtn();
    loadAlerts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
