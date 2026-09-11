// ── Symbol resolution ──────────────────────────────────────────────────────
//
// A ticker on its own is not an identifier: SHOP is Shopify on both the TSX and
// the NYSE, and GSI is a TSX Venture miner as well as a US-listed company. This
// file used to answer that question with two hardcoded per-ticker maps, which
// is why a NYSE result for SHOP still fetched Canadian prices and why anything
// typed by hand resolved to a bare ticker.
//
// Resolution now belongs to the backend, which caches it in Redis and can ask
// Finnhub which listings actually exist. There is deliberately no exchange
// table in this file: one source of truth, not two that drift.

const RESOLUTION_CACHE = new Map();

const resolutionKey = (ticker, exchange) => `${String(ticker).toUpperCase()}@${exchange || ""}`;

/** Drop memoised resolutions. Used by tests and when a watchlist is cleared. */
export function clearResolutionCache() {
  RESOLUTION_CACHE.clear();
}

async function requestResolution(ticker, exchange) {
  const params = new URLSearchParams({ symbol: ticker });
  if (exchange) params.set("exchange", exchange);

  const r = await fetch(`/api/resolve?${params.toString()}`);
  // 200, 409 (ambiguous) and 404 (unknown) all carry a body describing the
  // outcome, so only a transport failure is exceptional here.
  const body = await r.json();
  if (body && body.status) return body;
  throw new Error("Malformed resolution response");
}

/**
 * Resolve a ticker to its listing and every provider's spelling of it.
 *
 * Returns { status, exchange, symbols, candidates, message }, where status is
 * "resolved", "ambiguous", "not_found" or "unavailable". Never throws: the
 * caller gets a status it can render.
 */
export async function resolveSymbol(ticker, exchange = "") {
  const symbol = String(ticker || "").trim().toUpperCase();
  if (!symbol) {
    return { status: "not_found", message: "No ticker given.", symbols: {}, candidates: [] };
  }

  const key = resolutionKey(symbol, exchange);
  if (!RESOLUTION_CACHE.has(key)) {
    RESOLUTION_CACHE.set(key, requestResolution(symbol, exchange));
  }

  try {
    return await RESOLUTION_CACHE.get(key);
  } catch {
    // A failed lookup must not be remembered as an answer.
    RESOLUTION_CACHE.delete(key);
    return {
      status: "unavailable",
      message: `Could not reach symbol resolution for ${symbol}.`,
      symbols: {},
      candidates: [],
    };
  }
}

/**
 * Provider spellings for a listing, or null when it could not be resolved.
 *
 * Every fetch wrapper below starts here, so an unresolvable ticker stops before
 * it can be sent to a provider as a bare string — which is how the old code
 * ended up charting a different company.
 */
async function symbolsFor(ticker, exchange, known) {
  if (known && known.finnhub) return known;
  const resolution = await resolveSymbol(ticker, exchange);
  return resolution.status === "resolved" ? resolution.symbols : null;
}

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

// ── Finnhub quotes via /api/stock proxy (FINNHUB_KEY) ─────────────────────
// Accepts array of tickers (strings) or stock objects { ticker, exchange }

export async function fetchAllQuotes(stocksOrTickers) {
  const result = new Map();

  await Promise.all(stocksOrTickers.map(async (item) => {
    const ticker   = typeof item === "string" ? item : item.ticker;
    const exchange = typeof item === "string" ? ""   : (item.exchange ?? "");
    const symbols  = await symbolsFor(ticker, exchange, typeof item === "string" ? null : item.symbols);
    if (!symbols) return;
    const symbol   = symbols.finnhub;
    try {
      const r = await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`);
      if (!r.ok) return;
      const data = await r.json();
      if (typeof data?.price === "number") {
        result.set(ticker, {
          price:  data.price,
          change: typeof data.changePercent === "number"
            ? data.changePercent
            : typeof data.change === "number"
              ? data.change
              : null,
        });
      }
    } catch {
      // skip and continue
    }
  }));

  return result;
}

// ── Yahoo Finance batch supplementary data via /api/quotes proxy ──────────
// Accepts array of stock objects { ticker, exchange } to map to Yahoo symbols

export async function fetchSupplementaryQuotes(stocks) {
  if (!stocks?.length) return {};

  const symbolToTicker = {};
  const resolved = await Promise.all(
    stocks.map(s => symbolsFor(s.ticker, s.exchange, s.symbols))
  );
  const symbols = [];
  stocks.forEach((s, i) => {
    const ys = resolved[i]?.yahoo;
    if (!ys) return;   // unresolvable: ask for nothing rather than a bare guess
    symbolToTicker[ys] = s.ticker;
    symbols.push(ys);
  });
  if (!symbols.length) return {};

  try {
    const r = await fetch(`/api/quotes?symbols=${symbols.join(",")}`);
    if (!r.ok) return {};
    const raw = await r.json();
    const result = {};
    for (const [sym, data] of Object.entries(raw)) {
      const ticker = symbolToTicker[sym] ?? sym;
      result[ticker] = data;
    }
    return result;
  } catch {
    return {};
  }
}

// ── Candle/chart data via /api/candle proxy (Finnhub primary, Yahoo fallback)
// Returns the full payload ({ prices, lastClose, source, ... }) — the prices
// array feeds calculateTechnicals, lastClose backfills missing quotes, and
// source is surfaced in the UI when a fallback provider served the data.

export async function fetchCandleData(ticker, exchange = "", range = "1y", known = null) {
  const symbols = await symbolsFor(ticker, exchange, known);
  if (!symbols) return null;
  const yahooSymbol   = symbols.yahoo ?? "";
  const finnhubSymbol = symbols.finnhub ?? "";
  try {
    const r = await fetch(
      `/api/candle?symbol=${encodeURIComponent(yahooSymbol)}&finnhubSymbol=${encodeURIComponent(finnhubSymbol)}&range=${range}`
    );
    if (!r.ok) return null;
    const d = await r.json();
    return Array.isArray(d.prices) && d.prices.length ? d : null;
  } catch {
    return null;
  }
}

// ── Finnhub search via /api/search proxy ──────────────────────────────────

export async function fetchSearchResults(query) {
  if (!query || query.length < 2) return [];
  try {
    const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!r.ok) return [];
    const d = await r.json();
    return d.results ?? [];
  } catch {
    return [];
  }
}

// ── Company profile via /api/profile proxy ──────────────────────────────────

export async function fetchCompanyProfile(ticker, exchange = "", known = null) {
  if (!ticker) return null;
  const symbols = await symbolsFor(ticker, exchange, known);
  if (!symbols) return null;
  const yahooSymbol = symbols.yahoo ?? "";
  const finnhubSymbol = symbols.finnhub ?? "";
  try {
    const r = await fetch(
      `/api/profile?symbol=${encodeURIComponent(yahooSymbol)}&finnhubSymbol=${encodeURIComponent(finnhubSymbol)}`
    );
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ── Technical indicators computed from price history ─────────────────────

function computeEMA(prices, period) {
  if (prices.length < period) return [];
  const k = 2 / (period + 1);
  const ema = [prices.slice(0, period).reduce((a, b) => a + b, 0) / period];
  for (let i = period; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[ema.length - 1] * (1 - k));
  }
  return ema;
}

export function calculateTechnicals(prices) {
  const empty = { rsi: null, ma50: null, ma200: null, macd: null, macdSignal: null, bbUpper: null, bbLower: null, bbMid: null };
  if (!Array.isArray(prices) || prices.length < 15) return empty;
  const n = prices.length;

  // Simple moving averages
  const ma50  = n >= 50  ? +(prices.slice(-50).reduce((a, b)  => a + b, 0) / 50).toFixed(2)  : null;
  const ma200 = n >= 200 ? +(prices.slice(-200).reduce((a, b) => a + b, 0) / 200).toFixed(2) : null;

  // RSI(14) — Wilder's smoothing method
  const changes = [];
  for (let i = 1; i < n; i++) changes.push(prices[i] - prices[i - 1]);

  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < 14; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= 14;
  avgLoss /= 14;

  for (let i = 14; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * 13 + gain) / 14;
    avgLoss = (avgLoss * 13 + loss) / 14;
  }

  const rsi = avgLoss === 0 ? 100 : +(100 - 100 / (1 + avgGain / avgLoss)).toFixed(1);

  // MACD (12/26 EMA, 9-period signal line)
  let macd = null, macdSignal = null;
  if (n >= 26) {
    const ema12 = computeEMA(prices, 12);
    const ema26 = computeEMA(prices, 26);
    // ema26[i] and ema12[i+14] both correspond to prices ending at index (25+i)
    const macdLine = ema26.map((v, i) => ema12[i + 14] - v);
    if (macdLine.length >= 9) {
      const signalLine = computeEMA(macdLine, 9);
      macd = +macdLine[macdLine.length - 1].toFixed(4);
      macdSignal = +signalLine[signalLine.length - 1].toFixed(4);
    }
  }

  // Bollinger Bands (20-day SMA ± 2 standard deviations)
  let bbUpper = null, bbLower = null, bbMid = null;
  if (n >= 20) {
    const slice = prices.slice(-20);
    const mean = slice.reduce((a, b) => a + b, 0) / 20;
    const variance = slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / 20;
    const sd = Math.sqrt(variance);
    bbMid   = +mean.toFixed(2);
    bbUpper = +(mean + 2 * sd).toFixed(2);
    bbLower = +(mean - 2 * sd).toFixed(2);
  }

  return { rsi, ma50, ma200, macd, macdSignal, bbUpper, bbLower, bbMid };
}

// ── Analyst data via /api/analyst proxy (Finnhub, optional) ───────────────

export async function fetchAnalystData(ticker, exchange = "", known = null) {
  const symbols = await symbolsFor(ticker, exchange, known);
  if (!symbols?.finnhub) return null;
  const symbol = symbols.finnhub;
  try {
    const r = await fetch(`/api/analyst?symbol=${encodeURIComponent(symbol)}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}


// ── Finnhub stock metrics (fundamentals fallback, no Yahoo needed) ─────────

export async function fetchMetrics(ticker, exchange = "", known = null) {
  const symbols = await symbolsFor(ticker, exchange, known);
  if (!symbols?.finnhub) return null;
  const symbol = symbols.finnhub;
  try {
    const r = await fetch(`/api/metrics?symbol=${encodeURIComponent(symbol)}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ── Company fundamentals via /api/fundamentals proxy (Yahoo, no key) ───────

export async function fetchFundamentals(ticker, exchange = "", known = null) {
  const symbols = await symbolsFor(ticker, exchange, known);
  if (!symbols?.yahoo) return null;
  const symbol = symbols.yahoo;
  try {
    const r = await fetch(`/api/fundamentals?symbol=${encodeURIComponent(symbol)}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ── Recent news via /api/news proxy (Yahoo, no key) ─────────────────────────

export async function fetchNews(ticker, exchange = "", known = null) {
  const symbols = await symbolsFor(ticker, exchange, known);
  if (!symbols) return null;
  const yahooSymbol   = symbols.yahoo ?? "";
  const finnhubSymbol = symbols.finnhub ?? "";
  try {
    const r = await fetch(
      `/api/news?symbol=${encodeURIComponent(yahooSymbol)}&finnhubSymbol=${encodeURIComponent(finnhubSymbol)}`
    );
    if (!r.ok) return null;
    const d = await r.json();
    return d.news ?? null;
  } catch {
    return null;
  }
}

// ── FMP + Alpha Vantage via /api/enrich proxy (both optional) ────────────

export async function fetchEnrich(ticker, exchange = "", known = null) {
  const symbols = await symbolsFor(ticker, exchange, known);
  if (!symbols?.yahoo) return null;
  const symbol = symbols.yahoo;
  try {
    const r = await fetch(`/api/enrich?symbol=${encodeURIComponent(symbol)}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ── TradingView symbol mapping ─────────────────────────────────────────────
// TradingView wants EXCHANGE:TICKER. That spelling comes from the resolution
// like every other provider's — there is no prefix table here.

export function toTVSymbol(ticker, symbols) {
  return symbols?.tradingview || ticker;
}

// ── Currency conversion ────────────────────────────────────────────────────

export function isCADExchange(exchange) {
  return exchange === "TSX" || exchange === "TSX-V";
}

export function convertPrice(price, exchange, displayCurrency, usdToCad) {
  if (typeof price !== "number") return { price: null, converted: false };
  const cad = isCADExchange(exchange);
  if (displayCurrency === "CAD" && !cad) return { price: price * usdToCad,  converted: true };
  if (displayCurrency === "USD" &&  cad) return { price: price / usdToCad,  converted: true };
  return { price, converted: false };
}

// ── AI analysis via /api/analyze proxy (user supplies OpenAI key) ─────────

export async function generateAIAnalysis(stock, analystData, openaiKey) {
  const a = analystData ?? {};

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
${a.bullish != null ? `News: ${(a.bullish * 100).toFixed(0)}% bullish, ${a.articles} articles/week` : "News sentiment: unavailable"}

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
    body: JSON.stringify({ prompt, openaiKey }),
  });

  const d = await res.json();
  if (d.error === "no_key") throw new Error("no_key");
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
