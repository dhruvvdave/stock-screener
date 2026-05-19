export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = process.env.FINNHUB_KEY || process.env.FINNHUB_API_KEY;
  if (!key) return res.status(503).json({ error: "Service not configured" });

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/news-sentiment?symbol=${encodeURIComponent(symbol)}&token=${key}`
    );
    const d = await r.json();
    res.json({
      bullish:  d.sentiment?.bullishPercent ?? null,
      bearish:  d.sentiment?.bearishPercent ?? null,
      articles: d.buzz?.articlesInLastWeek ?? 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
