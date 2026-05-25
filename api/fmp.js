export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = globalThis.process?.env?.FMP_KEY;
  if (!key) return res.json(null);

  // FMP uses bare ticker (no exchange prefix); strip any suffix like .TO, .V, .L
  const raw = (req.query.symbol ?? "").trim().toUpperCase();
  const symbol = raw.replace(/\.(TO|V|L|AX|NS|DE)$/i, "");
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  try {
    const [metricsRes, incomeRes] = await Promise.all([
      fetch(`https://financialmodelingprep.com/api/v3/key-metrics/${encodeURIComponent(symbol)}?limit=1&apikey=${key}`),
      fetch(`https://financialmodelingprep.com/api/v3/income-statement/${encodeURIComponent(symbol)}?limit=4&apikey=${key}`),
    ]);

    const metrics = metricsRes.ok ? ((await metricsRes.json())?.[0] ?? null) : null;
    const income  = incomeRes.ok  ? ((await incomeRes.json())  ?? [])         : [];
    const latest  = income[0] ?? null;

    if (!metrics && !latest) return res.json(null);

    const n = (v, d = 2) => v != null && isFinite(v) ? +Number(v).toFixed(d) : null;

    return res.json({
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
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "FMP error" });
  }
}
