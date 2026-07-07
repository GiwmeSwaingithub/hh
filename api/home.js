const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  try {
    const templatePath = path.join(process.cwd(), 'pages', 'home', 'index.html');
    if (!fs.existsSync(templatePath)) {
      return res.status(404).send('Template not found');
    }

    let html = fs.readFileSync(templatePath, 'utf8');

    const host = req.headers.host || 'hostel.dekut.site';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const currentDomain = `${proto}://${host}`;

    const loc = (req.query.loc || '').trim().toLowerCase();

    // Meta tags to inject/replace dynamically
    let dynamicOgImage = 'https://i.postimg.cc/rFY2qLtR/Gemini-Generated-Image-ie2z3kie2z3kie2z.png';
    let dynamicOgUrl = `${currentDomain}/` + (loc ? `?loc=${encodeURIComponent(loc)}` : '');
    let dynamicOgTitle = 'DKUT Hostels — Student Housing Near DeKUT';
    let dynamicOgDesc = 'Find verified, affordable student hostels near Dedan Kimathi University of Technology in Nyeri, Kenya.';

    if (loc === 'embassy') {
      dynamicOgTitle = 'Embassy Area Hostels — Student Housing Near DeKUT';
      dynamicOgDesc = 'Find the best verified student hostels in the popular Embassy Area, just a 1-3 mins walk to Dedan Kimathi University of Technology (DeKUT).';
    } else if (loc) {
      const locName = loc.replace(/-/g, ' ');
      const formattedLoc = locName.charAt(0).toUpperCase() + locName.slice(1);
      dynamicOgTitle = `${formattedLoc} Hostels — Student Housing Near DeKUT`;
      dynamicOgDesc = `Find verified, affordable student hostels in ${formattedLoc} area near Dedan Kimathi University of Technology (DeKUT).`;
    }

    // Strip duplicate static image, url, title, description tags from the template
    html = html.replace(/<title>[^]*?<\/title>/gi, '');
    html = html.replace(/<meta\s+[^>]*?name=["']description["'][^>]*?\/?>/gi, '');
    html = html.replace(/<meta\s+[^>]*?property=["']og:title["'][^>]*?\/?>/gi, '');
    html = html.replace(/<meta\s+[^>]*?property=["']og:description["'][^>]*?\/?>/gi, '');
    html = html.replace(/<meta\s+[^>]*?name=["']twitter:title["'][^>]*?\/?>/gi, '');
    html = html.replace(/<meta\s+[^>]*?name=["']twitter:description["'][^>]*?\/?>/gi, '');
    html = html.replace(/<meta\s+[^>]*?property=["']og:image["'][^>]*?\/?>/gi, '');
    html = html.replace(/<meta\s+[^>]*?name=["']twitter:image["'][^>]*?\/?>/gi, '');
    html = html.replace(/<meta\s+[^>]*?property=["']og:url["'][^>]*?\/?>/gi, '');
    html = html.replace(/<meta\s+[^>]*?name=["']twitter:url["'][^>]*?\/?>/gi, '');

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "DKUT Hostels",
      "url": `${currentDomain}/`,
      "description": "Find verified, affordable student hostels near Dedan Kimathi University of Technology (DeKUT) in Nyeri, Kenya.",
      "potentialAction": {
        "@type": "SearchAction",
        "target": `${currentDomain}/?q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    };
    const jsonLdScript = `\n    <script type="application/ld+json">\n    ${JSON.stringify(jsonLd, null, 2)}\n    </script>\n`;

    const injectMeta = `
    <title>${dynamicOgTitle}</title>
    <meta name="description" content="${dynamicOgDesc}" />
    <meta property="og:url" content="${dynamicOgUrl}" />
    <meta property="og:title" content="${dynamicOgTitle}" />
    <meta property="og:description" content="${dynamicOgDesc}" />
    <meta property="og:image" content="${dynamicOgImage}" />
    <meta name="twitter:url" content="${dynamicOgUrl}" />
    <meta name="twitter:title" content="${dynamicOgTitle}" />
    <meta name="twitter:description" content="${dynamicOgDesc}" />
    <meta name="twitter:image" content="${dynamicOgImage}" />${jsonLdScript}`;

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
    console.error('[Home API Error]:', error);
    return res.status(500).send('Internal Server Error');
  }
};
