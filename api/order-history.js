// api/order-history.js
export default async function handler(req, res) {
  try {
    const GAS_URL = process.env.GAS_ORDER_HISTORY_URL;

    if (!GAS_URL) {
      throw new Error('GAS_ORDER_HISTORY_URL is not set');
    }

    // 前端會用 POST 傳來 { lineUserId }
    const { lineUserId } = req.body || {};
    if (!lineUserId) {
      return res.status(400).json({ success: false, message: 'lineUserId is required' });
    }

    // 幫你組成原本的 GET URL： ?action=history&lineUserId=...
    const params = new URLSearchParams();
    params.set('action', 'history');
    params.set('lineUserId', lineUserId);

    const url = `${GAS_URL}?${params.toString()}`;

    const response = await fetch(url, { method: 'GET' });
    const data = await response.json();

    res.status(200).json(data);
  } catch (err) {
    console.error('order-history API error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}
