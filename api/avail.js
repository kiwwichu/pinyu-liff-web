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

    const url = `${GAS_URL}?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`;
    const r = await fetch(url);
    const text = await r.text();

    if (!r.ok) {
      return res.status(r.status).json({ error: "GAS error", body: text });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        error: "GAS returned non-JSON",
        body: text.slice(0, 200)
      });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
