// api/order-history.js

export default async function handler(req, res) {
  // 只接受 POST，其他一律拒絕
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const GAS_URL = process.env.GAS_ORDER_HISTORY_URL;

  // 1) 檢查環境變數是否有設
  if (!GAS_URL) {
    res.status(500).json({
      success: false,
      message: 'GAS_ORDER_HISTORY_URL is not set in environment variables',
    });
    return;
  }

  try {
    // 2) 讀取 request body（在 Vercel Node 環境自己解析）
    let rawBody = '';
    await new Promise((resolve, reject) => {
      req.on('data', (chunk) => {
        rawBody += chunk;
      });
      req.on('end', resolve);
      req.on('error', reject);
    });

    let body = {};
    if (rawBody) {
      body = JSON.parse(rawBody);
    }

    const lineUserId = body.lineUserId;
    if (!lineUserId) {
      res.status(400).json({
        success: false,
        message: 'lineUserId is required in request body',
      });
      return;
    }

    // 3) 組成呼叫 GAS 的 URL：?action=history&lineUserId=...
    const params = new URLSearchParams();
    params.set('action', 'history');
    params.set('lineUserId', lineUserId);

    const url = `${GAS_URL}?${params.toString()}`;

    // 4) 呼叫 GAS（原本前端直接打的那個網址）
    const response = await fetch(url, { method: 'GET' });

    const text = await response.text();

    // 4-1) 如果 HTTP 狀態不是 2xx，回傳錯誤（帶一點 debug）
    if (!response.ok) {
      res.status(500).json({
        success: false,
        message: `GAS HTTP Error ${response.status}`,
        raw: text.slice(0, 200),  // 前 200 字 debug 用
      });
      return;
    }

    // 4-2) 嘗試把 GAS 回傳的文字 parse 成 JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'GAS response is not valid JSON',
        raw: text.slice(0, 200),
      });
      return;
    }

    // 5) 一切正常 → 直接把 GAS 的結果回傳給前端
    res.status(200).json(data);
  } catch (err) {
    console.error('order-history API error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Unknown error',
    });
  }
}
