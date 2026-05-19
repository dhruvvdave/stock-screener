export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = process.env.FINNHUB_KEY || process.env.FINNHUB_API_KEY;
  if (!key) return res.status(503).json({ error: "Service not configured" });

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  try {
    const [recRes, tgtRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${key}`),
      fetch(`https://finnhub.io/api/v1/stock/price-target?symbol=${encodeURIComponent(symbol)}&token=${key}`),
    ]);
    const [rec, tgt] = await Promise.all([recRes.json(), tgtRes.json()]);

    const latest = Array.isArray(rec) && rec.length > 0
      ? [...rec].sort((a, b) => b.period.localeCompare(a.period))[0]
      : null;

    res.json({
      buy:        (latest?.buy ?? 0) + (latest?.strongBuy ?? 0),
      hold:       latest?.hold ?? 0,
      sell:       (latest?.sell ?? 0) + (latest?.strongSell ?? 0),
      total:      (latest?.buy ?? 0) + (latest?.strongBuy ?? 0) + (latest?.hold ?? 0)
                + (latest?.sell ?? 0) + (latest?.strongSell ?? 0),
      meanTarget: tgt?.targetMean ?? null,
      highTarget: tgt?.targetHigh ?? null,
      lowTarget:  tgt?.targetLow ?? null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
