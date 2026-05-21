const FULL_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FIELDS = [
  "regularMarketPrice",
  "regularMarketChangePercent",
  "regularMarketVolume",
  "averageDailyVolume10Day",
  "marketCap",
  "trailingPE",
  "priceToBook",
  "beta",
  "fiftyTwoWeekHigh",
  "fiftyTwoWeekLow",
  "trailingAnnualDividendYield",
  "earningsTimestampStart",
  "earningsTimestamp",
  "earningsGrowth",
  "revenueGrowth",
  "forwardPE",
].join(",");

function parseQuotes(d) {
  const quotes = d?.quoteResponse?.result ?? [];
  const data = {};
  for (const q of quotes) {
    if (!q.regularMarketPrice) continue;
    data[q.symbol] = {
      price:  q.regularMarketPrice,
      change: +(q.regularMarketChangePercent ?? 0).toFixed(2),
      ...(q.regularMarketVolume      != null && { vol:    +(q.regularMarketVolume / 1e6).toFixed(2) }),
      ...(q.averageDailyVolume10Day  != null && { avgVol: +(q.averageDailyVolume10Day / 1e6).toFixed(2) }),
      ...(q.marketCap                != null && { mktCap: +(q.marketCap / 1e9).toFixed(1) }),
      ...(q.trailingPE != null && q.trailingPE > 0 && { pe: +q.trailingPE.toFixed(1) }),
      ...(q.forwardPE  != null && q.forwardPE  > 0 && { forwardPE: +q.forwardPE.toFixed(1) }),
      ...(q.priceToBook    != null && { pb:     +q.priceToBook.toFixed(2) }),
      ...(q.beta           != null && { beta:   +q.beta.toFixed(2) }),
      ...(q.fiftyTwoWeekHigh != null && { high52w: +q.fiftyTwoWeekHigh.toFixed(2) }),
      ...(q.fiftyTwoWeekLow  != null && { low52w:  +q.fiftyTwoWeekLow.toFixed(2) }),
      ...(q.trailingAnnualDividendYield != null && q.trailingAnnualDividendYield > 0 && {
        dividendYield: +(q.trailingAnnualDividendYield * 100).toFixed(2),
      }),
      ...((q.earningsTimestampStart ?? q.earningsTimestamp) != null && {
        earningsDate: q.earningsTimestampStart ?? q.earningsTimestamp,
      }),
      ...(q.earningsGrowth != null && { epsGrowth: +(q.earningsGrowth * 100).toFixed(1) }),
      ...(q.revenueGrowth  != null && { revGrowth: +(q.revenueGrowth  * 100).toFixed(1) }),
    };
  }
  return data;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const symbols = (req.query.symbols ?? "").split(",").filter(Boolean);
  if (!symbols.length) return res.status(400).json({ error: "Missing symbols" });

  const url = (host) =>
    `https://${host}.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(",")}&fields=${FIELDS}`;
  const headers = {
    "User-Agent": FULL_UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
  };

  // Try query1 first, fall back to query2
  for (const host of ["query1", "query2"]) {
    try {
      const r = await fetch(url(host), { headers });
      if (!r.ok) continue;
      const d = await r.json();
      const data = parseQuotes(d);
      if (Object.keys(data).length > 0) return res.json(data);
    } catch { /* try next host */ }
  }

  // Both Yahoo hosts failed — return empty so callers fall back to Finnhub metrics
  res.json({});
}
