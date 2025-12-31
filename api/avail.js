export default async function handler(req, res) {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ error: "Missing year/month" });
    }

    const GAS_URL = process.env.GAS_URL;
    if (!GAS_URL) {
      return res.status(500).json({ error: "Missing GAS_URL env" });
    }

    // 1️⃣ 從 GAS 拿原始資料
    const url = `${GAS_URL}?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`;
    const r = await fetch(url);
    const text = await r.text();

    if (!r.ok) {
      return res.status(r.status).json({ error: "GAS error", body: text });
    }

    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      return res.status(502).json({
        error: "GAS returned non-JSON",
        body: text.slice(0, 200)
      });
    }

    // 2️⃣ 整理成 date -> slot -> item
    const map = new Map();
    for (const it of Array.isArray(raw) ? raw : []) {
      if (!map.has(it.date)) map.set(it.date, {});
      map.get(it.date)[it.slot] = it;
    }

    const SLOTS = ["MORNING", "AFTERNOON", "EVENING"];
    const result = [];

    // 3️⃣ 補齊三段 + 統一狀態
    for (const [date, slots] of map.entries()) {
      for (const s of SLOTS) {
        const it = slots[s] || {};

        const mins = Number(it.availableMinutes || 0);

        // 👉 統一 status（只留三種）
        let status = String(it.status || "").trim();
        if (status !== "開放" && status !== "少量" && status !== "額滿") {
          status = mins <= 0 ? "額滿" : (mins <= 60 ? "少量" : "開放");
        }

        result.push({
          date,
          slot: s,
          start: it.start || "—",
          end: it.end || "—",
          availableMinutes: mins,
          status,
          blocked: it.blocked || it.occupied || "",
          remaining: it.remaining || it.note || ""
        });
      }
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(result);

  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
