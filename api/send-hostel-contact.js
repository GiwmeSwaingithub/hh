const JSON_HEADERS = {
  "Content-Type": "application/json"
};

const BOT_SERVER_URL = process.env.BOT_SERVER_URL || 'http://20.164.16.100:5000';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const base = BOT_SERVER_URL.replace(/\/$/, '');
  const candidateEndpoints = [
    `${base}/api/send-hostel-contact`,
    `${base}/send-hostel-contact`,
    `${base}/hostel-contact`,
    `${base}/api/hostel-contact`,
    `${base}/api/web/send-hostel-contact`
  ];

  for (const targetUrl of candidateEndpoints) {
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(req.body || {})
      });

      if (response.status !== 404) {
        const data = await response.json().catch(() => null);
        if (data) {
          return res.status(response.status).json(data);
        } else {
          return res.status(response.status).json({
            error: `Bot server endpoint ${targetUrl} returned status ${response.status}.`
          });
        }
      }
    } catch (err) {
      console.warn(`[send-hostel-contact proxy candidate error for ${targetUrl}]:`, err.message);
    }
  }

  return res.status(404).json({
    error: `Bot server (${base}) returned 404. The updated bot code (with endpoint POST /api/send-hostel-contact) has not been restarted on the server yet. Please run 'pm2 restart dekutconnect-wa-bot' on the server.`
  });
};
