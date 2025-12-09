// /api/sendLineMessage.js
export default async function handler(req, res) {
  const LINE_TOKEN = process.env.LINE_TOKEN; // 只存在後端

  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LINE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req.body),
  });

  res.status(200).json({ ok: true });
}
