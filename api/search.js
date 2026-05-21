function resolveExchange(item) {
  const ds = item.displaySymbol ?? "";
  if (ds.startsWith("TSXV:"))   return "TSX-V";
  if (ds.startsWith("TSX:"))    return "TSX";
  if (ds.startsWith("LSE:"))    return "LSE";
  if (ds.startsWith("ASX:"))    return "ASX";
  if (ds.startsWith("XETRA:"))  return "XETRA";
  if (ds.startsWith("NSE:"))    return "NSE";

  const exch = (item.primaryExch ?? item.exchange ?? "").toUpperCase();
  if (exch.includes("TORONTO") || exch === "TSX")    return "TSX";
  if (exch.includes("VENTURE") || exch === "TSXV")   return "TSX-V";
  if (exch.includes("NEW YORK") || exch === "NYSE")  return "NYSE";
  if (exch.includes("NASDAQ"))                       return "NASDAQ";
  if (exch.includes("AMEX") || exch === "AMEX")      return "AMEX";
  if (exch.includes("OTC") || exch === "PINK")       return "OTC";
  if (exch.includes("LONDON") || exch === "LSE")     return "LSE";
  return exch || "US";
}

// Strip exchange prefix from displaySymbol; keep the raw symbol for non-prefixed forms
function extractSymbol(item) {
  const ds = item.displaySymbol ?? "";
  return ds.includes(":") ? ds.split(":").pop() : ds;
}

const ALLOWED_TYPES = new Set([
  "Common Stock", "EQS",
  "ADR",          // American Depositary Receipt
  "ETF",
]);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = globalThis.process?.env?.FINNHUB_KEY;
  if (!key) return res.status(500).json({ error: "Missing FINNHUB_KEY" });

  const raw = (req.query.q ?? "").trim();
  if (!raw) return res.status(400).json({ error: "Missing query" });

  // Strip common suffixes users might type (.V, .TO, .L) before sending to Finnhub
  const q = raw.replace(/\.(V|TO|L|AX)$/i, "");

  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${key}`
    );
    if (!r.ok) return res.status(502).json({ error: `Finnhub returned ${r.status}` });

    const d = await r.json();
    const results = (d.result ?? [])
      .filter(s => ALLOWED_TYPES.has(s.type))
      .slice(0, 12)
      .map(s => ({
        symbol:   extractSymbol(s),
        name:     s.description,
        exchange: resolveExchange(s),
      }));

    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
