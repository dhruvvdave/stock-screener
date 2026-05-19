export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = process.env.FINNHUB_KEY || process.env.FINNHUB_API_KEY;
  if (!key) return res.status(503).json({ error: "Service not configured — set FINNHUB_KEY in Vercel environment variables" });

  const symbols = (req.query.symbols ?? "").split(",").filter(Boolean);
  if (!symbols.length) return res.status(400).json({ error: "Missing symbols" });

  const results = await Promise.allSettled(
    symbols.map(sym =>
      fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${key}`)
        .then(r => r.json())
    )
  );

  const data = {};
  results.forEach((r, idx) => {
    if (r.status === "fulfilled" && r.value?.c && r.value.c !== 0) {
      data[symbols[idx]] = { price: r.value.c, change: +(r.value.dp ?? 0).toFixed(2) };
    }
  });

  res.json(data);
}
