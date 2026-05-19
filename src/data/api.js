const FINNHUB_BASE = "https://finnhub.io/api/v1";

// Finnhub symbol map — Canadian stocks use .TO suffix on Finnhub
export const FINNHUB_SYMBOLS = {
  SHOP:    "SHOP.TO", CNQ:  "CNQ.TO",  RY:   "RY.TO",  TD:  "TD.TO",
  ATD:     "ATD.TO",  SU:   "SU.TO",   BCE:  "BCE.TO",  ENB: "ENB.TO",
  NTR:     "NTR.TO",  ABX:  "ABX.TO",  CP:   "CP.TO",
  "GSI.V": "GSI.V",  // TSX-V — may not be in Finnhub free tier
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

// ── Finnhub quotes ─────────────────────────────────────────────────────────

async function fetchOneQuote(finnhubSymbol, key) {
  const r = await fetch(`${FINNHUB_BASE}/quote?symbol=${finnhubSymbol}&token=${key}`);
  const d = await r.json();
  if (d.error || !d.c || d.c === 0) return null;
  return { price: d.c, change: +(d.dp ?? 0).toFixed(2) };
}

// Fetches all quotes in chunks of 10 with ~1.1s gap to stay under 60 req/min
export async function fetchAllQuotes(tickers, key) {
  const results = new Map();
  const CHUNK = 10;
  for (let i = 0; i < tickers.length; i += CHUNK) {
    const chunk = tickers.slice(i, i + CHUNK);
    const settled = await Promise.allSettled(
      chunk.map(t => fetchOneQuote(FINNHUB_SYMBOLS[t] ?? t, key))
    );
    settled.forEach((r, idx) => {
      if (r.status === "fulfilled" && r.value !== null) results.set(chunk[idx], r.value);
    });
    if (i + CHUNK < tickers.length) await new Promise(r => setTimeout(r, 1100));
  }
  return results;
}

// ── Candle / historical data ───────────────────────────────────────────────

// Returns array of closing prices (most recent 30 trading days) or null
export async function fetchCandleData(ticker, key) {
  const symbol = FINNHUB_SYMBOLS[ticker] ?? ticker;
  const to   = Math.floor(Date.now() / 1000);
  const from = to - 42 * 24 * 60 * 60; // 42 calendar days ≈ 30 trading days
  try {
    const r = await fetch(
      `${FINNHUB_BASE}/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${key}`
    );
    const d = await r.json();
    if (d.s !== "ok" || !Array.isArray(d.c) || d.c.length < 2) return null;
    return d.c.slice(-30); // keep last 30 points
  } catch {
    return null;
  }
}

// ── Analyst data ───────────────────────────────────────────────────────────

export async function fetchAnalystData(ticker, key) {
  const symbol = FINNHUB_SYMBOLS[ticker] ?? ticker;
  try {
    const [recRes, tgtRes] = await Promise.all([
      fetch(`${FINNHUB_BASE}/stock/recommendation?symbol=${symbol}&token=${key}`),
      fetch(`${FINNHUB_BASE}/stock/price-target?symbol=${symbol}&token=${key}`),
    ]);
    const [rec, tgt] = await Promise.all([recRes.json(), tgtRes.json()]);
    const latest = Array.isArray(rec) && rec.length > 0
      ? [...rec].sort((a, b) => b.period.localeCompare(a.period))[0]
      : null;
    return {
      buy:        (latest?.buy ?? 0) + (latest?.strongBuy ?? 0),
      hold:       latest?.hold ?? 0,
      sell:       (latest?.sell ?? 0) + (latest?.strongSell ?? 0),
      total:      (latest?.buy ?? 0) + (latest?.strongBuy ?? 0) + (latest?.hold ?? 0)
                + (latest?.sell ?? 0) + (latest?.strongSell ?? 0),
      meanTarget: tgt?.targetMean ?? null,
      highTarget: tgt?.targetHigh ?? null,
      lowTarget:  tgt?.targetLow ?? null,
    };
  } catch {
    return null;
  }
}

// ── News sentiment ─────────────────────────────────────────────────────────

export async function fetchNewsSentiment(ticker, key) {
  const symbol = FINNHUB_SYMBOLS[ticker] ?? ticker;
  try {
    const r = await fetch(`${FINNHUB_BASE}/news-sentiment?symbol=${symbol}&token=${key}`);
    const d = await r.json();
    return {
      bullish:  d.sentiment?.bullishPercent ?? null,
      bearish:  d.sentiment?.bearishPercent ?? null,
      articles: d.buzz?.articlesInLastWeek ?? 0,
    };
  } catch {
    return null;
  }
}

// ── Currency conversion ────────────────────────────────────────────────────

export function isCADExchange(exchange) {
  return exchange === "TSX" || exchange === "TSX-V";
}

// Returns the display price and whether it was converted from another currency
export function convertPrice(price, exchange, displayCurrency, usdToCad) {
  const cad = isCADExchange(exchange);
  if (displayCurrency === "CAD" && !cad) return { price: price * usdToCad,  converted: true };
  if (displayCurrency === "USD" &&  cad) return { price: price / usdToCad,  converted: true };
  return { price, converted: false };
}

// Convert a filter price bound from display currency to the stock's native currency
export function filterBoundToNative(bound, exchange, displayCurrency, usdToCad) {
  if (!bound) return null;
  const cad = isCADExchange(exchange);
  const n   = +bound;
  if (displayCurrency === "CAD" && !cad) return n / usdToCad;
  if (displayCurrency === "USD" &&  cad) return n * usdToCad;
  return n;
}

// ── AI analysis via Claude API ─────────────────────────────────────────────

export async function generateAIAnalysis(stock, analystData, sentiment, claudeKey) {
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

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":                    claudeKey,
      "anthropic-version":            "2023-06-01",
      "content-type":                 "application/json",
      "anthropic-dangerous-allow-browser": "true",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages:   [{ role: "user", content: prompt }],
    }),
  });

  const d = await res.json();
  if (d.error) throw new Error(d.error.message ?? "Anthropic API error");

  const text = d.content?.[0]?.text ?? "";
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Could not parse AI response — try again");
  }
}
