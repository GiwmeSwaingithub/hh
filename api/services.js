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
    const { service, location } = req.query;

    const host = req.headers.host || 'hostel.dekut.site';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const currentDomain = `${proto}://${host}`;

    let title = 'Student Services — DKUT Hostels';
    let description = 'Browse local student services near Dedan Kimathi University of Technology: Wi-Fi, moving transport, laundry.';
    let image = 'https://i.postimg.cc/rFY2qLtR/Gemini-Generated-Image-ie2z3kie2z3kie2z.png';
    let url = `${currentDomain}/services`;

    if (service) {
      const normalizedService = String(service).toLowerCase().trim();
      if (normalizedService === 'dekut-student-movers' || normalizedService === 'dekut_student_movers') {
        title = 'DeKUT Student Movers — Kuhama Transport';
        description = 'Affordable local hostel moving (Embassy, Gate A, Gate B). Price: KSh 800 - 1,500/move. Coverage Area: Gate A, Gate B, Embassy.';
        image = 'https://images.unsplash.com/photo-1516576885502-d4998ac2b6b0?w=1200&auto=format&fit=crop&q=80';
        url = `${currentDomain}/services?service=dekut-student-movers`;
      } else if (normalizedService === 'nyeri-smart-movers' || normalizedService === 'nyeri_smart_movers') {
        title = 'Nyeri Smart Movers — Kuhama Transport';
        description = 'Professional moving truck with full wrap services. Price: KSh 2,000 - 4,000/move. Coverage Area: Nyeri Town, Mweiga, Local Campus.';
        image = 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1200&auto=format&fit=crop&q=80';
        url = `${currentDomain}/services?service=nyeri-smart-movers`;
      } else if (normalizedService === 'boda-cargo-services' || normalizedService === 'boda_cargo_services') {
        title = 'Boda Cargo Services — Kuhama Transport';
        description = 'Quick single item transport (mattresses, desks, etc.). Price: KSh 200 - 500/trip. Coverage Area: Gate A, Gate B, Embassy, Boma.';
        image = 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1200&auto=format&fit=crop&q=80';
        url = `${currentDomain}/services?service=boda-cargo-services`;
      }
    } else if (location) {
      const normalizedLoc = String(location).toLowerCase().replace(/-/g, ' ').trim();
      url = `${currentDomain}/services?location=${encodeURIComponent(location)}`;

      // Capitalize location helper
      const capLoc = normalizedLoc.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      if (normalizedLoc === 'gate a' || normalizedLoc === 'gatea') {
        title = 'Kuhama Transport in Gate A — DKUT Hostels';
        description = `Find local student moving and transport services supporting Gate A. Supported by DeKUT Student Movers and Boda Cargo Services.`;
        image = 'https://images.unsplash.com/photo-1516576885502-d4998ac2b6b0?w=1200&auto=format&fit=crop&q=80';
      } else if (normalizedLoc === 'gate b' || normalizedLoc === 'gateb') {
        title = 'Kuhama Transport in Gate B — DKUT Hostels';
        description = `Find local student moving and transport services supporting Gate B. Supported by DeKUT Student Movers and Boda Cargo Services.`;
        image = 'https://images.unsplash.com/photo-1516576885502-d4998ac2b6b0?w=1200&auto=format&fit=crop&q=80';
      } else if (normalizedLoc === 'embassy') {
        title = 'Kuhama Transport in Embassy — DKUT Hostels';
        description = `Find local student moving and transport services supporting Embassy. Supported by DeKUT Student Movers and Boda Cargo Services.`;
        image = 'https://images.unsplash.com/photo-1516576885502-d4998ac2b6b0?w=1200&auto=format&fit=crop&q=80';
      } else if (normalizedLoc === 'boma') {
        title = 'Kuhama Transport in Boma — DKUT Hostels';
        description = `Find local student moving and transport services supporting Boma. Supported by Boda Cargo Services.`;
        image = 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1200&auto=format&fit=crop&q=80';
      } else if (normalizedLoc === 'nyeri' || normalizedLoc === 'nyeri town') {
        title = 'Kuhama Transport to Nyeri Town — DKUT Hostels';
        description = `Professional moving and transport services supporting transit to Nyeri Town. Supported by Nyeri Smart Movers.`;
        image = 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1200&auto=format&fit=crop&q=80';
      } else if (normalizedLoc === 'mweiga') {
        title = 'Kuhama Transport to Mweiga — DKUT Hostels';
        description = `Professional moving and transport services supporting transit to Mweiga. Supported by Nyeri Smart Movers.`;
        image = 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1200&auto=format&fit=crop&q=80';
      } else {
        title = `Kuhama Transport in ${capLoc} — DKUT Hostels`;
        description = `Find local student moving and transport services supporting ${capLoc} near Dedan Kimathi University of Technology.`;
        image = 'https://images.unsplash.com/photo-1516576885502-d4998ac2b6b0?w=1200&auto=format&fit=crop&q=80';
      }
    }

    // Read the static template
    const templatePath = path.join(process.cwd(), 'pages', 'services', 'index.html');
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
    console.error('[Services API Error]:', error);
    return res.status(500).send('Internal Server Error');
  }
};
