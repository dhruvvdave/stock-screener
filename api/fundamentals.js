const FULL_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const symbol = (req.query.symbol ?? "").trim();
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=defaultKeyStatistics,financialData`;
    const r = await fetch(url, {
      headers: {
        "User-Agent": FULL_UA,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!r.ok) return res.status(502).json({ error: `Yahoo Finance returned ${r.status}` });

    const d = await r.json();
    const result = d?.quoteSummary?.result?.[0] ?? {};
    const ks = result.defaultKeyStatistics ?? {};
    const fd = result.financialData ?? {};

    return res.json({
      forwardPE:        ks.forwardPE?.raw        ?? null,
      pegRatio:         ks.pegRatio?.raw          ?? null,
      shortRatio:       ks.shortRatio?.raw        ?? null,
      shortPctFloat:    ks.shortPercentOfFloat?.raw ?? null,
      currentRatio:     fd.currentRatio?.raw      ?? null,
      debtToEquity:     fd.debtToEquity?.raw      ?? null,
      freeCashFlow:     fd.freeCashflow?.raw       ?? null,
      operatingMargins: fd.operatingMargins?.raw  ?? null,
      profitMargins:    fd.profitMargins?.raw      ?? null,
      returnOnEquity:   fd.returnOnEquity?.raw     ?? null,
      returnOnAssets:   fd.returnOnAssets?.raw     ?? null,
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch fundamentals" });
  }
}
