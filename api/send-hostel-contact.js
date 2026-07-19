const JSON_HEADERS = {
  "Content-Type": "application/json"
};

const BOT_SERVER_URL = process.env.BOT_SERVER_URL || 'http://20.164.16.100:5000';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const targetUrl = `${BOT_SERVER_URL.replace(/\/$/, '')}/api/send-hostel-contact`;
    
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(req.body || {})
    });

    const data = await response.json().catch(() => null);
    
    if (data) {
      return res.status(response.status).json(data);
    } else {
      return res.status(response.status).json({
        error: `Bot server returned status ${response.status}. Please make sure updated bot code is running on ${BOT_SERVER_URL}.`
      });
    }
  } catch (err) {
    console.error("[api/send-hostel-contact proxy error]:", err.message);
    return res.status(502).json({
      error: `Could not connect to bot server (${err.message}). Make sure PM2 is running on ${BOT_SERVER_URL}.`
    });
  }
};
