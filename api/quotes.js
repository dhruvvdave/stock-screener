export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const symbols = (req.query.symbols ?? "").split(",").filter(Boolean);
  if (!symbols.length) return res.status(400).json({ error: "Missing symbols" });

  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(",")}&fields=regularMarketPrice,regularMarketChangePercent`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
        },
      }
    );

    if (!r.ok) return res.status(502).json({ error: `Yahoo Finance returned ${r.status}` });

    const d = await r.json();
    const quotes = d?.quoteResponse?.result ?? [];

    const data = {};
    quotes.forEach(q => {
      if (q.regularMarketPrice) {
        data[q.symbol] = {
          price:  q.regularMarketPrice,
          change: +(q.regularMarketChangePercent ?? 0).toFixed(2),
        };
      }
    });

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
