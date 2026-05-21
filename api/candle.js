const FULL_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const RANGE_DAYS = { "1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730 };

async function fetchYahooChart(symbol, range) {
  const headers = {
    "User-Agent": FULL_UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
  };
  for (const host of ["query1", "query2"]) {
    try {
      const r = await fetch(
        `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`,
        { headers }
      );
      if (!r.ok) continue;
      const d = await r.json();
      const closes = d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
      if (Array.isArray(closes) && closes.length >= 3) return closes.filter(v => v != null);
    } catch { /* try next */ }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const yahooSymbol   = (req.query.symbol        ?? "").trim();
  const finnhubSymbol = (req.query.finnhubSymbol  ?? "").trim().toUpperCase();

  if (!yahooSymbol && !finnhubSymbol) return res.status(400).json({ error: "Missing symbol" });

  const validRanges = ["1mo", "3mo", "6mo", "1y", "2y"];
  const range = validRanges.includes(req.query.range) ? req.query.range : "1mo";

  const key = process.env.FINNHUB_KEY || process.env.FINNHUB_API_KEY;

  // ── 1. Finnhub candle (primary — reliable, uses API key) ──────────────────
  if (key && finnhubSymbol) {
    try {
      const now  = Math.floor(Date.now() / 1000);
      const from = now - (RANGE_DAYS[range] ?? 30) * 86400;

      const r = await fetch(
        `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(finnhubSymbol)}&resolution=D&from=${from}&to=${now}&token=${key}`
      );
      if (r.ok) {
        const d = await r.json();
        if (d.s === "ok" && Array.isArray(d.c) && d.c.length >= 3) {
          return res.json({ prices: d.c, timestamps: d.t ?? null, source: "finnhub" });
        }
      }
    } catch { /* fall through */ }
  }

  // ── 2. Yahoo Finance (fallback — query1 then query2) ─────────────────────
  if (yahooSymbol) {
    const prices = await fetchYahooChart(yahooSymbol, range);
    if (prices) return res.json({ prices, source: "yahoo" });
  }

  return res.json({ prices: null });
}
