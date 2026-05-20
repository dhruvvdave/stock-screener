function isInvalidQuote(data) {
  if (!data || typeof data !== "object") return true;

  const numericFields = ["c", "d", "dp", "h", "l", "o", "pc", "t"];
  if (numericFields.some((field) => typeof data[field] !== "number")) return true;

  return data.t === 0 || (data.c === 0 && data.pc === 0 && data.h === 0 && data.l === 0 && data.o === 0);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = globalThis.process?.env?.FINNHUB_KEY;
  if (!key) return res.status(500).json({ error: "Missing FINNHUB_KEY" });

  const symbol = (req.query.symbol ?? "").trim().toUpperCase();
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`
    );

    if (!response.ok) {
      return res.status(502).json({ error: `Finnhub returned ${response.status}` });
    }

    const quote = await response.json();
    if (isInvalidQuote(quote)) {
      return res.status(404).json({ error: `No quote found for symbol ${symbol}` });
    }

    return res.status(200).json({
      symbol,
      price: quote.c,
      change: quote.d,
      changePercent: quote.dp,
      high: quote.h,
      low: quote.l,
      open: quote.o,
      previousClose: quote.pc,
      timestamp: quote.t,
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
}
