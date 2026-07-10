// Yahoo Finance uses .TO suffix for TSX stocks, .V for TSX-V (Venture exchange)
export const YAHOO_SYMBOLS = {
  SHOP:    "SHOP.TO", CNQ:  "CNQ.TO",  RY:   "RY.TO",  TD:  "TD.TO",
  ATD:     "ATD.TO",  SU:   "SU.TO",   BCE:  "BCE.TO",  ENB: "ENB.TO",
  NTR:     "NTR.TO",  ABX:  "ABX.TO",  CP:   "CP.TO",
  "GSI.V": "GSI.V",
  JPM:  "JPM",  XOM:  "XOM", LLY: "LLY", JNJ: "JNJ",
  CAT:  "CAT",  WMT:  "WMT", UEC: "UEC",
  AAPL: "AAPL", NVDA: "NVDA", MSFT: "MSFT",
  META: "META", AMZN: "AMZN", GOOG: "GOOG",
};

// Convert bare ticker + exchange to Yahoo Finance symbol
export function toYahooSymbol(ticker, exchange) {
  if (YAHOO_SYMBOLS[ticker]) return YAHOO_SYMBOLS[ticker];
  if (exchange === "TSX")   return ticker + ".TO";
  if (exchange === "TSX-V") return ticker + ".V";   // Venture exchange uses .V, not .TO
  if (exchange === "LSE")   return ticker + ".L";
  if (exchange === "ASX")   return ticker + ".AX";
  return ticker;
}

// Finnhub uses TSX: prefix for Canadian stocks; US tickers pass through unchanged
const FINNHUB_SYMBOLS = {
  SHOP: "TSX:SHOP", CNQ:  "TSX:CNQ", RY:  "TSX:RY",  TD:  "TSX:TD",
  ATD:  "TSX:ATD",  SU:   "TSX:SU",  BCE: "TSX:BCE", ENB: "TSX:ENB",
  NTR:  "TSX:NTR",  ABX:  "TSX:ABX", CP:  "TSX:CP",
  "GSI.V": "TSXV:GSI",
};

function toFinnhubSymbol(ticker, exchange) {
  if (FINNHUB_SYMBOLS[ticker]) return FINNHUB_SYMBOLS[ticker];
  if (exchange === "TSX")   return `TSX:${ticker}`;
  if (exchange === "TSX-V") return `TSXV:${ticker}`;
  if (exchange === "LSE")   return `LSE:${ticker}`;
  if (exchange === "ASX")   return `ASX:${ticker}`;
  if (exchange === "XETRA") return `XETRA:${ticker}`;
  if (exchange === "NSE")   return `NSE:${ticker}`;
  return ticker;  // US exchanges pass through unchanged (NYSE, NASDAQ, AMEX, OTC)
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
    const symbol   = toFinnhubSymbol(ticker, exchange);
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
  const symbols = stocks.map(s => {
    const ys = toYahooSymbol(s.ticker, s.exchange);
    symbolToTicker[ys] = s.ticker;
    return ys;
  });

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

export async function fetchCandleData(ticker, exchange = "", range = "1y") {
  const yahooSymbol   = toYahooSymbol(ticker, exchange);
  const finnhubSymbol = toFinnhubSymbol(ticker, exchange);
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

export async function fetchCompanyProfile(ticker, exchange = "") {
  if (!ticker) return null;
  const yahooSymbol = toYahooSymbol(ticker, exchange);
  const finnhubSymbol = toFinnhubSymbol(ticker, exchange);
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

export async function fetchAnalystData(ticker, exchange = "") {
  const symbol = toFinnhubSymbol(ticker, exchange);
  try {
    const r = await fetch(`/api/analyst?symbol=${encodeURIComponent(symbol)}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}


// ── Finnhub stock metrics (fundamentals fallback, no Yahoo needed) ─────────

export async function fetchMetrics(ticker, exchange = "") {
  const symbol = toFinnhubSymbol(ticker, exchange);
  try {
    const r = await fetch(`/api/metrics?symbol=${encodeURIComponent(symbol)}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ── Company fundamentals via /api/fundamentals proxy (Yahoo, no key) ───────

export async function fetchFundamentals(ticker, exchange = "") {
  const symbol = toYahooSymbol(ticker, exchange);
  try {
    const r = await fetch(`/api/fundamentals?symbol=${encodeURIComponent(symbol)}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ── Recent news via /api/news proxy (Yahoo, no key) ─────────────────────────

export async function fetchNews(ticker, exchange = "") {
  const yahooSymbol   = toYahooSymbol(ticker, exchange);
  const finnhubSymbol = toFinnhubSymbol(ticker, exchange);
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

export async function fetchEnrich(ticker, exchange = "") {
  const symbol = toYahooSymbol(ticker, exchange);
  try {
    const r = await fetch(`/api/enrich?symbol=${encodeURIComponent(symbol)}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ── TradingView symbol mapping ─────────────────────────────────────────────

export function toTVSymbol(ticker, exchange) {
  const MAP = {
    "TSX":    "TSX:",
    "TSX-V":  "TSXV:",
    "NYSE":   "NYSE:",
    "NASDAQ": "NASDAQ:",
    "AMEX":   "AMEX:",
    "LSE":    "LSE:",
    "ASX":    "ASX:",
    "XETRA":  "XETRA:",
    "NSE":    "NSE:",
    "OTC":    "OTC:",
  };
  const prefix = MAP[exchange];
  return prefix ? prefix + ticker : ticker;
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
