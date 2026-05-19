export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = process.env.FINNHUB_KEY;
  if (!key) return res.status(503).json({ prices: null });

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  const to   = Math.floor(Date.now() / 1000);
  const from = to - 42 * 24 * 60 * 60;

  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${key}`
    );
    const d = await r.json();
    if (d.s !== "ok" || !Array.isArray(d.c) || d.c.length < 2) {
      return res.json({ prices: null });
    }
    res.json({ prices: d.c.slice(-30) });
  } catch (e) {
    res.status(500).json({ prices: null, error: e.message });
  }
}
