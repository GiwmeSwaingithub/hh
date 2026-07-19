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
    const msg = encodeURIComponent(`Hello, I would like to request the caretaker's number for "${hostel.name}" (Hostel ID: ${hostel.id}).`);
    container.innerHTML = `
      <a class="enquire-btn" href="https://wa.me/254769486775?text=${msg}" target="_blank" rel="noopener" style="width:100%;">
        <em>Request Caretaker Number</em><i>&#10095;&#10095;</i>
      </a>
      <span style="font-size:0.8rem; opacity:0.7; text-align:center; display:block; margin-top:4px;">For privacy, contact details are provided upon request.</span>
    `;
  }

  function setupLightbox() {
    const lb = document.getElementById('lightbox');
    const canvas = document.getElementById('lightbox-canvas');
    
    const closeLb = () => {
      if (lb) {
        lb.classList.remove('open');
        lb.style.display = 'none';
        document.body.style.overflow = '';
      }
    };

    document.getElementById('lightbox-close')?.addEventListener('click', closeLb);
    lb?.addEventListener('click', e => { if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLb(); });
    
    document.getElementById('gallery-grid')?.addEventListener('click', e => {
      const target = e.target;
      if (target.tagName === 'IMG' || target.tagName === 'CANVAS') {
        const src = target.getAttribute('data-secure-src') || target.src || target._src;
        if (src && canvas) {
          lb.classList.add('open');
          lb.style.display = 'flex';
          document.body.style.overflow = 'hidden';
          if (window.DRMProtector) {
            window.DRMProtector.loadSecureImage(canvas, src);
          } else {
            const img = new Image();
            img.onload = () => {
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              canvas.getContext('2d').drawImage(img, 0, 0);
            };
            img.src = src;
          }
        }
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
    if (hero && imgs[0]) { 
      hero.src = imgs[0]; 
      hero.alt = hostel.name;
      hero.style.cursor = 'pointer';
      hero.addEventListener('click', () => {
        if (typeof openLightbox === 'function') {
          openLightbox(imgs[0]);
        } else {
          const lb = document.getElementById('lightbox');
          const canvas = document.getElementById('lightbox-canvas');
          if (lb && canvas) {
            lb.classList.add('open');
            lb.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            if (window.DRMProtector) {
              window.DRMProtector.loadSecureImage(canvas, imgs[0]);
            } else {
              const img = new Image();
              img.onload = () => {
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                canvas.getContext('2d').drawImage(img, 0, 0);
              };
              img.src = imgs[0];
            }
          }
        }
      });
    }

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

    // Amenities / Utilities — supports both structured object and legacy flat array
    const utilitiesRaw = hostel.utilities;
    let included = [];
    let paid = [];

    // Helper icon SVGs for utility types
    const utilIcons = {
      water:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;vertical-align:middle;margin-right:4px;"><path d="M12 2C6 10 4 14 4 17a8 8 0 0 0 16 0c0-3-2-7-8-15z"/></svg>',
      electricity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;vertical-align:middle;margin-right:4px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
      wifi:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;vertical-align:middle;margin-right:4px;"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/></svg>',
      garbage:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;vertical-align:middle;margin-right:4px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>',
      shower:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;vertical-align:middle;margin-right:4px;"><path d="M4 12h16"/><path d="M4 12a8 8 0 0 1 8-8v8"/><path d="M8 20h.01M12 20h.01M16 20h.01M10 18h.01M14 18h.01"/></svg>',
      bed:         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;vertical-align:middle;margin-right:4px;"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>',
      laundry:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;vertical-align:middle;margin-right:4px;"><rect x="2" y="2" width="20" height="20" rx="2"/><circle cx="12" cy="12" r="4"/><path d="M8 2v3"/><circle cx="17" cy="6" r="1" fill="currentColor"/></svg>',
      parking:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;vertical-align:middle;margin-right:4px;"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>',
    };

    if (utilitiesRaw && typeof utilitiesRaw === 'object' && !Array.isArray(utilitiesRaw)) {
      // Structured object format: { water: {type, description}, electricity: {type}, garbageCollection: {...}, ... }
      const keyLabelMap = {
        water: 'Water',
        electricity: 'Electricity',
        wifi: 'WiFi',
        garbageCollection: 'Garbage Collection',
        hotShower: 'Hot Shower',
        bed: 'Bed / Mattress',
        laundry: 'Laundry',
        parking: 'Parking',
      };
      const iconMap = {
        water: utilIcons.water,
        electricity: utilIcons.electricity,
        wifi: utilIcons.wifi,
        garbageCollection: utilIcons.garbage,
        hotShower: utilIcons.shower,
        bed: utilIcons.bed,
        laundry: utilIcons.laundry,
        parking: utilIcons.parking,
      };
      const paidTypes = ['meter', 'token', 'paid', 'extra', 'weekly', 'monthly', 'per'];
      const isPaidType = (type) => type && paidTypes.some(p => String(type).toLowerCase().includes(p));

      Object.entries(utilitiesRaw).forEach(([key, val]) => {
        if (!val) return;
        const label = keyLabelMap[key] || key;
        const icon = iconMap[key] || '';
        let pillLabel = icon + esc(label);

        if (typeof val === 'boolean') {
          if (val) included.push(pillLabel);
          // If false, skip silently
          return;
        }

        if (typeof val === 'object') {
          // Determine included vs paid
          const type = val.type || '';
          const isIncl = val.included === true || type === 'included';
          const isAvail = val.available === true;
          const selfService = val.selfService === true;
          const desc = val.description ? ` (${val.description})` : '';
          const amt = val.amount ? ` — KES ${val.amount}/${val.period || 'mo'}` : '';

          if (key === 'garbageCollection') {
            // Always show with cost if any
            const gcLabel = icon + esc(label) + esc(amt || (type ? ` (${type})` : ''));
            if (isPaidType(type) || val.amount) {
              paid.push(gcLabel);
            } else {
              included.push(gcLabel);
            }
          } else if (key === 'hotShower') {
            if (isIncl || isAvail) {
              included.push(icon + esc('Hot Shower'));
            }
          } else if (key === 'bed') {
            if (val.included === true) included.push(icon + esc('Bed Included'));
            if (val.mattressIncluded === true) included.push(esc('Mattress Included'));
          } else if (key === 'laundry') {
            if (isAvail) {
              const lLabel = icon + esc('Laundry') + (selfService ? ' (Self-service)' : '');
              included.push(lLabel);
            }
          } else if (key === 'parking') {
            if (isAvail) included.push(icon + esc('Parking Available'));
          } else if (isPaidType(type)) {
            paid.push(icon + esc(label) + esc(desc));
          } else if (isIncl || type === 'included' || type === 'free') {
            included.push(icon + esc(label) + esc(desc));
          } else if (type) {
            paid.push(icon + esc(label) + esc(` (${type})`) + esc(desc));
          }
        }
      });
    } else if (Array.isArray(utilitiesRaw)) {
      // Legacy flat array format
      if (hostel.utilitiesIncluded && Array.isArray(hostel.utilitiesIncluded)) {
        included = [...hostel.utilitiesIncluded];
      }
      if (hostel.utilitiesPaid && Array.isArray(hostel.utilitiesPaid)) {
        paid = [...hostel.utilitiesPaid];
      }
      if (included.length === 0 && paid.length === 0) {
        utilitiesRaw.forEach(u => {
          const lower = u.toLowerCase();
          if (
            lower.includes('token') || lower.includes('paid') || lower.includes('extra') ||
            lower.includes('pay for') || lower.includes('own cost') || lower.includes('meter') ||
            lower.includes('separately') || lower.includes('not in rent') ||
            lower.includes('not included') || lower.includes('electricity (') || lower.includes('water (')
          ) {
            paid.push(u);
          } else {
            included.push(u);
          }
        });
      }
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
                    ${included.map(u => `<span class="amenity-pill pill-included">${u}</span>`).join('')}
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
                    ${paid.map(u => `<span class="amenity-pill pill-paid">${u}</span>`).join('')}
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

    // Helper to check if any additional fees exist
    function hasAdditionalFees(h) {
      if (h.rooms && Array.isArray(h.rooms) && h.rooms.length > 0) {
        if (h.fees && h.fees.agreementFee) {
          const amt = h.fees.agreementFee.amount;
          return amt !== undefined && amt !== null && amt !== 0 && amt !== '0' && String(amt).toLowerCase() !== 'none' && String(amt).trim() !== '';
        }
        return false;
      }
      
      const hasFee = h.agreementFee !== undefined && h.agreementFee !== null && h.agreementFee !== 0 && h.agreementFee !== '0' && String(h.agreementFee).toLowerCase() !== 'none' && String(h.agreementFee).trim() !== '';
      
      let hasExtras = false;
      if (h.extras) {
        if (Array.isArray(h.extras)) {
          hasExtras = h.extras.some(x => x && x.trim() && x.toLowerCase() !== 'none');
        } else if (typeof h.extras === 'object') {
          hasExtras = Object.values(h.extras).some(x => x && String(x).trim() && String(x).toLowerCase() !== 'none');
        } else if (typeof h.extras === 'string') {
          hasExtras = h.extras.trim() !== '' && h.extras.toLowerCase() !== 'none';
        }
      }
      return hasFee || hasExtras;
    }

    // Pricing Logic
    let selectedRoomIndex = 0; // for rooms array
    let currentPricingMode = (hostel.priceAlone > 0) ? 'alone' : 'sharing'; // fallback mode

    function renderPricing() {
      const roomSelectorContainer = document.getElementById('room-selector-container');
      const roomSelectorButtons = document.getElementById('room-selector-buttons');
      const selectedRoomNameSpan = document.getElementById('selected-room-name');
      const modeSwitchWrapper = document.getElementById('pricing-mode-switch-wrapper');
      const pricingRow = document.getElementById('pricing-row');

      if (!pricingRow) return;

      // Hide the old legacy switch
      if (modeSwitchWrapper) modeSwitchWrapper.style.display = 'none';

      let rowsHtml = '';
      let selectedRoomName = '';
      let buttonsHtml = '';

      const hasRoomsList = hostel.rooms && Array.isArray(hostel.rooms) && hostel.rooms.length > 0;

      if (hasRoomsList) {
        if (roomSelectorContainer) roomSelectorContainer.style.display = 'flex';

        // Render room selector buttons
        buttonsHtml = hostel.rooms.map((room, idx) => {
          const isActive = idx === selectedRoomIndex;
          return `<button type="button" class="room-select-btn${isActive ? ' active' : ''}" data-room-idx="${idx}">${esc(room.name)}</button>`;
        }).join('');

        if (roomSelectorButtons) roomSelectorButtons.innerHTML = buttonsHtml;

        // Active room details
        const room = hostel.rooms[selectedRoomIndex] || hostel.rooms[0];
        if (room) {
          selectedRoomName = room.name;
          
          const amtSharing = room.price ? room.price.amountSharing : 0;
          const amtAlone = room.price ? room.price.amountAlone : 0;
          let priceCell = '';

          if (amtSharing > 0 && amtAlone > 0 && amtSharing === amtAlone) {
            priceCell = esc(stripPeriod(DKUT.app.fmtPrice(amtSharing)));
          } else if (amtSharing > 0 && amtAlone > 0) {
            priceCell = `Sharing: ${esc(stripPeriod(DKUT.app.fmtPrice(amtSharing)))}<br><small style="color:#8a8298">Solo: ${esc(stripPeriod(DKUT.app.fmtPrice(amtAlone)))}</small>`;
          } else if (amtSharing > 0) {
            priceCell = `Sharing: ${esc(stripPeriod(DKUT.app.fmtPrice(amtSharing)))}`;
          } else if (amtAlone > 0) {
            priceCell = `Solo: ${esc(stripPeriod(DKUT.app.fmtPrice(amtAlone)))}`;
          } else {
            priceCell = 'Contact for price';
          }

          let depHtml = 'None';
          if (room.deposit && room.deposit.required) {
            const amtStr = room.deposit.amount ? stripPeriod(DKUT.app.fmtPrice(room.deposit.amount)) : '';
            const typeStr = room.deposit.refundable ? 'Refundable' : 'Non-refundable';
            depHtml = amtStr ? `${esc(amtStr)}<br><small style="color:#8a8298">${esc(typeStr)}</small>` : esc(typeStr);
          }

          rowsHtml = `
            <tr>
              <td class="pricing-table-price">${priceCell}</td>
              <td>${depHtml}</td>
              <td>${esc(room.price.period || 'month')}</td>
            </tr>
          `;
        }

        // Attach event listeners
        if (roomSelectorButtons) {
          roomSelectorButtons.querySelectorAll('.room-select-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              selectedRoomIndex = parseInt(btn.getAttribute('data-room-idx'), 10);
              renderPricing();
            });
          });
        }
      } else {
        // Fallback pricing selector
        const hasAlone = hostel.priceAlone > 0;
        const hasSharing = hostel.price > 0;

        if (hasAlone || hasSharing) {
          if (roomSelectorContainer) roomSelectorContainer.style.display = 'flex';

          const buttons = [];
          if (hasAlone) {
            const isActive = currentPricingMode === 'alone';
            buttons.push(`<button type="button" class="room-select-btn${isActive ? ' active' : ''}" data-mode="alone">Stay Alone</button>`);
          }
          if (hasSharing) {
            const isActive = currentPricingMode === 'sharing';
            buttons.push(`<button type="button" class="room-select-btn${isActive ? ' active' : ''}" data-mode="sharing">${esc(hostel.roomType || 'Sharing')}</button>`);
          }

          if (roomSelectorButtons) roomSelectorButtons.innerHTML = buttons.join('');

          if (currentPricingMode === 'alone' && hasAlone) {
            selectedRoomName = 'Single (Stay Alone)';
            rowsHtml = `
              <tr>
                <td class="pricing-table-price">${esc(stripPeriod(DKUT.app.fmtPrice(hostel.priceAlone)))}</td>
                <td>${depositHtml}</td>
                <td>${period}</td>
              </tr>
            `;
          } else if (hasSharing) {
            selectedRoomName = hostel.roomType || 'Sharing';
            rowsHtml = `
              <tr>
                <td class="pricing-table-price">${esc(stripPeriod(DKUT.app.fmtPrice(hostel.price)))}</td>
                <td>${depositHtml}</td>
                <td>${period}</td>
              </tr>
            `;
          } else if (hasAlone) {
            currentPricingMode = 'alone';
            selectedRoomName = 'Single (Stay Alone)';
            rowsHtml = `
              <tr>
                <td class="pricing-table-price">${esc(stripPeriod(DKUT.app.fmtPrice(hostel.priceAlone)))}</td>
                <td>${depositHtml}</td>
                <td>${period}</td>
              </tr>
            `;
          }

          if (roomSelectorButtons) {
            roomSelectorButtons.querySelectorAll('.room-select-btn').forEach(btn => {
              btn.addEventListener('click', () => {
                currentPricingMode = btn.getAttribute('data-mode');
                renderPricing();
              });
            });
          }
        } else {
          if (roomSelectorContainer) roomSelectorContainer.style.display = 'none';
        }
      }

      if (selectedRoomNameSpan) {
        selectedRoomNameSpan.textContent = selectedRoomName || '-';
      }

      // Render pricing table and extra fees
      let extraFeesHtml = '';
      const showExtras = hasAdditionalFees(hostel);
      
      if (showExtras) {
        extraFeesHtml += `<div class="pricing-extras-card" style="margin-top: 16px; padding: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; text-align: left;">`;
        extraFeesHtml += `<h4 style="margin: 0 0 10px 0; color: var(--white-2); font-size: 0.95rem;">Additional Fees & Terms</h4>`;
        
        if (hasRoomsList) {
          if (hostel.fees && hostel.fees.agreementFee) {
            const amt = hostel.fees.agreementFee.amount;
            if (amt !== undefined && amt !== null && amt !== 0 && amt !== '0' && String(amt).toLowerCase() !== 'none' && String(amt).trim() !== '') {
              const feeVal = isNaN(Number(amt)) ? amt : stripPeriod(DKUT.app.fmtPrice(amt));
              extraFeesHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.875rem;">
                <span style="color:#8a8298;">Agreement Fee</span>
                <span style="font-weight:600; color:var(--white-2);">${esc(feeVal)}</span>
              </div>`;
            }
          }
        } else {
          const fee = hostel.agreementFee;
          if (fee !== undefined && fee !== null && fee !== 0 && fee !== '0' && String(fee).toLowerCase() !== 'none' && String(fee).trim() !== '') {
            const feeVal = isNaN(Number(fee)) ? fee : stripPeriod(DKUT.app.fmtPrice(fee));
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
                } else if (item.trim() && item.toLowerCase() !== 'none') {
                  extraFeesHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.875rem;">
                    <span style="color:#8a8298;">Extra Term</span>
                    <span style="font-weight:600; color:var(--white-2);">${esc(item)}</span>
                  </div>`;
                }
              });
            } else if (typeof hostel.extras === 'object') {
              Object.entries(hostel.extras).forEach(([key, val]) => {
                if (val && String(val).toLowerCase() !== 'none') {
                  extraFeesHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.875rem;">
                    <span style="color:#8a8298;">${esc(key)}</span>
                    <span style="font-weight:600; color:var(--white-2);">${esc(val)}</span>
                  </div>`;
                }
              });
            } else if (typeof hostel.extras === 'string' && hostel.extras.trim() && hostel.extras.toLowerCase() !== 'none') {
              extraFeesHtml += `<p style="font-size:0.875rem; color:#8a8298; margin: 0;">${esc(hostel.extras)}</p>`;
            }
          }
        }
        extraFeesHtml += `</div>`;
      }

      pricingRow.innerHTML = `
        <div class="pricing-table-container">
          <table class="pricing-table">
            <thead>
              <tr>
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
        
        const r = hostel.rules;
        const ruleLines = [];
        
        if (r.gateClosingTime) {
          ruleLines.push(`Gate Closing Time: Closes at ${r.gateClosingTime}`);
        }
        if (r.visitors) {
          ruleLines.push(`Visitors: ${r.visitors.allowed ? `Allowed until ${r.visitors.allowedUntil || 'evening'}` : 'Not allowed'}`);
        }
        if (r.sleepovers) {
          ruleLines.push(`Sleepovers: ${r.sleepovers.allowed ? 'Allowed' : 'Strictly Forbidden'}`);
        }
        if (r.quietHours) {
          ruleLines.push(`Quiet Hours: ${r.quietHours.start} - ${r.quietHours.end}`);
        }
        // Rules fields are {allowed: bool} objects in DB
        if (r.parties !== undefined) {
          const v = typeof r.parties === 'object' ? r.parties.allowed : r.parties;
          ruleLines.push(`Parties: ${v ? 'Allowed' : 'Not allowed'}`);
        }
        if (r.alcohol !== undefined) {
          const v = typeof r.alcohol === 'object' ? r.alcohol.allowed : r.alcohol;
          ruleLines.push(`Alcohol: ${v ? 'Allowed' : 'Not allowed'}`);
        }
        if (r.smoking !== undefined) {
          const v = typeof r.smoking === 'object' ? r.smoking.allowed : r.smoking;
          ruleLines.push(`Smoking: ${v ? 'Allowed' : 'Not allowed'}`);
        }
        if (r.pets !== undefined) {
          const v = typeof r.pets === 'object' ? r.pets.allowed : r.pets;
          ruleLines.push(`Pets: ${v ? 'Allowed' : 'Not allowed'}`);
        }
        if (r.noticeBeforeVacating && r.noticeBeforeVacating.required) {
          const dur = r.noticeBeforeVacating.duration || '';
          const unit = r.noticeBeforeVacating.unit || 'days';
          ruleLines.push(`Notice Before Vacating: ${dur} ${unit}`);
        }
        if (r.cleanliness && r.cleanliness.tenantResponsible) {
          ruleLines.push('Cleanliness: Tenant is responsible for maintaining cleanliness');
        }

        const others = r.others || r.other;
        if (others) {
          if (Array.isArray(others)) {
            others.forEach(line => {
              if (line && String(line).trim()) ruleLines.push(String(line).trim());
            });
          } else if (typeof others === 'string') {
            const parts = others.split(/[\n;]/);
            parts.forEach(part => {
              if (part.trim()) ruleLines.push(part.trim());
            });
          }
        }

        if (Array.isArray(hostel.rules)) {
          hostel.rules.forEach(rule => {
            if (rule && typeof rule === 'string' && rule.trim()) {
              ruleLines.push(rule.trim());
            }
          });
        }

        if (ruleLines.length > 0) {
          rulesHtml += `
            <div class="page">
              <div class="margin"></div>
              <div class="rules-list-container" id="rules-list-container">
                ${ruleLines.map(line => `<p class="rule-item">${esc(line)}</p>`).join('')}
              </div>
            </div>
            <button type="button" class="rules-see-more-btn" id="rules-see-more-btn" style="display: none;">
              <span>See More</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px; transition: transform 0.3s ease;">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          `;
          
          rulesDiv.innerHTML = rulesHtml;
          mapSection.parentNode.insertBefore(rulesDiv, mapSection);

          setTimeout(() => {
            const container = document.getElementById('rules-list-container');
            const btn = document.getElementById('rules-see-more-btn');
            if (container && btn) {
              if (container.scrollHeight > container.clientHeight) {
                btn.style.display = 'inline-flex';
                
                btn.addEventListener('click', () => {
                  const isExpanded = container.classList.toggle('expanded');
                  const textSpan = btn.querySelector('span');
                  const arrowSvg = btn.querySelector('svg');
                  
                  if (isExpanded) {
                    textSpan.textContent = 'See Less';
                    arrowSvg.style.transform = 'rotate(180deg)';
                    container.style.maxHeight = container.scrollHeight + 'px';
                  } else {
                    textSpan.textContent = 'See More';
                    arrowSvg.style.transform = 'rotate(0deg)';
                    container.style.maxHeight = 'calc(1.2rem * 12)';
                  }
                });
              }
            }
          }, 100);
        }
      }
    }

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

    // Toggle visibility of the tap image hint
    const tapHint = document.getElementById('carousel-tap-hint');
    if (tapHint) {
      if (imgs.length > 0) {
        tapHint.style.display = 'block';
      } else {
        tapHint.style.display = 'none';
      }
    }

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

    // Bind share button click
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        const shareData = {
          title: (hostel.name || 'Hostel') + ' — DKUT Hostels',
          text: `Check out ${hostel.name || 'this hostel'} on DKUT Hostels:`,
          url: window.location.href
        };
        
        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
          try {
            await navigator.share(shareData);
          } catch (err) {
            if (err.name !== 'AbortError') {
              console.error('Error sharing:', err);
            }
          }
        } else {
          // Fallback to clipboard copy
          try {
            await navigator.clipboard.writeText(window.location.href);
            if (window.DKUT && window.DKUT.app && window.DKUT.app.showToast) {
              window.DKUT.app.showToast('Link copied to clipboard!', 'success');
            } else {
              alert('Link copied to clipboard!');
            }
          } catch (err) {
            console.error('Clipboard copy failed:', err);
          }
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
