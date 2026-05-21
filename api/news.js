const FULL_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const symbol = (req.query.symbol ?? "").trim();
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&newsCount=5&quotesCount=0&enableFuzzyQuery=false`;
    const r = await fetch(url, {
      headers: {
        "User-Agent": FULL_UA,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!r.ok) return res.status(502).json({ error: `Yahoo Finance returned ${r.status}` });

    const d = await r.json();
    const news = (d?.news ?? []).slice(0, 5).map(item => ({
      title:       item.title ?? "",
      publisher:   item.publisher ?? "",
      link:        item.link ?? null,
      publishedAt: item.providerPublishTime ?? null,
    }));

    return res.json({ news });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch news" });
  }
}
