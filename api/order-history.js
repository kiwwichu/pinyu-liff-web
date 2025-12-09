// api/order-history.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  const GAS_URL = process.env.GAS_ORDER_HISTORY_URL;

  if (!GAS_URL) {
    res.status(500).json({
      success: false,
      message: "GAS_ORDER_HISTORY_URL is not set in environment variables",
    });
    return;
  }

  try {
    // Vercel 會自動幫你把 JSON body 變成 req.body
    const { lineUserId } = req.body || {};
    if (!lineUserId) {
      res.status(400).json({
        success: false,
        message: "lineUserId is required in request body",
      });
      return;
    }

    // 組成 call GAS 的 URL
    const params = new URLSearchParams({
      action: "history",
      lineUserId,
    });

    const url = `${GAS_URL}?${params.toString()}`;

    const gasRes = await fetch(url, { method: "GET" });
    const gasText = await gasRes.text();

    let gasJson;
    try {
      gasJson = JSON.parse(gasText);
    } catch (e) {
      // GAS 有回應，但不是 JSON → 回給前端 debug
      res.status(200).json({
        success: false,
        from: "vercel",
        message: "GAS response is not valid JSON",
        raw: gasText.slice(0, 200),
      });
      return;
    }

    // ✅ 不管 success 是 true / false，都用 200 回去
    res.status(200).json(gasJson);
  } catch (err) {
    console.error("order-history API error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Unknown error",
    });
  }
}
