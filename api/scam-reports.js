const fs = require('fs');
const path = require('path');

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

    // Meta tags to inject/replace dynamically
    const dynamicOgImage = 'https://i.postimg.cc/rFY2qLtR/Gemini-Generated-Image-ie2z3kie2z3kie2z.png';
    const dynamicOgUrl = `${currentDomain}/scam-reports`;

    // Strip duplicate static image and url tags from the template
    html = html.replace(/<meta\s+[^>]*?property=["']og:image["'][^>]*?\/?>/gi, '');
    html = html.replace(/<meta\s+[^>]*?name=["']twitter:image["'][^>]*?\/?>/gi, '');
    html = html.replace(/<meta\s+[^>]*?property=["']og:url["'][^>]*?\/?>/gi, '');
    html = html.replace(/<meta\s+[^>]*?name=["']twitter:url["'][^>]*?\/?>/gi, '');

    const injectMeta = `
    <meta property="og:url" content="${dynamicOgUrl}" />
    <meta property="og:image" content="${dynamicOgImage}" />
    <meta name="twitter:url" content="${dynamicOgUrl}" />
    <meta name="twitter:image" content="${dynamicOgImage}" />
    `;

    // Inject dynamic meta tags at the start of the head element
    html = html.replace('<head>', `<head>${injectMeta}`);

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
