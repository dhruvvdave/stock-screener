export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = process.env.FINNHUB_KEY || process.env.FINNHUB_API_KEY;
  if (!key) return res.status(500).json({ error: "Missing FINNHUB_KEY" });

  const symbol = (req.query.symbol ?? "").trim().toUpperCase();
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${key}`
    );
    if (!r.ok) return res.status(502).json({ error: `Finnhub returned ${r.status}` });

    const d = await r.json();
    const m = d.metric ?? {};

    return res.json({
      pe:            m.peTTM             ?? m.peAnnual                     ?? null,
      pb:            m.pbAnnual          ?? m.pbQuarterly                  ?? null,
      beta:          m.beta                                                 ?? null,
      // Finnhub marketCapitalization is in millions USD → convert to billions
      mktCap:        m.marketCapitalization != null
                       ? +(m.marketCapitalization / 1000).toFixed(2)
                       : null,
      // Growth fields come back as percent values (e.g. 15.2 = 15.2%)
      epsGrowth:     m.epsGrowthTTMYoy        ?? m.epsGrowthQuarterlyYoy ?? null,
      revGrowth:     m.revenueGrowthTTMYoy    ?? m.revenueGrowthQuarterlyYoy ?? null,
      // Dividend yield comes back as a percent (e.g. 2.5 = 2.5%)
      dividendYield: m.dividendYieldIndicatedAnnual ?? m.currentDividendYieldTTM ?? null,
      high52w:       m["52WeekHigh"]            ?? null,
      low52w:        m["52WeekLow"]             ?? null,
      // Average volume is in millions of shares
      avgVol:        m["10DayAverageTradingVolume"] ?? null,
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Metrics fetch failed" });
  }
}
