export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
        },
      }
    );
    if (!r.ok) return res.json({ prices: null });
    const d = await r.json();
    const closes = d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    if (!closes || closes.length < 2) return res.json({ prices: null });
    res.json({ prices: closes.filter(Boolean).slice(-30) });
  } catch (e) {
    res.status(500).json({ prices: null, error: e.message });
  }
}
