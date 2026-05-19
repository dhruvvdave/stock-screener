// Finnhub symbol map — Canadian stocks use .TO suffix on Finnhub
export const FINNHUB_SYMBOLS = {
  SHOP:    "SHOP.TO", CNQ:  "CNQ.TO",  RY:   "RY.TO",  TD:  "TD.TO",
  ATD:     "ATD.TO",  SU:   "SU.TO",   BCE:  "BCE.TO",  ENB: "ENB.TO",
  NTR:     "NTR.TO",  ABX:  "ABX.TO",  CP:   "CP.TO",
  "GSI.V": "GSI.V",
  JPM:  "JPM",  XOM:  "XOM", LLY: "LLY", JNJ: "JNJ",
  CAT:  "CAT",  WMT:  "WMT", UEC: "UEC",
  AAPL: "AAPL", NVDA: "NVDA", MSFT: "MSFT",
  META: "META", AMZN: "AMZN", GOOG: "GOOG",
};

// ── Exchange rate (no API key needed) ──────────────────────────────────────

export async function fetchExchangeRate() {
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=CAD");
    const d = await r.json();
    return typeof d.rates?.CAD === "number" ? d.rates.CAD : 1.36;
  } catch {
    return 1.36;
  }
}

// ── Finnhub quotes via /api/quotes proxy ───────────────────────────────────

export async function fetchAllQuotes(tickers) {
  const symbols = tickers.map(t => FINNHUB_SYMBOLS[t] ?? t);
  try {
    const r = await fetch(`/api/quotes?symbols=${symbols.join(",")}`);
    if (!r.ok) return new Map();
    const data = await r.json();
    const result = new Map();
    tickers.forEach(t => {
      const sym = FINNHUB_SYMBOLS[t] ?? t;
      if (data[sym]) result.set(t, data[sym]);
    });
    return result;
  } catch {
    return new Map();
  }
}

// ── Candle / historical data via /api/candle proxy ────────────────────────

export async function fetchCandleData(ticker) {
  const symbol = FINNHUB_SYMBOLS[ticker] ?? ticker;
  try {
    const r = await fetch(`/api/candle?symbol=${encodeURIComponent(symbol)}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d.prices ?? null;
  } catch {
    return null;
  }
}

// ── Analyst data via /api/analyst proxy ───────────────────────────────────

export async function fetchAnalystData(ticker) {
  const symbol = FINNHUB_SYMBOLS[ticker] ?? ticker;
  try {
    const r = await fetch(`/api/analyst?symbol=${encodeURIComponent(symbol)}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ── News sentiment via /api/sentiment proxy ───────────────────────────────

export async function fetchNewsSentiment(ticker) {
  const symbol = FINNHUB_SYMBOLS[ticker] ?? ticker;
  try {
    const r = await fetch(`/api/sentiment?symbol=${encodeURIComponent(symbol)}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ── Currency conversion ────────────────────────────────────────────────────

export function isCADExchange(exchange) {
  return exchange === "TSX" || exchange === "TSX-V";
}

export function convertPrice(price, exchange, displayCurrency, usdToCad) {
  const cad = isCADExchange(exchange);
  if (displayCurrency === "CAD" && !cad) return { price: price * usdToCad,  converted: true };
  if (displayCurrency === "USD" &&  cad) return { price: price / usdToCad,  converted: true };
  return { price, converted: false };
}

export function filterBoundToNative(bound, exchange, displayCurrency, usdToCad) {
  if (!bound) return null;
  const cad = isCADExchange(exchange);
  const n   = +bound;
  if (displayCurrency === "CAD" && !cad) return n / usdToCad;
  if (displayCurrency === "USD" &&  cad) return n * usdToCad;
  return n;
}

// ── AI analysis via /api/analyze proxy ────────────────────────────────────

export async function generateAIAnalysis(stock, analystData, sentiment) {
  const a    = analystData ?? {};
  const sent = sentiment ?? {};

  const consensus = !a.total ? "unavailable"
    : a.buy  > a.hold && a.buy  > a.sell ? "Buy"
    : a.sell > a.buy  && a.sell > a.hold ? "Sell"
    : "Hold";

  const upside = a.meanTarget && stock.price
    ? ((a.meanTarget - stock.price) / stock.price * 100).toFixed(1)
    : null;

  const prompt = `You are a concise stock analyst. Analyze ${stock.ticker} (${stock.name}) and reply with ONLY a valid JSON object — no markdown, no text outside the JSON.

Data:
Exchange: ${stock.exchange} | Sector: ${stock.sector}
Price: $${stock.price} | Change: ${stock.change >= 0 ? "+" : ""}${stock.change}%
P/E: ${stock.pe ?? "N/A"} | P/B: ${stock.pb} | Beta: ${stock.beta}
EPS Growth: ${stock.epsGrowth ?? "N/A"}% | Rev Growth: ${stock.revGrowth}%
Market Cap: $${stock.mktCap}B

Analysts: ${consensus}${a.total ? ` (${a.buy} buy / ${a.hold} hold / ${a.sell} sell, ${a.total} total)` : ""}
${a.meanTarget ? `Price target: $${a.meanTarget.toFixed(2)}${upside !== null ? ` (${upside > 0 ? "+" : ""}${upside}% upside)` : ""}, range $${a.lowTarget?.toFixed(2) ?? "?"} – $${a.highTarget?.toFixed(2) ?? "?"}` : "Price target: unavailable"}
${sent.bullish != null ? `News: ${(sent.bullish * 100).toFixed(0)}% bullish, ${sent.articles} articles/week` : "News sentiment: unavailable"}

Reply with this exact JSON:
{
  "summary": "2-3 sentences on current situation and near-term outlook",
  "bulls": ["concise bull point 1", "concise bull point 2"],
  "bears": ["concise bear point 1", "concise bear point 2"],
  "forecast30d": { "low": <number>, "mid": <number>, "high": <number> },
  "sentiment": "bullish" or "neutral" or "bearish",
  "signal": "buy" or "hold" or "sell" or "watch"
}

forecast30d should be realistic price levels in the stock's native currency based on analyst targets and momentum.`;

  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  const d = await res.json();
  if (d.error) throw new Error(d.error);

  const text = d.text ?? "";
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Could not parse AI response — try again");
  }
}
