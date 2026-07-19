const https = require('https');

const CF_WORKER_URL = 'https://api.listing.dekut.site/hostels.json';

function fetchHostels() {
  return new Promise((resolve, reject) => {
    const req = https.get(CF_WORKER_URL, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Cloudflare Worker returned HTTP ${res.statusCode}`));
        }
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('Invalid JSON')); }
      });
    });
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timed out')); });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  try {
    const host = req.headers.host || 'hostel.dekut.site';
    const baseUrl = `https://${host}`;

    let hostels = [];
    try {
      hostels = await fetchHostels();
    } catch (e) {
      console.error('Sitemap: failed to fetch from Cloudflare, using fallback data.', e);
      try {
        const fs = require('fs');
        const path = require('path');
        const fallbackPath = path.join(process.cwd(), 'shared', 'data', 'hostels.json');
        if (fs.existsSync(fallbackPath)) {
          hostels = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
        }
      } catch (err) {
        console.error('Sitemap: fallback read failed', err);
      }
    }

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Static pages
    const pages = [
      { path: '', changefreq: 'daily', priority: '1.0' },
      { path: '/locations', changefreq: 'weekly', priority: '0.8' },
      { path: '/scam-reports', changefreq: 'daily', priority: '0.8' },
      { path: '/report-issue', changefreq: 'monthly', priority: '0.5' },
      { path: '/services', changefreq: 'weekly', priority: '0.7' }
    ];

    pages.forEach(p => {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${p.path}</loc>\n`;
      xml += `    <changefreq>${p.changefreq}</changefreq>\n`;
      xml += `    <priority>${p.priority}</priority>\n`;
      xml += `  </url>\n`;
    });

    // Dynamic hostel pages
    hostels.forEach(h => {
      if (h.id != null) {
        const id = h.id;
        const cleanUrl = `${baseUrl}/hostel-details?h=${encodeURIComponent(id)}`;
        xml += `  <url>\n`;
        xml += `    <loc>${cleanUrl}</loc>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.6</priority>\n`;
        xml += `  </url>\n`;
      }
    });

    xml += '</urlset>\n';

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
    return res.status(200).send(xml);
  } catch (error) {
    console.error('Sitemap error:', error);
    return res.status(500).send('Internal Server Error');
  }
};
