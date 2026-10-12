const OFFICIAL_HOLIDAYS = {
  2026: [
    ["2026-01-01", "中華民國開國紀念日"],
    ["2026-02-15", "除夕前一日"],
    ["2026-02-16", "除夕"],
    ["2026-02-17", "春節"],
    ["2026-02-18", "春節"],
    ["2026-02-19", "春節"],
    ["2026-02-20", "春節補假"],
    ["2026-02-27", "和平紀念日補假"],
    ["2026-02-28", "和平紀念日"],
    ["2026-04-03", "兒童節補假"],
    ["2026-04-04", "兒童節"],
    ["2026-04-05", "清明節"],
    ["2026-04-06", "清明節補假"],
    ["2026-05-01", "勞動節"],
    ["2026-06-19", "端午節"],
    ["2026-09-25", "中秋節"],
    ["2026-09-28", "孔子誕辰紀念日／教師節"],
    ["2026-10-09", "國慶日補假"],
    ["2026-10-10", "國慶日"],
    ["2026-10-25", "臺灣光復暨金門古寧頭大捷紀念日"],
    ["2026-10-26", "臺灣光復暨金門古寧頭大捷紀念日補假"],
    ["2026-12-25", "行憲紀念日"]
  ],
  2027: [
    ["2027-01-01", "中華民國開國紀念日"],
    ["2027-02-04", "除夕前一日"],
    ["2027-02-05", "除夕"],
    ["2027-02-06", "春節"],
    ["2027-02-07", "春節"],
    ["2027-02-08", "春節"],
    ["2027-02-09", "春節補假"],
    ["2027-02-10", "春節補假"],
    ["2027-02-28", "和平紀念日"],
    ["2027-03-01", "和平紀念日補假"],
    ["2027-04-04", "兒童節"],
    ["2027-04-05", "清明節"],
    ["2027-04-06", "兒童節補假"],
    ["2027-04-30", "勞動節補假"],
    ["2027-05-01", "勞動節"],
    ["2027-06-09", "端午節"],
    ["2027-09-15", "中秋節"],
    ["2027-09-28", "孔子誕辰紀念日／教師節"],
    ["2027-10-10", "國慶日"],
    ["2027-10-11", "國慶日補假"],
    ["2027-10-25", "臺灣光復暨金門古寧頭大捷紀念日"],
    ["2027-12-24", "行憲紀念日補假"],
    ["2027-12-25", "行憲紀念日"],
    ["2027-12-31", "2028 年開國紀念日補假"]
  ]
};

function mergeOfficialHolidays(year, upstreamHolidays) {
  const merged = new Map();
  for (const [date, name] of (OFFICIAL_HOLIDAYS[Number(year)] || [])) {
    merged.set(date, { date, name });
  }
  for (const holiday of (Array.isArray(upstreamHolidays) ? upstreamHolidays : [])) {
    if (holiday && holiday.date) merged.set(holiday.date, holiday);
  }
  return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export default async function handler(req, res) {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ error: "Missing year/month" });
    }

    // 新版可預約資料由 Google 登入管理後台統一產生；保留環境變數方便未來換部署。
    const GAS_URL = process.env.GAS_AVAILABILITY_URL_V2 ||
      "https://script.google.com/macros/s/AKfycbweEgihk4m_BqZin1V8BHTt19Dy8QOf490XJ-lFY03M3JBMNYh_hna2vqV9W7MlqxIsmQ/exec";

    // 1️⃣ 從 GAS 拿原始資料
    const url = `${GAS_URL}?action=availability&year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`;
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

    if (raw && raw.error) {
      return res.status(502).json(raw);
    }

    const source = Array.isArray(raw) ? raw : (Array.isArray(raw.avail) ? raw.avail : []);
    const holidays = mergeOfficialHolidays(year, raw?.holidays);

    // 2️⃣ 整理成 date -> slot -> item
    const map = new Map();
    for (const it of source) {
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
    return res.status(200).json({ avail: result, holidays });

  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
