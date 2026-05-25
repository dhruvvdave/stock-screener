// Combines Financial Modeling Prep (FMP_KEY) and Alpha Vantage (AV_KEY) into one function.
// Both are optional — returns null for each source if the key is absent or data unavailable.

async function fetchFMP(symbol) {
  const key = globalThis.process?.env?.FMP_KEY;
  if (!key) return null;
  const bare = symbol.replace(/\.(TO|V|L|AX|NS|DE)$/i, "");
  try {
    const [metricsRes, incomeRes] = await Promise.all([
      fetch(`https://financialmodelingprep.com/api/v3/key-metrics/${encodeURIComponent(bare)}?limit=1&apikey=${key}`),
      fetch(`https://financialmodelingprep.com/api/v3/income-statement/${encodeURIComponent(bare)}?limit=4&apikey=${key}`),
    ]);
    const metrics = metricsRes.ok ? ((await metricsRes.json())?.[0] ?? null) : null;
    const income  = incomeRes.ok  ? ((await incomeRes.json())  ?? [])         : [];
    const latest  = income[0] ?? null;
    if (!metrics && !latest) return null;
    const n = (v, d = 2) => v != null && isFinite(v) ? +Number(v).toFixed(d) : null;
    return {
      peRatio:          n(metrics?.peRatio, 1),
      evToEbitda:       n(metrics?.enterpriseValueMultiple, 1),
      psRatio:          n(metrics?.priceToSalesRatio, 2),
      roic:             metrics?.roic != null ? n(metrics.roic * 100, 1) : null,
      revenueAnnual:    latest?.revenue   != null ? n(latest.revenue   / 1e9, 2) : null,
      netIncomeAnnual:  latest?.netIncome != null ? n(latest.netIncome / 1e9, 2) : null,
      grossMargin:      latest?.grossProfitRatio != null ? n(latest.grossProfitRatio * 100, 1) : null,
      epsAnnual:        n(latest?.eps, 2),
      revenueGrowthYoY: income.length >= 2 && income[0]?.revenue && income[1]?.revenue
        ? n((income[0].revenue - income[1].revenue) / Math.abs(income[1].revenue) * 100, 1)
        : null,
      earningsHistory: income.slice(0, 4)
        .map(q => ({ period: q.period ?? q.date?.slice(0, 7) ?? "", eps: q.eps ?? null, revenue: q.revenue ?? null }))
        .filter(q => q.eps != null && q.revenue != null),
    };
  } catch { return null; }
}

async function fetchOverview(symbol) {
  const key = globalThis.process?.env?.AV_KEY;
  if (!key) return null;
  const bare = symbol.replace(/\.(TO|V|L|AX|NS|DE)$/i, "");
  try {
    const r = await fetch(
      `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(bare)}&apikey=${key}`
    );
    if (!r.ok) return null;
    const d = await r.json();
    if (d.Note || d["Error Message"] || d.Information || !d.Symbol) return null;
    const n   = (v) => { const x = parseFloat(v); return isNaN(x) ? null : x; };
    const pct = (v) => { const x = n(v); return x != null ? +(x * 100).toFixed(1) : null; };
    return {
      sector:          d.Sector      || null,
      industry:        d.Industry    || null,
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
    };
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const symbol = (req.query.symbol ?? "").trim().toUpperCase();
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  const [fmp, overview] = await Promise.all([fetchFMP(symbol), fetchOverview(symbol)]);
  return res.json({ fmp, overview });
}
