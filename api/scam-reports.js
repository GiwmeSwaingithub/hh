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
    const templatePath = path.join(process.cwd(), 'pages', 'scam-reports', 'index.html');
    if (!fs.existsSync(templatePath)) {
      return res.status(404).send('Template not found');
    }

    let html = fs.readFileSync(templatePath, 'utf8');

    const host = req.headers.host || 'hostel.dekut.site';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const currentDomain = `${proto}://${host}`;

    const title = 'Scam Alerts — DKUT Hostels';
    const description = 'Check phone numbers and view reported scam alerts for DKUT student hostels.';
    const image = 'https://i.postimg.cc/rFY2qLtR/Gemini-Generated-Image-ie2z3kie2z3kie2z.png';
    const url = `${currentDomain}/scam-reports`;

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
    html = html.replace(/<meta\s+[^>]*?property=["']og:[^>]*?["'][^>]*?\/?>/gi, '');
    html = html.replace(/<meta\s+[^>]*?name=["']twitter:[^>]*?["'][^>]*?\/?>/gi, '');
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
    console.error('[Scam Reports API Error]:', error);
    return res.status(500).send('Internal Server Error');
  }
};
