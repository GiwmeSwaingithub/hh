const FORM_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Missing image data" });
    }

    const formBody = `key=987fc957168af200a76fba3f94f60518` +
      `&o=2b819584285c102318568238c7d4a4c7` +
      `&m=59c2ad4b46b0c1e12d5703302bff0120` +
      `&version=1.0.1` +
      `&portable=1` +
      `&name=image` +
      `&type=jpeg` +
      `&image=${encodeURIComponent(image)}`;

    const postimageRes = await fetch("https://api.postimage.org/1/upload", {
      method: "POST",
      headers: FORM_HEADERS,
      body: formBody
    });

    if (!postimageRes.ok) {
      const errText = await postimageRes.text();
      throw new Error(`Postimage upload failed: ${errText}`);
    }

    const responseText = await postimageRes.text();
    const match = responseText.match(/<hotlink>(.*?)<\/hotlink>/);
    if (!match) {
      throw new Error(`Failed to extract hotlink from response: ${responseText}`);
    }

    const imageUrl = match[1];
    res.status(200).json({ imageUrl });

  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message });
  }
};
