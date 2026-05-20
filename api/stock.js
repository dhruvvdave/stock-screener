const FINNHUB_SYMBOLS = {
  SHOP: "TSX:SHOP", CNQ: "TSX:CNQ", RY: "TSX:RY", TD: "TSX:TD",
  ATD: "TSX:ATD", SU: "TSX:SU", BCE: "TSX:BCE", ENB: "TSX:ENB",
  NTR: "TSX:NTR", ABX: "TSX:ABX", CP: "TSX:CP", "GSI.V": "TSXV:GSI",
};

function toFinnhubSymbol(symbol) {
  return FINNHUB_SYMBOLS[symbol] ?? symbol;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = globalThis.process?.env?.FINNHUB_KEY;
  if (!key) return res.status(500).json({ error: "Missing FINNHUB_KEY" });

  const rawSymbol = (req.query.symbol ?? "").trim().toUpperCase();
  if (!rawSymbol) return res.status(400).json({ error: "Missing symbol" });

  const symbol = toFinnhubSymbol(rawSymbol);

  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`
    );

    if (!r.ok) {
      return res.status(502).json({ error: `Finnhub returned ${r.status}` });
    }

    const d = await r.json();
    if (typeof d?.c !== "number") {
      return res.status(502).json({ error: "Invalid Finnhub quote response" });
    }

    return res.status(200).json({
      price: d.c,
      change: typeof d.dp === "number" ? +d.dp.toFixed(2) : null,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
