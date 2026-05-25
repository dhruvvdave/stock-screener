const FULL_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchYahooNews(symbol) {
  const r = await fetch(
    `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&newsCount=5&quotesCount=0&enableFuzzyQuery=false`,
    { headers: { "User-Agent": FULL_UA, "Accept": "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9" } }
  );
  if (!r.ok) return null;
  const d = await r.json();
  const items = d?.news ?? [];
  if (!items.length) return null;
  return items.slice(0, 5).map(item => ({
    title:       item.title ?? "",
    publisher:   item.publisher ?? "",
    link:        item.link ?? null,
    publishedAt: item.providerPublishTime ?? null,
  }));
}

async function fetchFinnhubNews(finnhubSymbol, key) {
  const to   = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const r = await fetch(
    `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(finnhubSymbol)}&from=${from}&to=${to}&token=${key}`
  );
  if (!r.ok) return null;
  const items = await r.json();
  if (!Array.isArray(items) || !items.length) return null;
  return items.slice(0, 5).map(item => ({
    title:       item.headline ?? "",
    publisher:   item.source   ?? "",
    link:        item.url      ?? null,
    publishedAt: item.datetime ?? null,
  }));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const symbol         = (req.query.symbol         ?? "").trim();
  const finnhubSymbol  = (req.query.finnhubSymbol  ?? "").trim().toUpperCase();
  if (!symbol && !finnhubSymbol) return res.status(400).json({ error: "Missing symbol" });

  try {
    // Yahoo Finance first (no key needed)
    if (symbol) {
      const news = await fetchYahooNews(symbol);
      if (news?.length) return res.json({ news });
    }

    // Finnhub company news as fallback
    const key = process.env.FINNHUB_KEY || process.env.FINNHUB_API_KEY;
    if (key && finnhubSymbol) {
      const news = await fetchFinnhubNews(finnhubSymbol, key);
      if (news?.length) return res.json({ news });
    }

    return res.json({ news: [] });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch news" });
  }
}
