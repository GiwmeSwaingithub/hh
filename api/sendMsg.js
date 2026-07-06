const JSON_HEADERS = {
  "Content-Type": "application/json"
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { msg, images = [], username = 'dekutconnect', qid = '' } = req.body;

    let finalMsg = msg;
    if (images && images.length > 0) {
      finalMsg = `${msg}\n${images[0]}`;
    }

    const response = await fetch(
      "https://twet.link/api/web/sendMsg",
      {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          msg: finalMsg,
          username: username,
          qid: qid,
          images: images
        })
      }
    );

    const text = await response.text();
    res.status(response.status).send(text);

  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ error: err.message });
  }
};
