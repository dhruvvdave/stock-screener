function resolveExchange(item) {
  if (item.displaySymbol.startsWith("TSXV:")) return "TSX-V";
  if (item.displaySymbol.startsWith("TSX:"))  return "TSX";
  const exch = (item.primaryExch ?? item.exchange ?? "").toUpperCase();
  if (exch.includes("TORONTO") || exch.includes("TSX")) return "TSX";
  if (exch.includes("NEW YORK") || exch === "NYSE")     return "NYSE";
  if (exch.includes("NASDAQ"))                          return "NASDAQ";
  return exch || "US";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = globalThis.process?.env?.FINNHUB_KEY;
  if (!key) return res.status(500).json({ error: "Missing FINNHUB_KEY" });

  const q = (req.query.q ?? "").trim();
  if (!q) return res.status(400).json({ error: "Missing query" });

  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${key}`
    );
    if (!r.ok) return res.status(502).json({ error: `Finnhub returned ${r.status}` });

    const d = await r.json();
    const results = (d.result ?? [])
      .filter(s => s.type === "Common Stock" || s.type === "EQS")
      .slice(0, 10)
      .map(s => ({
        // Strip exchange prefix (e.g. "TSX:SHOP" → "SHOP") for clean internal ticker
        symbol:   s.displaySymbol.includes(":") ? s.displaySymbol.split(":").pop() : s.displaySymbol,
        name:     s.description,
        exchange: resolveExchange(s),
      }));

    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
