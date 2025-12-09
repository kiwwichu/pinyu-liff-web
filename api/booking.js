export default async function handler(req, res) {
  try {
    const GAS_URL = process.env.GAS_WEB_APP_URL;  // 從環境變數取得

    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),  // 前端傳來什麼，就丟給 GAS
    });

    const data = await response.json();
    res.status(200).json(data);

    // 你也可以在這裡多做驗證、log 等

  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
