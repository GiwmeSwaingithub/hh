(function () {
  'use strict';

  const esc = s => DKUT.app.esc(s);
  const stripPeriod = s => String(s || '').replace(/\/sem/i, '').replace(/\/night/i, '').replace(/\/month/i, '').replace(/\/day/i, '');

  function getId() {
    const raw = new URLSearchParams(location.search).get('h');
    if (!raw) return null;
    const id = parseInt(raw, 10);
    return isNaN(id) ? null : id;
  }

  function normalizePhone(phone) {
    const cleaned = String(phone).replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+254')) return cleaned.slice(1);
    if (cleaned.startsWith('0')) return '254' + cleaned.slice(1);
    if (cleaned.startsWith('254')) return cleaned;
    return cleaned;
  }

  function renderContact(hostel) {
    const container = document.getElementById('contact-buttons');
    const raw = hostel.contact || '';
    if (!raw.trim()) {
      container.innerHTML = '<p class="quickstart-note">No contact details available.</p>';
      return;
    }
    container.innerHTML = raw.split(',').map(p => p.trim()).filter(Boolean).map(phone => {
      const norm = normalizePhone(phone);
      return `
        <a class="enquire-btn" href="https://wa.me/${esc(norm)}" target="_blank" rel="noopener" style="width:100%;">
          <em>WhatsApp ${esc(phone)}</em><i>&#10095;&#10095;</i>
        </a>
        <a class="macos-download-btn" href="tel:+${esc(norm)}" style="font-size:0.85rem;padding:10px 18px;justify-content:center;">Call ${esc(phone)}</a>
      `;
    }).join('');
  }

  function setupLightbox() {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    document.getElementById('lightbox-close')?.addEventListener('click', () => lb.classList.remove('open'));
    lb?.addEventListener('click', e => { if (e.target === lb) lb.classList.remove('open'); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') lb.classList.remove('open'); });
    document.getElementById('gallery-grid')?.addEventListener('click', e => {
      const target = e.target;
      if (target.tagName === 'IMG') {
        img.src = target.src;
        img.alt = target.alt;
        lb.classList.add('open');
      }
    });
  }

  async function init() {
    const id = getId();
    if (id === null) {
      document.getElementById('loading-state').textContent = 'No hostel specified.';
      return;
    }

    let hostel;
    try {
      const all = await DKUT.app.fetchHostels();
      hostel = all.find(h => String(h.id) === String(id));
    } catch (err) {
      document.getElementById('loading-state').textContent = 'Failed to load hostel data.';
      return;
    }

    if (!hostel) {
      document.getElementById('loading-state').textContent = 'Hostel not found.';
      return;
    }

    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('hostel-content').hidden = false;
    document.title = (hostel.name || 'Hostel') + ' — DKUT Hostels';

    const topName = document.getElementById('topbar-hostel-name');
    if (topName) {
      topName.textContent = hostel.name || 'Hostel';
    }

    const imgs = (Array.isArray(hostel.images) ? hostel.images : [hostel.image]).filter(Boolean);
    const hero = document.getElementById('hero-img');
    if (hero && imgs[0]) { hero.src = imgs[0]; hero.alt = hostel.name; }

    document.getElementById('hostel-name').textContent = hostel.name || 'Hostel';
    const locEl = document.getElementById('hostel-location');
    if (locEl) {
      const locUrl = DKUT.app.homeLocationUrl ? DKUT.app.homeLocationUrl(hostel.location) : `../home/index.html?loc=${encodeURIComponent(String(hostel.location || '').toLowerCase().trim().replace(/\s+/g, '-'))}`;
      locEl.innerHTML = `<a href="${esc(locUrl)}" class="hostel-location-link" style="color:var(--accent); text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        ${esc(hostel.location || '')}
      </a>`;
    }
    document.getElementById('hostel-description').textContent = hostel.description || '';
    document.getElementById('hostel-coords').textContent = hostel.coordinates || hostel.location || '';

    const mapQ = encodeURIComponent((hostel.coordinates || hostel.location || hostel.name) + ' Nyeri Kenya');
    document.getElementById('map-link').href = 'https://www.google.com/maps/search/?api=1&query=' + mapQ;
    const mapIframe = document.getElementById('map-iframe');
    if (mapIframe) {
      const coords = hostel.coordinates || (hostel.location + ' Nyeri Kenya');
      mapIframe.src = `https://maps.google.com/maps?q=${encodeURIComponent(coords)}&layer=c&cbll=${encodeURIComponent(hostel.coordinates || '')}&output=embed`;
    }

    // Amenities Categorization & Sorting
    const utilities = hostel.utilities || [];
    let included = [];
    let paid = [];

    if (hostel.utilitiesIncluded && Array.isArray(hostel.utilitiesIncluded)) {
      included = [...hostel.utilitiesIncluded];
    }
    if (hostel.utilitiesPaid && Array.isArray(hostel.utilitiesPaid)) {
      paid = [...hostel.utilitiesPaid];
    }

    if (included.length === 0 && paid.length === 0) {
      utilities.forEach(u => {
        const lower = u.toLowerCase();
        if (
          lower.includes('token') ||
          lower.includes('paid') ||
          lower.includes('extra') ||
          lower.includes('pay for') ||
          lower.includes('own cost') ||
          lower.includes('meter') ||
          lower.includes('separately') ||
          lower.includes('not in rent') ||
          lower.includes('not included') ||
          lower.includes('electricity (') ||
          lower.includes('water (')
        ) {
          paid.push(u);
        } else {
          included.push(u);
        }
      });
    }

    const amenitiesContainer = document.getElementById('amenities-container');
    if (amenitiesContainer) {
      if (included.length === 0 && paid.length === 0) {
        amenitiesContainer.innerHTML = '<span class="quickstart-note">No amenities listed.</span>';
      } else {
        let html = '';
        if (included.length > 0) {
          html += `
            <div style="margin-bottom: 16px;">
                <h4 style="font-size: 0.9rem; color: #0bda83; margin: 0 0 8px 0; display: flex; align-items: center; gap: 6px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px;">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Included in Rent
                </h4>
                <div class="amenities-grid">
                    ${included.map(u => `<span class="amenity-pill pill-included">${esc(u)}</span>`).join('')}
                </div>
            </div>
          `;
        }
        if (paid.length > 0) {
          html += `
            <div>
                <h4 style="font-size: 0.9rem; color: #f59e0b; margin: 0 0 8px 0; display: flex; align-items: center; gap: 6px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="12" x2="12" y2="16"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    Paid Separately (by Tenant)
                </h4>
                <div class="amenities-grid">
                    ${paid.map(u => `<span class="amenity-pill pill-paid">${esc(u)}</span>`).join('')}
                </div>
            </div>
          `;
        }
        amenitiesContainer.innerHTML = html;
      }
    }

    const desc = (hostel.description || '').toLowerCase();
    const isMonthly = desc.includes('p.m') || desc.includes('per month') || desc.includes('monthly') || desc.includes('/month');
    const period = isMonthly ? 'Month' : 'Semester';

    let depositHtml = 'Refundable';
    if (hostel.deposit) {
      if (hostel.deposit.required) {
        const amt = hostel.deposit.amount ? stripPeriod(DKUT.app.fmtPrice(hostel.deposit.amount)) : '';
        const type = hostel.deposit.refundable ? 'Refundable' : 'Non-refundable';
        depositHtml = amt ? `${esc(amt)}<br><small style="color:#8a8298">${esc(type)}</small>` : esc(type);
      } else {
        depositHtml = 'None';
      }
    } else {
      const match = desc.match(/(?:deposit\s+(?:of\s+)?(?:kshs?\.?\s*|kes\s*)?([0-9,]+))/i) || desc.match(/(?:(?:kshs?\.?\s*|kes\s*)?([0-9,]+)\s+(?:refundable\s+)?deposit)/i);
      if (desc.includes('no deposit') || desc.includes('zero deposit')) {
        depositHtml = 'None';
      } else if (match) {
        const amt = 'KES ' + match[1];
        const isNonRef = desc.includes('non-refundable') || desc.includes('non refundable');
        depositHtml = `${esc(amt)}<br><small style="color:#8a8298">${isNonRef ? 'Non-refundable' : 'Refundable'}</small>`;
      } else if (desc.includes('non-refundable deposit') || desc.includes('non refundable deposit')) {
        depositHtml = 'Non-refundable';
      } else if (desc.includes('refundable deposit')) {
        depositHtml = 'Refundable';
      }
    }

    // Pricing Logic
    let currentPricingMode = (hostel.priceAlone > 0) ? 'alone' : 'sharing';

    function renderPricing() {
      const btnAlone = document.getElementById('btn-stay-alone');
      const btnSharing = document.getElementById('btn-sharing');
      
      if (hostel.rooms && Array.isArray(hostel.rooms)) {
        const modeSwitch = document.getElementById('pricing-mode-switch');
        if (modeSwitch) modeSwitch.style.display = 'none';

        let rowsHtml = hostel.rooms.map(room => {
          const priceStr = stripPeriod(DKUT.app.fmtPrice(room.price.amountSharing));
          const priceAloneStr = room.price.amountAlone ? stripPeriod(DKUT.app.fmtPrice(room.price.amountAlone)) : 'N/A';
          const occupancyStr = `${room.occupancy.minimumPeople}-${room.occupancy.maximumPeople} Person(s)`;
          
          let depHtml = 'None';
          if (room.deposit && room.deposit.required) {
            const amtStr = room.deposit.amount ? stripPeriod(DKUT.app.fmtPrice(room.deposit.amount)) : '';
            const typeStr = room.deposit.refundable ? 'Refundable' : 'Non-refundable';
            depHtml = amtStr ? `${esc(amtStr)}<br><small style="color:#8a8298">${esc(typeStr)}</small>` : esc(typeStr);
          }

          return `
            <tr>
              <td>${esc(room.name)}</td>
              <td class="pricing-table-price">Sharing: ${esc(priceStr)}<br><small style="color:#8a8298">Alone: ${esc(priceAloneStr)}</small></td>
              <td>${depHtml}</td>
              <td>${esc(room.price.period || 'month')}</td>
            </tr>
          `;
        }).join('');

        let extraFeesHtml = '';
        if (hostel.fees && hostel.fees.agreementFee) {
          const feeVal = isNaN(Number(hostel.fees.agreementFee.amount)) ? hostel.fees.agreementFee.amount : stripPeriod(DKUT.app.fmtPrice(hostel.fees.agreementFee.amount));
          extraFeesHtml += `<div class="pricing-extras-card" style="margin-top: 16px; padding: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; text-align: left;">
            <h4 style="margin: 0 0 10px 0; color: var(--white-2); font-size: 0.95rem;">Additional Fees & Terms</h4>
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.875rem;">
              <span style="color:#8a8298;">Agreement Fee</span>
              <span style="font-weight:600; color:var(--white-2);">${esc(feeVal)}</span>
            </div>
          </div>`;
        }

        document.getElementById('pricing-row').innerHTML = `
          <div class="pricing-table-container">
            <table class="pricing-table">
              <thead>
                <tr>
                  <th>Room Type</th>
                  <th>Price</th>
                  <th>Deposit</th>
                  <th>Period</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
          ${extraFeesHtml}
        `;
        return;
      }

      if (currentPricingMode === 'alone') {
        btnAlone?.classList.add('active');
        btnSharing?.classList.remove('active');
      } else {
        btnAlone?.classList.remove('active');
        btnSharing?.classList.add('active');
      }

      let rowsHtml = '';
      if (currentPricingMode === 'alone') {
        if (hostel.priceAlone > 0) {
          rowsHtml += `
            <tr>
              <td>Single (Stay Alone)</td>
              <td class="pricing-table-price">${esc(stripPeriod(DKUT.app.fmtPrice(hostel.priceAlone)))}</td>
              <td>${depositHtml}</td>
              <td>${period}</td>
            </tr>
          `;
        } else {
          rowsHtml += `
            <tr>
              <td colspan="4" style="text-align:center;color:#8a8298;padding:20px;">Single Room (Stay Alone) is not available at this hostel.</td>
            </tr>
          `;
        }
      } else {
        if (hostel.price > 0) {
          rowsHtml += `
            <tr>
              <td>${esc(hostel.roomType || 'Sharing')}</td>
              <td class="pricing-table-price">${esc(stripPeriod(DKUT.app.fmtPrice(hostel.price)))}</td>
              <td>${depositHtml}</td>
              <td>${period}</td>
            </tr>
          `;
        } else {
          rowsHtml += `
            <tr>
              <td colspan="4" style="text-align:center;color:#8a8298;padding:20px;">Sharing Room is not available at this hostel.</td>
            </tr>
          `;
        }
      }

      let extraFeesHtml = '';
      if (hostel.agreementFee || (hostel.extras && (Array.isArray(hostel.extras) ? hostel.extras.length > 0 : Object.keys(hostel.extras).length > 0))) {
        extraFeesHtml += `<div class="pricing-extras-card" style="margin-top: 16px; padding: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; text-align: left;">`;
        extraFeesHtml += `<h4 style="margin: 0 0 10px 0; color: var(--white-2); font-size: 0.95rem;">Additional Fees & Terms</h4>`;
        
        if (hostel.agreementFee) {
          const feeVal = isNaN(Number(hostel.agreementFee)) ? hostel.agreementFee : stripPeriod(DKUT.app.fmtPrice(hostel.agreementFee));
          extraFeesHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.875rem;">
            <span style="color:#8a8298;">Agreement Fee</span>
            <span style="font-weight:600; color:var(--white-2);">${esc(feeVal)}</span>
          </div>`;
        }

        if (hostel.extras) {
          if (Array.isArray(hostel.extras)) {
            hostel.extras.forEach(item => {
              if (item.includes(':')) {
                const parts = item.split(':');
                extraFeesHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.875rem;">
                  <span style="color:#8a8298;">${esc(parts[0].trim())}</span>
                  <span style="font-weight:600; color:var(--white-2);">${esc(parts.slice(1).join(':').trim())}</span>
                </div>`;
              } else {
                extraFeesHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.875rem;">
                  <span style="color:#8a8298;">Extra Term</span>
                  <span style="font-weight:600; color:var(--white-2);">${esc(item)}</span>
                </div>`;
              }
            });
          } else if (typeof hostel.extras === 'object') {
            Object.entries(hostel.extras).forEach(([key, val]) => {
              extraFeesHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.875rem;">
                <span style="color:#8a8298;">${esc(key)}</span>
                <span style="font-weight:600; color:var(--white-2);">${esc(val)}</span>
              </div>`;
            });
          } else if (typeof hostel.extras === 'string') {
            extraFeesHtml += `<p style="font-size:0.875rem; color:#8a8298; margin: 0;">${esc(hostel.extras)}</p>`;
          }
        }
        extraFeesHtml += `</div>`;
      }

      document.getElementById('pricing-row').innerHTML = `
        <div class="pricing-table-container">
          <table class="pricing-table">
            <thead>
              <tr>
                <th>Room Type</th>
                <th>Price</th>
                <th>Deposit</th>
                <th>Period</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
        ${extraFeesHtml}
      `;
    }

    renderPricing();

    if (hostel.rules) {
      const mapSection = document.getElementById('map-iframe')?.closest('.detail-section');
      if (mapSection) {
        const rulesDiv = document.createElement('div');
        rulesDiv.className = 'detail-section';
        rulesDiv.style.marginTop = '24px';
        
        let rulesHtml = `<h3 style="margin: 0 0 16px 0; font-size: 1.2rem; font-weight: 700; color: var(--white-1);">Hostel Rules & Policies</h3>`;
        rulesHtml += `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">`;
        
        const r = hostel.rules;
        if (r.gateClosingTime) {
          rulesHtml += `<div class="pricing-extras-card" style="padding:12px; background:rgba(255,255,255,0.015); border:1px solid rgba(255,255,255,0.04); border-radius:10px;">
            <strong style="color:var(--white-2); font-size:0.875rem; display:block; margin-bottom:4px;">Gate Closing Time</strong>
            <span style="color:#8a8298; font-size:0.85rem;">Closes at ${esc(r.gateClosingTime)}</span>
          </div>`;
        }
        
        if (r.visitors) {
          rulesHtml += `<div class="pricing-extras-card" style="padding:12px; background:rgba(255,255,255,0.015); border:1px solid rgba(255,255,255,0.04); border-radius:10px;">
            <strong style="color:var(--white-2); font-size:0.875rem; display:block; margin-bottom:4px;">Visitors</strong>
            <span style="color:#8a8298; font-size:0.85rem;">${r.visitors.allowed ? `Allowed until ${r.visitors.allowedUntil || 'evening'}` : 'Not allowed'}</span>
          </div>`;
        }

        if (r.sleepovers) {
          rulesHtml += `<div class="pricing-extras-card" style="padding:12px; background:rgba(255,255,255,0.015); border:1px solid rgba(255,255,255,0.04); border-radius:10px;">
            <strong style="color:var(--white-2); font-size:0.875rem; display:block; margin-bottom:4px;">Sleepovers</strong>
            <span style="color:#8a8298; font-size:0.85rem;">${r.sleepovers.allowed ? 'Allowed' : 'Strictly Forbidden'}</span>
          </div>`;
        }

        if (r.quietHours) {
          rulesHtml += `<div class="pricing-extras-card" style="padding:12px; background:rgba(255,255,255,0.015); border:1px solid rgba(255,255,255,0.04); border-radius:10px;">
            <strong style="color:var(--white-2); font-size:0.875rem; display:block; margin-bottom:4px;">Quiet Hours</strong>
            <span style="color:#8a8298; font-size:0.85rem;">${esc(r.quietHours.start)} - ${esc(r.quietHours.end)}</span>
          </div>`;
        }
        
        rulesHtml += `</div>`;
        rulesDiv.innerHTML = rulesHtml;
        mapSection.parentNode.insertBefore(rulesDiv, mapSection);
      }
    }

    // Bind Pricing Switch
    document.getElementById('btn-stay-alone')?.addEventListener('click', () => {
      currentPricingMode = 'alone';
      renderPricing();
    });
    document.getElementById('btn-sharing')?.addEventListener('click', () => {
      currentPricingMode = 'sharing';
      renderPricing();
    });

    // Gallery Grid Setup
    let galleryHtml = '';
    if (hostel.media && Array.isArray(hostel.media.gallery)) {
      galleryHtml = hostel.media.gallery.flatMap((cat, catIdx) => {
        const catName = cat.category || 'General';
        const catImages = cat.images || [];
        return catImages.map((src, imgIdx) => 
          `<img src="${esc(src)}" data-category="${esc(catName)}" alt="${esc(hostel.name)} photo ${catName} ${imgIdx + 1}" loading="lazy" onerror="this.style.display='none'">`
        );
      }).join('');
    }

    if (!galleryHtml && imgs.length > 0) {
      // Helper to auto-categorize flat list of images based on URL content
      const getCategoryFromUrl = (url) => {
        const lower = url.toLowerCase();
        if (lower.includes('kitchen') || lower.includes('cook') || lower.includes('dining')) return 'Kitchen';
        if (lower.includes('room') || lower.includes('bedroom') || lower.includes('bed')) return 'Rooms';
        if (lower.includes('bath') || lower.includes('wash') || lower.includes('toilet') || lower.includes('shower')) return 'Bathroom';
        if (lower.includes('lobby') || lower.includes('lounge') || lower.includes('living') || lower.includes('common') || lower.includes('sitting')) return 'Common Areas';
        if (lower.includes('exterior') || lower.includes('gate') || lower.includes('entrance') || lower.includes('outside') || lower.includes('yard')) return 'Exterior/Entrance';
        return 'General';
      };

      galleryHtml = imgs.map((src, i) => {
        const catName = getCategoryFromUrl(src);
        return `<img src="${esc(src)}" data-category="${esc(catName)}" alt="${esc(hostel.name)} photo ${i + 1}" loading="lazy" onerror="this.style.display='none'">`;
      }).join('');
    }

    document.getElementById('gallery-grid').innerHTML = galleryHtml || '<p class="quickstart-note">No photos available.</p>';

    renderContact(hostel);
    setupLightbox();

    // Carousel Media Switch
    const vids = (Array.isArray(hostel.videos) ? hostel.videos : [hostel.video]).filter(Boolean);
    const mediaSwitch = document.getElementById('carousel-media-switch-wrapper');

    if (vids.length > 0) {
      if (mediaSwitch) mediaSwitch.style.display = 'inline-flex';
      
      const btnPhotos = document.getElementById('btn-show-photos');
      const btnVideos = document.getElementById('btn-show-videos');

      btnPhotos?.addEventListener('click', () => {
        btnPhotos.classList.add('active');
        btnVideos?.classList.remove('active');
        if (window.hostelCarousel && window.hostelCarousel.setMedia) {
          window.hostelCarousel.setMedia(imgs, 'image');
        }
      });

      btnVideos?.addEventListener('click', () => {
        btnVideos.classList.add('active');
        btnPhotos?.classList.remove('active');
        if (window.hostelCarousel && window.hostelCarousel.setMedia) {
          window.hostelCarousel.setMedia(vids, 'video');
        }
      });
    } else {
      if (mediaSwitch) mediaSwitch.style.display = 'none';
    }

    // Floating Contact CTA Action
    const contact = hostel.contact ? hostel.contact.split(',')[0].trim() : '';
    if (contact) {
      const bar = document.getElementById('bottom-bar');
      if (bar) {
        bar.hidden = false;
        bar.style.display = 'flex';
      }
      
      document.getElementById('bottom-contact-cta')?.addEventListener('click', (e) => {
        e.preventDefault();
        const contactSec = document.getElementById('contact-buttons');
        if (contactSec) {
          contactSec.scrollIntoView({ behavior: 'smooth', block: 'center' });
          contactSec.style.outline = '2px dashed var(--accent)';
          setTimeout(() => contactSec.style.outline = 'none', 1500);
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
