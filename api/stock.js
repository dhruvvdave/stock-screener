const FULL_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function isInvalidQuote(data) {
  if (!data || typeof data !== "object") return true;
  return typeof data.c !== "number" || data.c <= 0;
}

// Convert Finnhub-format symbol to Yahoo Finance symbol for fallback
function finnhubToYahoo(symbol) {
  if (symbol.startsWith("TSXV:")) return symbol.slice(5) + ".V";
  if (symbol.startsWith("TSX:"))  return symbol.slice(4) + ".TO";
  if (symbol.startsWith("LSE:"))  return symbol.slice(4) + ".L";
  if (symbol.startsWith("ASX:"))  return symbol.slice(4) + ".AX";
  if (symbol.startsWith("NSE:"))  return symbol.slice(4) + ".NS";
  return symbol;
}

async function fetchYahooFallback(yahooSymbol) {
  const headers = {
    "User-Agent": FULL_UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
  };
  for (const host of ["query1", "query2"]) {
    try {
      const r = await fetch(
        `https://${host}.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSymbol)}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketVolume`,
        { headers }
      );
      if (!r.ok) continue;
      const d = await r.json();
      const q = d?.quoteResponse?.result?.[0];
      if (q?.regularMarketPrice) return q;
    } catch { /* try next host */ }
  }
  return null;
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

    if (response.ok) {
      const quote = await response.json();
      if (!isInvalidQuote(quote)) {
        return res.status(200).json({
          symbol,
          price: quote.c,
          change: quote.d ?? null,
          changePercent: quote.dp ?? null,
          high: quote.h ?? null,
          low: quote.l ?? null,
          open: quote.o ?? null,
          previousClose: quote.pc ?? null,
          timestamp: quote.t ?? null,
          volume: quote.v ?? null,
        });
      }
    }

    // Finnhub has no data — try Yahoo Finance
    const yahooSymbol = finnhubToYahoo(symbol);
    const yq = await fetchYahooFallback(yahooSymbol);
    if (yq) {
      return res.status(200).json({
        symbol,
        price: yq.regularMarketPrice,
        changePercent: yq.regularMarketChangePercent ?? null,
        change: null,
        volume: yq.regularMarketVolume ?? null,
      });
    }

    return res.status(404).json({ error: `No quote found for symbol ${symbol}` });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
}
