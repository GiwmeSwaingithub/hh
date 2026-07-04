(function () {
  'use strict';

  const esc = s => (DKUT.app && DKUT.app.esc) ? DKUT.app.esc(s) : String(s || '');
  const WA = (DKUT.CONFIG && DKUT.CONFIG.SITE && DKUT.CONFIG.SITE.whatsapp) || '254700000000';

  // ── Theme / Accent Controls ──
  function initThemeCustomizer() {
    const themeOpts = document.querySelectorAll('[data-theme-opt]');
    const accentSelector = document.getElementById('accent-selector');
    
    if (!DKUT.app) return;

    const currentTheme = DKUT.app.getTheme();
    const currentAccent = DKUT.app.getAccent();

    // Set initial theme buttons active state
    themeOpts.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeOpt === currentTheme);
      btn.addEventListener('click', () => {
        const theme = btn.dataset.themeOpt;
        DKUT.app.setTheme(theme);
        themeOpts.forEach(b => b.classList.toggle('active', b.dataset.themeOpt === theme));
        if (DKUT.app.showToast) {
          DKUT.app.showToast(`Theme changed to ${theme}`, 'info', 2000);
        }
      });
    });

    // Set initial accent dots active state
    if (accentSelector) {
      const dots = accentSelector.querySelectorAll('[data-accent-opt]');
      dots.forEach(dot => {
        dot.classList.toggle('active', dot.dataset.accentOpt === currentAccent);
        dot.addEventListener('click', () => {
          const accent = dot.dataset.accentOpt;
          DKUT.app.setAccent(accent);
          dots.forEach(d => d.classList.toggle('active', d.dataset.accentOpt === accent));
          if (DKUT.app.showToast) {
            DKUT.app.showToast(`Accent color updated`, 'success', 2000);
          }
        });
      });
    }
  }

  // ── Text to Speech (TTS) System ──
  let speechNodes = [];
  let currentSpeechIndex = -1;
  let synth = window.speechSynthesis;
  let currentUtterance = null;
  let isSpeaking = false;
  let isPaused = false;

  function initSpeechReader() {
    const playBtn = document.getElementById('tts-play-btn');
    const pauseBtn = document.getElementById('tts-pause-btn');
    const stopBtn = document.getElementById('tts-stop-btn');
    const rateSelect = document.getElementById('tts-rate');
    const container = document.getElementById('tts-read-container');
    const playerWrapper = document.getElementById('tts-player-wrapper');

    if (!synth || !container) {
      // Hide speech player if not supported in browser
      if (playerWrapper) playerWrapper.style.display = 'none';
      return;
    }

    // Collect all elements with the class 'read-node'
    speechNodes = Array.from(container.querySelectorAll('.read-node'));

    function clearHighlights() {
      speechNodes.forEach(node => node.classList.remove('speech-active-node'));
    }

    function resetPlayerState() {
      clearHighlights();
      isSpeaking = false;
      isPaused = false;
      currentSpeechIndex = -1;
      if (playBtn) playBtn.textContent = 'Play';
      if (pauseBtn) {
        pauseBtn.disabled = true;
        pauseBtn.textContent = 'Pause';
      }
      if (stopBtn) stopBtn.disabled = true;
    }

    function speakNode(index) {
      if (index < 0 || index >= speechNodes.length) {
        resetPlayerState();
        return;
      }

      currentSpeechIndex = index;
      clearHighlights();

      const activeNode = speechNodes[index];
      activeNode.classList.add('speech-active-node');
      activeNode.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Clean text content for cleaner audio reading
      const text = activeNode.textContent.trim().replace(/\s+/g, ' ');

      currentUtterance = new SpeechSynthesisUtterance(text);
      currentUtterance.rate = parseFloat(rateSelect.value || '1.0');
      
      // Select voice: default or local English
      const voices = synth.getVoices();
      const engVoice = voices.find(v => v.lang.startsWith('en-'));
      if (engVoice) currentUtterance.voice = engVoice;

      currentUtterance.onend = function () {
        if (isSpeaking && !isPaused) {
          speakNode(index + 1);
        }
      };

      currentUtterance.onerror = function (e) {
        console.error('[TTS Speech Error]', e);
        resetPlayerState();
      };

      synth.speak(currentUtterance);
    }

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (isPaused) {
          // Resume paused speech
          synth.resume();
          isPaused = false;
          isSpeaking = true;
          playBtn.textContent = 'Playing...';
          if (pauseBtn) pauseBtn.disabled = false;
          if (stopBtn) stopBtn.disabled = false;
        } else if (!isSpeaking) {
          // Start from first paragraph
          synth.cancel();
          isSpeaking = true;
          isPaused = false;
          playBtn.textContent = 'Playing...';
          if (pauseBtn) pauseBtn.disabled = false;
          if (stopBtn) stopBtn.disabled = false;
          speakNode(0);
        }
      });
    }

    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        if (isSpeaking && !isPaused) {
          synth.pause();
          isPaused = true;
          pauseBtn.textContent = 'Resume';
          if (playBtn) playBtn.textContent = 'Play';
        } else if (isPaused) {
          synth.resume();
          isPaused = false;
          pauseBtn.textContent = 'Pause';
          if (playBtn) playBtn.textContent = 'Playing...';
        }
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        synth.cancel();
        resetPlayerState();
      });
    }

    if (rateSelect) {
      rateSelect.addEventListener('change', () => {
        if (isSpeaking) {
          synth.cancel();
          speakNode(currentSpeechIndex);
        }
      });
    }

    // Cancel speech if user navigates away or closes page
    window.addEventListener('beforeunload', () => {
      synth.cancel();
    });

    // Populate voices dynamically if loaded later
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = () => {};
    }
  }

  // ── Special Needs Request Form Submission ──
  function initRequestForm() {
    const form = document.getElementById('accessibility-request-form');
    const status = document.getElementById('req-status');

    if (!form) return;

    form.addEventListener('submit', async e => {
      e.preventDefault();
      status.hidden = false;
      status.className = 'form-status info';
      status.textContent = 'Submitting your request...';

      const name = document.getElementById('req-name').value.trim();
      const reg = document.getElementById('req-reg').value.trim();
      const phone = document.getElementById('req-phone').value.trim();
      const need = document.getElementById('req-need').value;
      const location = document.getElementById('req-location').value;
      const desc = document.getElementById('req-desc').value.trim();

      // Basic validations
      if (name.length < 3) {
        status.className = 'form-status error';
        status.textContent = 'Please enter your full name.';
        return;
      }
      if (desc.length < 15) {
        status.className = 'form-status error';
        status.textContent = 'Please provide details about your housing needs.';
        return;
      }

      const requestObj = {
        name: (DKUT.security && DKUT.security.sanitizeInput) ? DKUT.security.sanitizeInput(name) : name,
        registrationNumber: reg,
        phone: phone,
        specialNeedType: need,
        preferredLocation: location,
        requirements: (DKUT.security && DKUT.security.sanitizeInput) ? DKUT.security.sanitizeInput(desc) : desc,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };

      let success = false;
      if (DKUT.db) {
        try {
          await DKUT.db.collection('specialNeedsRequests').add(requestObj);
          success = true;
        } catch (err) {
          console.error('[Firebase Special Needs Error]', err);
        }
      }

      if (success) {
        status.className = 'form-status success';
        status.textContent = 'Accommodation request successfully submitted. The Directorate of Students\' Welfare will contact you.';
        form.reset();
      } else {
        // Fallback to WhatsApp support prefilled link if database fails or is offline
        const msgText = `[Special Needs Accommodation Request]\n` +
                        `Name: ${name}\n` +
                        `Reg No: ${reg}\n` +
                        `Phone: ${phone}\n` +
                        `Need Category: ${need}\n` +
                        `Preferred Area: ${location}\n` +
                        `Requirements: ${desc}`;
        
        const encMsg = encodeURIComponent(msgText);
        window.open(`https://wa.me/${WA}?text=${encMsg}`, '_blank');

        status.className = 'form-status success';
        status.textContent = 'Database offline. Prefilled request details opened in WhatsApp fallback support.';
      }
    });
  }

  function start() {
    initThemeCustomizer();
    initSpeechReader();
    initRequestForm();
  }

  function boot() {
    if (document.getElementById('accessibility-request-form')) {
      start();
    } else {
      document.addEventListener('dkut-layout-ready', start, { once: true });
      setTimeout(start, 500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
