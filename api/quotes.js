export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = process.env.FINNHUB_KEY;
  if (!key) return res.status(503).json({ error: "Service not configured" });

  const symbols = (req.query.symbols ?? "").split(",").filter(Boolean);
  if (!symbols.length) return res.status(400).json({ error: "Missing symbols" });

  const CHUNK = 10;
  const data = {};

  for (let i = 0; i < symbols.length; i += CHUNK) {
    const chunk = symbols.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      chunk.map(sym =>
        fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${key}`)
          .then(r => r.json())
      )
    );
    results.forEach((r, idx) => {
      if (r.status === "fulfilled" && r.value?.c && r.value.c !== 0) {
        data[chunk[idx]] = { price: r.value.c, change: +(r.value.dp ?? 0).toFixed(2) };
      }
    });
    if (i + CHUNK < symbols.length) await new Promise(r => setTimeout(r, 1100));
  }

  res.json(data);
}
