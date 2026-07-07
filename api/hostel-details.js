const https = require('https');
const path = require('path');

const CF_WORKER_URL = 'https://dekuthostels-cache.giwme1socialtalk.workers.dev/hostels.json';

// Fetch hostels JSON from Cloudflare Worker (the single source of truth).
function fetchHostelsFromCF() {
  return new Promise((resolve, reject) => {
    const req = https.get(CF_WORKER_URL, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Cloudflare Worker returned HTTP ${res.statusCode}`));
        }
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('Invalid JSON from Cloudflare Worker')); }
      });
    });
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Cloudflare Worker request timed out')); });
    req.on('error', reject);
  });
}

function escapeAttr(str) {
  if (str == null) return '';
  return String(str)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const fs = require('fs');

module.exports = async (req, res) => {
  try {
    const { h } = req.query;

    // Default metadata values
    let title = 'Hostel Details — DKUT Hostels';
    let description = 'Full hostel details, photos, pricing, and contact information.';
    let image = 'https://i.postimg.cc/rFY2qLtR/Gemini-Generated-Image-ie2z3kie2z3kie2z.png';
    let url = `https://${req.headers.host || 'hostel.dekut.site'}/hostel-details` + (h ? `?h=${encodeURIComponent(h)}` : '');

    let jsonLdScript = '';

    if (h) {
      // Fetch from Cloudflare Worker — the single source of truth
      const hostels = await fetchHostelsFromCF();

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
              if (r.price.amountAlone)   prices.push({ val: r.price.amountAlone,   type: r.price.period || 'semester' });
            }
          });
          if (prices.length > 0) {
            const minP = prices.reduce((m, p) => p.val < m.val ? p : m, prices[0]);
            const maxP = prices.reduce((m, p) => p.val > m.val ? p : m, prices[0]);
            const fmt  = (p) => {
              if (p.val > 0 && p.val < 200) return `KES ${p.val}/night`;
              const t = p.type === 'semester' ? 'sem' : p.type;
              return `KES ${p.val.toLocaleString('en-KE')}/${t}`;
            };
            priceStr = minP.val === maxP.val ? fmt(minP) : `${fmt(minP)} - ${fmt(maxP)}`;
          }
        } else {
          const prices = [];
          if (hostel.price)      prices.push({ val: hostel.price,      type: 'sem' });
          if (hostel.priceAlone) prices.push({ val: hostel.priceAlone, type: 'sem' });
          if (prices.length > 0) {
            const minP = prices.reduce((m, p) => p.val < m.val ? p : m, prices[0]);
            const maxP = prices.reduce((m, p) => p.val > m.val ? p : m, prices[0]);
            const fmt  = (p) => `KES ${p.val.toLocaleString('en-KE')}/${p.type}`;
            priceStr = minP.val === maxP.val ? fmt(minP) : `${fmt(minP)} - ${fmt(maxP)}`;
          }
        }

        priceStr = priceStr ? `Price: ${priceStr}` : 'Price: Contact for pricing';

        // Combined price + description for Open Graph
        description = `${priceStr} | ${hostel.description || 'No description available.'}`;
        if (description.length > 250) description = description.slice(0, 247) + '...';

        if (hostel.media && hostel.media.coverImage) image = hostel.media.coverImage;
        else if (hostel.image) image = hostel.image;

        // Build JSON-LD
        const jsonLd = {
          "@context": "https://schema.org",
          "@type": "Hostel",
          "name": hostel.name || 'Hostel',
          "description": hostel.description || 'Student housing near Dedan Kimathi University of Technology',
          "image": image,
          "url": url,
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Nyeri",
            "addressRegion": "Nyeri County",
            "addressCountry": "KE"
          },
          "location": {
            "@type": "Place",
            "name": (hostel.location && typeof hostel.location === 'object' ? hostel.location.gate : hostel.location) || 'Nyeri'
          }
        };

        jsonLd.telephone = "+254769486775";

        let priceVal = 0;
        let offers = [];

        if (hostel.rooms && Array.isArray(hostel.rooms) && hostel.rooms.length > 0) {
          const prices = [];
          hostel.rooms.forEach(r => {
            if (r.price) {
              const period = r.price.period || 'semester';
              const rName = r.name || 'Room';
              if (r.price.amountSharing > 0) {
                prices.push(r.price.amountSharing);
                offers.push({
                  "@type": "Offer",
                  "name": `${rName} (Sharing, per ${period})`,
                  "price": r.price.amountSharing,
                  "priceCurrency": "KES"
                });
              }
              if (r.price.amountAlone > 0) {
                prices.push(r.price.amountAlone);
                offers.push({
                  "@type": "Offer",
                  "name": `${rName} (Single, per ${period})`,
                  "price": r.price.amountAlone,
                  "priceCurrency": "KES"
                });
              }
            }
          });
          if (prices.length > 0) {
            priceVal = Math.min(...prices);
          }
        } else {
          priceVal = hostel.price || hostel.priceAlone || 0;
          if (priceVal > 0) {
             offers.push({
               "@type": "Offer",
               "name": "Base Rate",
               "price": priceVal,
               "priceCurrency": "KES"
             });
          }
        }

        if (priceVal > 0) {
          jsonLd.priceRange = `KES ${priceVal}+`;
        }
        if (offers.length > 0) {
          jsonLd.offers = offers;
        }
        jsonLdScript = `\n    <script type="application/ld+json">\n    ${JSON.stringify(jsonLd, null, 2)}\n    </script>\n`;
      }
    }

    // Read the static HTML template
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
    <meta name="twitter:image" content="${escapeAttr(image)}" />${jsonLdScript}
    `;

    // Strip duplicate static tags from the template
    html = html.replace(/<title>[^]*?<\/title>/gi, '');
    html = html.replace(/<meta\s+[^>]*?name=["']description["'][^>]*?\/?>/gi, '');
    html = html.replace(/<meta\s+[^>]*?property=["']og:[^]*?["'][^>]*?\/?>/gi, '');
    html = html.replace(/<meta\s+[^>]*?name=["']twitter:[^]*?["'][^>]*?\/?>/gi, '');
    html = html.replace(/<link\s+[^>]*?rel=["']icon["'][^>]*?\/?>/gi, '');

    // Inject dynamic meta at the start of <head>
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
