export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = globalThis.process?.env?.AV_KEY;
  if (!key) return res.json(null);

  // Alpha Vantage only covers US tickers reliably — strip any exchange suffix
  const raw = (req.query.symbol ?? "").trim().toUpperCase();
  const symbol = raw.replace(/\.(TO|V|L|AX|NS|DE)$/i, "");
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  try {
    const r = await fetch(
      `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${key}`
    );
    if (!r.ok) return res.status(502).json({ error: `Alpha Vantage returned ${r.status}` });

    const d = await r.json();

    // AV rate-limit / invalid symbol responses
    if (d.Note || d["Error Message"] || d.Information || !d.Symbol) return res.json(null);

    const n = (v) => { const x = parseFloat(v); return isNaN(x) ? null : x; };
    const pct = (v) => { const x = n(v); return x != null ? +(x * 100).toFixed(1) : null; };

    return res.json({
      sector:          d.Sector    || null,
      industry:        d.Industry  || null,
      description:     d.Description || null,
      beta:            n(d.Beta),
      peRatio:         n(d.PERatio),
      forwardPE:       n(d.ForwardPE),
      pegRatio:        n(d.PEGRatio),
      priceToBook:     n(d.PriceToBookRatio),
      priceToSales:    n(d.PriceToSalesRatioTTM),
      evToEbitda:      n(d.EVToEBITDA),
      dividendYield:   d.DividendYield ? +(n(d.DividendYield) * 100).toFixed(2) : null,
      eps:             n(d.EPS),
      bookValue:       n(d.BookValue),
      analystTarget:   n(d.AnalystTargetPrice),
      high52w:         n(d["52WeekHigh"]),
      low52w:          n(d["52WeekLow"]),
      operatingMargin: pct(d.OperatingMarginTTM),
      profitMargin:    pct(d.ProfitMargin),
      roe:             pct(d.ReturnOnEquityTTM),
      roa:             pct(d.ReturnOnAssetsTTM),
      revenueTTM:      d.RevenueTTM ? +(n(d.RevenueTTM) / 1e9).toFixed(2) : null,
      revenuePerShare: n(d.RevenuePerShareTTM),
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Alpha Vantage error" });
  }
}
