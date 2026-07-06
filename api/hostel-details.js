const fs = require('fs');
const path = require('path');

function escapeAttr(str) {
  if (str == null) return '';
  return String(str)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = (req, res) => {
  try {
    const { h } = req.query;
    
    // Default metadata values
    let title = 'Hostel Details — DKUT Hostels';
    let description = 'Full hostel details, photos, pricing, and contact information.';
    let image = 'https://i.postimg.cc/rFY2qLtR/Gemini-Generated-Image-ie2z3kie2z3kie2z.png';
    let url = `https://${req.headers.host || 'hostel.dekut.site'}/hostel-details` + (h ? `?h=${encodeURIComponent(h)}` : '');

    if (h) {
      const dataPath = path.join(process.cwd(), 'shared', 'data', 'hostels.json');
      if (fs.existsSync(dataPath)) {
        const rawData = fs.readFileSync(dataPath, 'utf8');
        const hostels = JSON.parse(rawData);
        
        // Find matching hostel by id or name slug
        const hostel = hostels.find(item => 
          String(item.id) === String(h) ||
          String(item.name).toLowerCase().replace(/\s+/g, '-').trim() === String(h).toLowerCase().trim()
        );

        if (hostel) {
          title = `${hostel.name} — DKUT Hostels`;
          
          // Format room prices
          let priceStr = '';
          if (hostel.rooms && Array.isArray(hostel.rooms) && hostel.rooms.length > 0) {
            const prices = [];
            hostel.rooms.forEach(r => {
              if (r.price) {
                if (r.price.amountSharing) prices.push({ val: r.price.amountSharing, type: r.price.period || 'semester' });
                if (r.price.amountAlone) prices.push({ val: r.price.amountAlone, type: r.price.period || 'semester' });
              }
            });
            if (prices.length > 0) {
              const minPriceObj = prices.reduce((min, p) => p.val < min.val ? p : min, prices[0]);
              const maxPriceObj = prices.reduce((max, p) => p.val > max.val ? p : max, prices[0]);
              const fmt = (p) => {
                if (p.val > 0 && p.val < 200) return `KES ${p.val}/night`;
                const typeStr = p.type === 'semester' ? 'sem' : p.type;
                return `KES ${p.val.toLocaleString('en-KE')}/${typeStr}`;
              };
              if (minPriceObj.val === maxPriceObj.val) {
                priceStr = fmt(minPriceObj);
              } else {
                priceStr = `${fmt(minPriceObj)} - ${fmt(maxPriceObj)}`;
              }
            }
          } else {
            const prices = [];
            if (hostel.price) prices.push({ val: hostel.price, type: 'sem' });
            if (hostel.priceAlone) prices.push({ val: hostel.priceAlone, type: 'sem' });
            if (prices.length > 0) {
              const minPriceObj = prices.reduce((min, p) => p.val < min.val ? p : min, prices[0]);
              const maxPriceObj = prices.reduce((max, p) => p.val > max.val ? p : max, prices[0]);
              const fmt = (p) => `KES ${p.val.toLocaleString('en-KE')}/${p.type}`;
              if (minPriceObj.val === maxPriceObj.val) {
                priceStr = fmt(minPriceObj);
              } else {
                priceStr = `${fmt(minPriceObj)} - ${fmt(maxPriceObj)}`;
              }
            }
          }

          if (priceStr) {
            priceStr = `Price: ${priceStr}`;
          } else {
            priceStr = 'Price: Contact for pricing';
          }

          // Combined price + description for Open Graph
          description = `${priceStr} | ${hostel.description || 'No description available.'}`;
          // Limit length to ~250 chars for link previews
          if (description.length > 250) {
            description = description.slice(0, 247) + '...';
          }

          if (hostel.media && hostel.media.coverImage) {
            image = hostel.media.coverImage;
          } else if (hostel.image) {
            image = hostel.image;
          }
        }
      }
    }

    // Read the static template
    const templatePath = path.join(process.cwd(), 'pages', 'hostel-details', 'index.html');
    if (!fs.existsSync(templatePath)) {
      return res.status(404).send('Template not found');
    }

    let html = fs.readFileSync(templatePath, 'utf8');

    // Build meta inject block
    const metaBlock = `
    <title>${escapeAttr(title)}</title>
    <meta name="description" content="${escapeAttr(description)}" />
    <link rel="icon" type="image/png" href="https://i.postimg.cc/rFY2qLtR/Gemini-Generated-Image-ie2z3kie2z3kie2z.png" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeAttr(url)}" />
    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:image" content="${escapeAttr(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${escapeAttr(url)}" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />
    <meta name="twitter:image" content="${escapeAttr(image)}" />
    `;

    // Strip duplicate static title, description, og, and twitter tags from the template
    html = html.replace(/<title>[^]*?<\/title>/gi, '');
    html = html.replace(/<meta\s+[^>]*?name=["']description["'][^>]*?\/?>/gi, '');
    html = html.replace(/<meta\s+[^>]*?property=["']og:[^]*?["'][^>]*?\/?>/gi, '');
    html = html.replace(/<meta\s+[^>]*?name=["']twitter:[^]*?["'][^>]*?\/?>/gi, '');
    html = html.replace(/<link\s+[^>]*?rel=["']icon["'][^>]*?\/?>/gi, '');
    
    // Inject dynamic metaBlock at the start of the head element
    html = html.replace('<head>', `<head>${metaBlock}`);

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://hostel.dekut.site;");
    return res.status(200).send(html);

  } catch (error) {
    console.error('[API Error]:', error);
    return res.status(500).send('Internal Server Error');
  }
};
