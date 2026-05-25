export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = process.env.FINNHUB_KEY || process.env.FINNHUB_API_KEY;
  if (!key) return res.json({ buy: 0, hold: 0, sell: 0, total: 0, meanTarget: null, highTarget: null, lowTarget: null, bullish: null, bearish: null, articles: 0 });

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  try {
    // Fetch analyst recommendations, price targets, and news sentiment in one round-trip
    const [recRes, tgtRes, sentRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${key}`),
      fetch(`https://finnhub.io/api/v1/stock/price-target?symbol=${encodeURIComponent(symbol)}&token=${key}`),
      fetch(`https://finnhub.io/api/v1/news-sentiment?symbol=${encodeURIComponent(symbol)}&token=${key}`),
    ]);
    const [rec, tgt, sent] = await Promise.all([recRes.json(), tgtRes.json(), sentRes.json()]);

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
      lowTarget:  tgt?.targetLow  ?? null,
      // Sentiment fields (formerly api/sentiment.js)
      bullish:    sent?.sentiment?.bullishPercent ?? null,
      bearish:    sent?.sentiment?.bearishPercent ?? null,
      articles:   sent?.buzz?.articlesInLastWeek  ?? 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
