export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const symbol = (req.query.symbol ?? "").trim();
  const finnhubSymbol = (req.query.finnhubSymbol ?? "").trim();
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  const key = globalThis.process?.env?.FINNHUB_KEY || globalThis.process?.env?.FINNHUB_API_KEY;

  try {
    const yahooProfileUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile`;
    const yahooQuoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    const finnhubProfileUrl = key && finnhubSymbol
      ? `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(finnhubSymbol)}&token=${key}`
      : null;

    const requests = [
      fetch(yahooProfileUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
        },
      }),
      fetch(yahooQuoteUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
        },
      }),
    ];

    if (finnhubProfileUrl) requests.push(fetch(finnhubProfileUrl));

    const [yahooProfileRes, yahooQuoteRes, finnhubRes] = await Promise.all(requests);
    const yahooProfileData = yahooProfileRes.ok ? await yahooProfileRes.json() : {};
    const yahooQuoteData = yahooQuoteRes.ok ? await yahooQuoteRes.json() : {};
    const finnhubData = finnhubRes?.ok ? await finnhubRes.json() : {};

    const assetProfile = yahooProfileData?.quoteSummary?.result?.[0]?.assetProfile ?? {};
    const yahooQuote = yahooQuoteData?.quoteResponse?.result?.[0] ?? {};

    return res.json({
      companyName: finnhubData?.name ?? yahooQuote?.longName ?? yahooQuote?.shortName ?? symbol,
      sector: assetProfile?.sector ?? finnhubData?.finnhubIndustry ?? null,
      description: assetProfile?.longBusinessSummary ?? null,
      logo: finnhubData?.logo ?? null,
      website: finnhubData?.weburl ?? assetProfile?.website ?? null,
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch profile" });
  }
}
