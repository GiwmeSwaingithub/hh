(function () {
  'use strict';

  const esc = s => (DKUT.app && DKUT.app.esc) ? DKUT.app.esc(s) : (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const WA = (DKUT.CONFIG && DKUT.CONFIG.SITE && DKUT.CONFIG.SITE.whatsapp) || '254769486775';
  const WHATSAPP_URL = 'https://wa.me/' + WA;
  const username = "dekutconnect";
  const profileImg = "https://cdn.twet.link/profile/img/2025/09/07/SBhXu07249.jpg";

  let lastId = -1;
  let isSendingMsg = false;
  let selectedImageBase64 = null;
  const now = new Date();

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

  function isValidPhone(p) {
    if (DKUT.security && DKUT.security.isValidPhone) return DKUT.security.isValidPhone(p);
    return /^254[17]\d{8}$/.test(normalizePhone(p));
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
          background: type === 'error' ? 'rgba(255,59,48,0.9)' : type === 'success' ? 'rgba(76,175,80,0.9)' : 'rgba(11,218,131,0.9)',
          borderRadius: '12px',
          fontFamily: 'inherit'
        }
      }).showToast();
    } else {
      alert(msg);
    }
  }

  // --- Panels Toggle Logic ---
  const modeChips = document.querySelectorAll('.mode-chip');
  const panels = {
    report: document.getElementById('panel-report'),
    chat: document.getElementById('panel-chat'),
    check: document.getElementById('panel-check')
  };

  function setMode(mode) {
    modeChips.forEach(c => c.classList.remove('selected'));
    const activeChip = document.querySelector(`.mode-chip[data-mode="${mode}"]`);
    if (activeChip) activeChip.classList.add('selected');

    Object.keys(panels).forEach(k => {
      if (panels[k]) {
        panels[k].style.display = (k === mode) ? '' : 'none';
      }
    });

    if (mode === 'check') {
      loadAlerts();
    } else if (mode === 'chat') {
      loadWall();
    }
  }

  modeChips.forEach(chip => {
    chip.addEventListener('click', function () {
      setMode(this.dataset.mode);
    });
  });

  // --- Report Scam Form & WhatsApp Toggle ---
  let selectedReportMethod = 'anonymous';
  const methodChips = document.querySelectorAll('#report-method-chips .chip');
  const formContainer = document.getElementById('report-form-container');
  const waContainer = document.getElementById('report-whatsapp-container');

  methodChips.forEach(chip => {
    chip.addEventListener('click', function () {
      methodChips.forEach(c => c.classList.remove('selected'));
      this.classList.add('selected');
      selectedReportMethod = this.dataset.method;
      if (selectedReportMethod === 'whatsapp') {
        formContainer.style.display = 'none';
        waContainer.style.display = 'block';
      } else {
        formContainer.style.display = 'block';
        waContainer.style.display = 'none';
      }
    });
  });

  // WhatsApp direct button
  document.getElementById('whatsapp-direct-btn')?.addEventListener('click', function () {
    window.open(WHATSAPP_URL, '_blank');
  });

  // Phone checker & Firestore alerts
  async function checkPhone(phone) {
    const norm = normalizePhone(phone);
    const result = document.getElementById('checker-result');
    result.hidden = false;

    if (!isValidPhone(phone)) {
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

  // --- Anonymous Chat Logic ---
  const cameraBtn = document.getElementById('cameraBtn');
  const randomQuestionBtn = document.getElementById('randomQuestionBtn');
  const sendAnonBtn = document.getElementById('sendAnonBtn');
  const anonMsgBox = document.getElementById('anon-msg-box');
  const imageInput = document.getElementById('imageInput');
  const attachPreview = document.getElementById('attach-preview');
  const attachPreviewContainer = document.getElementById('attach-preview-container');

  const fakeQuestions = [
    "a secret you kept from your parents",
    "ain't no way",
    "any pets?",
    "are you a back seat driver?",
    "are you close with your parents?",
    "are you gonna get a tat",
    "are you judgemental",
    "are you looking to date someone rn",
    "are you straight?",
    "are you talking to anyone?",
    "Have you ever been fired from a job?",
    "Favorite movie/ tv series rn",
    "biggest red flags in a guy?",
    "biggest regret?",
    "body count?",
    "can we be besties",
    "craziest pickup line that worked?",
    "did you have an imaginary friend?",
    "did you watch game of thrones?",
    "do u have a dog?",
    "do you even like school?",
    "do you have a middle name?",
    "do you have any cute friends for me lmao",
    "do you have any piercings?",
    "do you have trust issues?",
    "do you love ur life? x",
    "do you meditate?",
    "do you snore?",
    "do you speak another language?",
    "do you want kids evenutally?",
    "dogs or cats?",
    "dont leave me on opened",
    "dream job?",
    "ever gone skinny dipping?",
    "everything ok?",
    "favorite food?",
    "favorite movie?",
    "favorite show rn?",
    "What is your shoe size?",
    "What's ur fav brand??",
    "I have a crush on you",
    "have any netflix recomendations??",
    "have any netlix recomendations?",
    "I have covid, any show recomendations?",
    "have u seen breaking bad",
    "have you done drugs",
    "have you ever cheated, you gotta be honest lol",
    "have you ever cried during a movie",
    "have you ever given a hickey?",
    "have you ever gotten in a fist fight?",
    "have you ever had any surgery",
    "have you ever watched harry potter?",
    "The weirdest trend you've done",
    "hottest sport?",
    "how are you feeling today",
    "How are you today",
    "how big of nerd are you 1 to 10",
    "how many exes do you have?",
    "how many hours of sleep you get last night?",
    "how many kids do you want to have",
    "how many stuffed animals you own?",
    "how old are you again?",
    "how old do u wanna be when u get married?",
    "how tall are u",
    "how tall are you??",
    "how tall r u",
    "i love uuuuuu!!",
    "i miss you",
    "i really like you",
    "Biggest red flags for a girl?",
    "introvert or extrovert?",
    "is it true???",
    "is ngl the best app tho",
    "I know what you did",
    "name all your exes",
    "netflix and chill?",
    "not gonna judge but why...",
    "one friend ur thankful for...",
    "one thing you can't survive without?",
    "opinion on birds?",
    "Your biggest fear?",
    "How's you day going ??!",
    "personality or looks?",
    "please give me pickup lines that always work",
    "should i be honest with you on here?",
    "shout me out",
    "single?",
    "snap?",
    "spill some tea",
    "spill the tea on your first kiss.",
    "tell me a funny joke",
    "tell me a random fact",
    "the longest time you've ever gone without showering?",
    "the most embarrassing thing you've ever done?",
    "the weirdest place you've ever gone to the bathroom?",
    "the weirdest thing you've ever eaten?",
    "the worst advice you've ever given?",
    "the worst date you've ever been on?",
    "the worst food you ever eaten?",
    "the worst pick up line you've ever heard?",
    "the worst trouble you go into as a kid?",
    "u busy this weekend?",
    "uh what did you eat for breakfast?",
    "we should talk more",
    "what are ur plans this weekend?",
    "what are you wearing?",
    "what color is your room?",
    "what did you dream about last night?",
    "what have you gotten detention for?",
    "what music do you listen to",
    "what phone do you have?",
    "what time did you fall asleep last night?",
    "what time do you usually go to bed?",
    "what was the best day so far this year?",
    "what was ur worst day ever",
    "what was your favorite show when you were a kid?",
    "whats in ur spotify top songs",
    "whats the last thing you ate?",
    "whats the stupidest thing you thought as a kid?",
    "whats ur fav book",
    "whats ur fav drink",
    "whats ur fav food",
    "whats ur fav movie"
  ];

  cameraBtn?.addEventListener('click', () => {
    imageInput.click();
  });

  imageInput?.addEventListener('change', function (e) {
    const file = e.currentTarget.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file.', 'error');
      return;
    }

    // Read and resize locally first
    resizeImage(file, 700, 700, (base64) => {
      selectedImageBase64 = base64;
      renderAttachedImage();
      updateAnonSendBtn();
    });
    imageInput.value = '';
  });

  function renderAttachedImage() {
    if (selectedImageBase64) {
      attachPreviewContainer.style.display = 'block';
      attachPreview.innerHTML = `
        <div class="img" style="background-image: url('${selectedImageBase64}');">
          <div class="remove-img-attach" id="remove-img-btn">
            <span>&times;</span>
          </div>
        </div>`;
      
      document.getElementById('remove-img-btn')?.addEventListener('click', () => {
        selectedImageBase64 = null;
        renderAttachedImage();
        updateAnonSendBtn();
      });
      cameraBtn.style.display = 'none';
    } else {
      attachPreviewContainer.style.display = 'none';
      attachPreview.innerHTML = '';
      cameraBtn.style.display = '';
    }
  }

  function updateAnonSendBtn() {
    if (!sendAnonBtn) return;
    const hasText = anonMsgBox.value.trim().length >= 1;
    const hasImage = !!selectedImageBase64;
    sendAnonBtn.disabled = !(hasText || hasImage);
  }

  anonMsgBox?.addEventListener('input', updateAnonSendBtn);

  randomQuestionBtn?.addEventListener('click', () => {
    const question = fakeQuestions[Math.floor(Math.random() * fakeQuestions.length)];
    if (question) {
      anonMsgBox.value = question;
      updateAnonSendBtn();
    }
  });

  sendAnonBtn?.addEventListener('click', async function () {
    const text = anonMsgBox.value.trim();
    if (text.length < 1 && !selectedImageBase64) {
      showToast('Type a message or attach a photo.', 'error');
      return;
    }

    isSendingMsg = true;
    sendAnonBtn.classList.add('loading');
    sendAnonBtn.disabled = true;

    try {
      let imageUrls = [];

      // Upload image to proxy if one is selected
      if (selectedImageBase64) {
        const cleanBase64 = selectedImageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
        
        const uploadRes = await $.ajax({
          url: '/api/web/uploadImage',
          type: "POST",
          data: JSON.stringify({ image: cleanBase64 }),
          contentType: 'application/json',
        });

        if (uploadRes && uploadRes.imageUrl) {
          imageUrls.push(uploadRes.imageUrl);
        }
      }

      // Send the message via proxy
      await $.ajax({
        url: '/api/web/sendMsg',
        type: "POST",
        data: JSON.stringify({
          msg: text,
          qid: "",
          username: username,
          images: imageUrls,
        }),
        contentType: 'application/json',
      });

      isSendingMsg = false;
      sendAnonBtn.classList.remove('loading');
      
      // Show success screen
      document.getElementById('anon-msg-card').style.display = 'none';
      document.getElementById('anon-success-screen').style.display = 'block';
      document.getElementById('anon-wall').style.display = 'none';
      
      showToast('Message sent anonymously!', 'success');

    } catch (err) {
      console.error(err);
      isSendingMsg = false;
      sendAnonBtn.classList.remove('loading');
      sendAnonBtn.disabled = false;
      showToast('Failed to send message. Please check your connection.', 'error');
    }
  });

  window.resetAnonForm = function () {
    anonMsgBox.value = '';
    selectedImageBase64 = null;
    renderAttachedImage();
    document.getElementById('anon-success-screen').style.display = 'none';
    document.getElementById('anon-msg-card').style.display = 'block';
    updateAnonSendBtn();
    loadWall();
  };

  // --- Wall Retrieval and Rendering ---
  function loadWall() {
    const wallElem = document.getElementById('anon-wall');
    const loadingElem = wallElem?.querySelector('.loading-wall');
    const listElem = wallElem?.querySelector('.wall-list');
    const loadMoreBtn = wallElem?.querySelector('.load-more');

    if (!wallElem || !listElem) return;

    if (lastId === -1) {
      listElem.innerHTML = '';
    }

    if (loadingElem) loadingElem.style.display = 'block';
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';

    $.ajax({
      url: '/api/web/getWall',
      type: "POST",
      data: JSON.stringify({
        username: username,
        lastId: lastId,
      }),
      contentType: 'application/json',
    }).done((data) => {
      if (loadingElem) loadingElem.style.display = 'none';
      
      const wall = data.wall;
      if (wall && wall.length > 0) {
        wallElem.style.display = 'block';

        wall.forEach((element) => {
          const time = moment(element.createdTime).from(now);
          
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
              } catch (e) {
                imageUrl = element.images;
              }
            }
          } else if (element.image) {
            imageUrl = element.image;
          }

          const imageHtml = imageUrl ? `
            <div class="msg-image" style="margin-top: 10px;">
              <img src="${imageUrl}" style="max-width: 100%; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
            </div>` : "";

          const replyHtml = element.reply ? `
            <div class="reply" style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px; font-size: 0.85rem; color: #b39ddb;">
              <span class="text">${esc(element.reply)}</span>
            </div>` : "";

          listElem.insertAdjacentHTML('beforeend', `
            <div class="default-answer ans-item">
              <div class="pinfo">
                <div class="pic" style="background: url('${profileImg}') no-repeat center; background-size: cover;"></div>
                <div class="col">
                  <span class="question">${esc(element.questionText || 'Anonymous Question')}</span>
                  <span class="timeago">${time}</span>
                </div>
              </div>
              <div class="msg">
                <span class="text">${esc(element.text)}</span>
                ${imageHtml}
                ${replyHtml}
              </div>
            </div>`);
          
          lastId = element.id;
        });

        if (wall.length >= 10) {
          if (loadMoreBtn) {
            loadMoreBtn.style.display = 'block';
            loadMoreBtn.onclick = loadWall;
          }
        }
      } else {
        if (lastId === -1) {
          wallElem.style.display = 'none';
        }
      }
    }).fail((err) => {
      console.error(err);
      if (loadingElem) loadingElem.style.display = 'none';
    });
  }

  // --- Image Resize Helper ---
  function resizeImage(inputFile, maxWidth, maxHeight, callback) {
    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new Image();
      img.src = event.target.result;
      img.onload = function () {
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

  function updateLastSeen() {
    const lastseenText = document.getElementById('lastseen-text');
    if (lastseenText) {
      lastseenText.textContent = 'Last seen ' + (Math.floor(Math.random() * 45) + 1) + ' minutes ago';
    }
  }

  // --- Bind Form (Scam Alerts form & phone checking) ---
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

      if (!isValidPhone(phone)) {
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
        description: (DKUT.security && DKUT.security.sanitizeInput) ? DKUT.security.sanitizeInput(desc, 2000) : desc,
        hostelAffected: (DKUT.security && DKUT.security.sanitizeInput) ? DKUT.security.sanitizeInput(hostel) : hostel,
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
    updateLastSeen();
    setInterval(updateLastSeen, 60000);
    setMode('report'); // Default mode
    await new Promise(r => setTimeout(r, 800));
    loadAlerts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
