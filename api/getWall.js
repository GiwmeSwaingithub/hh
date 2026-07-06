const JSON_HEADERS = {
  "Content-Type": "application/json"
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const response = await fetch(
      "https://twet.link/api/web/getWall",
      {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(req.body)
      }
    );

    const text = await response.text();
    res.status(response.status).send(text);

  } catch (err) {
    console.error("Error loading wall:", err);
    res.status(500).json({ error: err.message });
  }
};
