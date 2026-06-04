/**
 * Markr — fallback chain + helper tests
 *
 * Covers:
 *   1. Symbol resolution helpers (toYahooSymbol, toTVSymbol, isCADExchange, convertPrice)
 *   2. calculateTechnicals (pure function — RSI, MACD, Bollinger Bands, moving averages)
 *   3. Frontend fetch wrappers (fetchAllQuotes, fetchSupplementaryQuotes, fetchCandleData)
 *   4. Backend /api/stock handler — Finnhub → Yahoo → Twelve Data → 404 fallback chain
 */

import {
  toYahooSymbol,
  toTVSymbol,
  isCADExchange,
  convertPrice,
  calculateTechnicals,
  fetchAllQuotes,
  fetchSupplementaryQuotes,
  fetchCandleData,
} from '../data/api.js';

import stockHandler from '../../api/stock.js';

// ─── Shared test helpers ──────────────────────────────────────────────────────

/** Build a minimal mock Response that fetch() would return. */
const mockOk = (body) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const mockFail = (status = 500) =>
  Promise.resolve({ ok: false, status, json: () => Promise.resolve({}) });

/** Build a mock Express-style res object and capture calls to .json(). */
const makeMockRes = () => {
  const res = { _status: 200, _body: undefined };
  res.setHeader = jest.fn();
  res.status = jest.fn((code) => { res._status = code; return res; });
  res.json    = jest.fn((body)  => { res._body  = body; });
  return res;
};

// Restore all mocks between tests
beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = jest.fn();
});

// ─── 1. Symbol resolution ─────────────────────────────────────────────────────

describe('toYahooSymbol', () => {
  test('hardcoded TSX ticker uses map value', () => {
    expect(toYahooSymbol('SHOP', 'TSX')).toBe('SHOP.TO');
  });

  test('unknown TSX ticker appends .TO', () => {
    expect(toYahooSymbol('XYZ', 'TSX')).toBe('XYZ.TO');
  });

  test('TSX-V ticker appends .V', () => {
    expect(toYahooSymbol('ABC', 'TSX-V')).toBe('ABC.V');
  });

  test('LSE ticker appends .L', () => {
    expect(toYahooSymbol('VOD', 'LSE')).toBe('VOD.L');
  });

  test('US ticker with no exchange passes through unchanged', () => {
    expect(toYahooSymbol('AAPL', 'NASDAQ')).toBe('AAPL');
  });
});

describe('toTVSymbol', () => {
  test('TSX exchange produces TSX: prefix', () => {
    expect(toTVSymbol('SHOP', 'TSX')).toBe('TSX:SHOP');
  });

  test('NASDAQ exchange produces NASDAQ: prefix', () => {
    expect(toTVSymbol('NVDA', 'NASDAQ')).toBe('NASDAQ:NVDA');
  });

  test('unknown exchange returns bare ticker', () => {
    expect(toTVSymbol('FOO', 'UNKNOWN')).toBe('FOO');
  });
});

describe('isCADExchange + convertPrice', () => {
  test('TSX and TSX-V are CAD exchanges', () => {
    expect(isCADExchange('TSX')).toBe(true);
    expect(isCADExchange('TSX-V')).toBe(true);
    expect(isCADExchange('NYSE')).toBe(false);
  });

  test('USD price on US stock converts to CAD when display is CAD', () => {
    const { price, converted } = convertPrice(100, 'NYSE', 'CAD', 1.35);
    expect(price).toBeCloseTo(135, 5);
    expect(converted).toBe(true);
  });

  test('CAD price on TSX stock converts to USD when display is USD', () => {
    const { price, converted } = convertPrice(135, 'TSX', 'USD', 1.35);
    expect(price).toBeCloseTo(100, 5);
    expect(converted).toBe(true);
  });

  test('no conversion when stock currency already matches display currency', () => {
    const { price, converted } = convertPrice(150, 'NYSE', 'USD', 1.35);
    expect(price).toBe(150);
    expect(converted).toBe(false);
  });

  test('returns null price for non-numeric input', () => {
    expect(convertPrice(null, 'NYSE', 'USD', 1.35).price).toBeNull();
  });
});

// ─── 2. calculateTechnicals ───────────────────────────────────────────────────

/** Deterministic price series: starts at 100, adds ±1 in a wave pattern. */
function makePrices(n, seed = 100) {
  const prices = [seed];
  for (let i = 1; i < n; i++) {
    prices.push(+(prices[i - 1] + Math.sin(i) * 2).toFixed(4));
  }
  return prices;
}

describe('calculateTechnicals', () => {
  test('returns all-null for fewer than 15 prices', () => {
    const t = calculateTechnicals([100, 101, 102]);
    expect(t.rsi).toBeNull();
    expect(t.ma50).toBeNull();
    expect(t.bbUpper).toBeNull();
  });

  test('RSI is a number between 0 and 100 for sufficient data', () => {
    const t = calculateTechnicals(makePrices(30));
    expect(typeof t.rsi).toBe('number');
    expect(t.rsi).toBeGreaterThanOrEqual(0);
    expect(t.rsi).toBeLessThanOrEqual(100);
  });

  test('ma50 is null when fewer than 50 prices, computed when enough', () => {
    expect(calculateTechnicals(makePrices(30)).ma50).toBeNull();
    const t50 = calculateTechnicals(makePrices(60));
    expect(typeof t50.ma50).toBe('number');
    expect(t50.ma50).toBeGreaterThan(0);
  });

  test('Bollinger Bands: upper > mid > lower for ≥ 20 prices', () => {
    const t = calculateTechnicals(makePrices(25));
    expect(t.bbUpper).toBeGreaterThan(t.bbMid);
    expect(t.bbMid).toBeGreaterThan(t.bbLower);
  });

  test('MACD and signal line are numbers for ≥ 26 prices', () => {
    const t = calculateTechnicals(makePrices(40));
    expect(typeof t.macd).toBe('number');
    expect(typeof t.macdSignal).toBe('number');
  });
});

// ─── 3. Frontend fetch wrappers ───────────────────────────────────────────────

describe('fetchAllQuotes', () => {
  test('returns a Map with price and change on success', async () => {
    fetch.mockResolvedValue(mockOk({ price: 220.5, changePercent: 1.23 }));
    const result = await fetchAllQuotes(['AAPL']);
    expect(result).toBeInstanceOf(Map);
    expect(result.get('AAPL')).toEqual({ price: 220.5, change: 1.23 });
  });

  test('skips a ticker when the API response is not ok', async () => {
    fetch.mockResolvedValue(mockFail(503));
    const result = await fetchAllQuotes(['BAD']);
    expect(result.has('BAD')).toBe(false);
  });

  test('uses changePercent before falling back to change field', async () => {
    fetch.mockResolvedValue(mockOk({ price: 50, change: 0.5 }));
    const result = await fetchAllQuotes(['XYZ']);
    // changePercent is undefined → falls through to change field
    expect(result.get('XYZ').change).toBe(0.5);
  });
});

describe('fetchSupplementaryQuotes', () => {
  test('maps Yahoo symbols back to original tickers', async () => {
    // Backend returns keyed by Yahoo symbol (e.g. SHOP.TO)
    fetch.mockResolvedValue(mockOk({ 'SHOP.TO': { price: 130, change: -0.5 } }));
    const result = await fetchSupplementaryQuotes([{ ticker: 'SHOP', exchange: 'TSX' }]);
    expect(result).toHaveProperty('SHOP');
    expect(result.SHOP.price).toBe(130);
  });

  test('returns empty object on non-ok response', async () => {
    fetch.mockResolvedValue(mockFail(429));
    const result = await fetchSupplementaryQuotes([{ ticker: 'RY', exchange: 'TSX' }]);
    expect(result).toEqual({});
  });
});

describe('fetchCandleData', () => {
  test('returns prices array on success', async () => {
    fetch.mockResolvedValue(mockOk({ prices: [100, 102, 101, 105] }));
    const prices = await fetchCandleData('AAPL', '', '1mo');
    expect(prices).toEqual([100, 102, 101, 105]);
  });

  test('returns null when response contains no prices field', async () => {
    fetch.mockResolvedValue(mockOk({ prices: null }));
    expect(await fetchCandleData('AAPL')).toBeNull();
  });
});

// ─── 4. /api/stock handler — fallback chain ───────────────────────────────────

describe('/api/stock handler — Finnhub → Yahoo → Twelve Data fallback chain', () => {
  const FINNHUB_URL = 'https://finnhub.io';
  const YAHOO_URL   = 'https://query1.finance.yahoo.com';
  const TD_URL      = 'https://api.twelvedata.com';

  beforeEach(() => {
    process.env.FINNHUB_KEY    = 'test_finnhub_key';
    process.env.TWELVE_DATA_KEY = 'test_td_key';
  });

  afterEach(() => {
    delete process.env.FINNHUB_KEY;
    delete process.env.TWELVE_DATA_KEY;
  });

  test('returns Finnhub data when Finnhub responds with a valid quote', async () => {
    fetch.mockResolvedValue(mockOk({ c: 182.5, d: 1.2, dp: 0.66, h: 183, l: 180, o: 181, pc: 181.3, t: 1700000000, v: 55000000 }));
    const req = { query: { symbol: 'AAPL' } };
    const res = makeMockRes();
    await stockHandler(req, res);
    expect(res._body.price).toBe(182.5);
    expect(res._body.symbol).toBe('AAPL');
    // Only one fetch call — Finnhub was enough
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain(FINNHUB_URL);
  });

  test('falls through to Yahoo when Finnhub returns c=0 (no data)', async () => {
    fetch
      .mockResolvedValueOnce(mockOk({ c: 0, d: null, dp: null })) // Finnhub: invalid
      .mockResolvedValueOnce(mockOk({                              // Yahoo: valid
        quoteResponse: {
          result: [{ regularMarketPrice: 175.0, regularMarketChangePercent: -0.5, regularMarketChange: -0.88, regularMarketVolume: 48000000 }]
        }
      }));

    const req = { query: { symbol: 'TSX:SHOP' } };
    const res = makeMockRes();
    await stockHandler(req, res);
    expect(res._body.price).toBe(175.0);
    expect(fetch.mock.calls[1][0]).toContain('finance.yahoo.com');
  });

  test('falls through to Twelve Data when Finnhub and Yahoo both fail', async () => {
    fetch
      .mockResolvedValueOnce(mockFail(500))          // Finnhub: HTTP error
      .mockResolvedValueOnce(mockFail(503))          // Yahoo query1: error
      .mockResolvedValueOnce(mockFail(503))          // Yahoo query2: error
      .mockResolvedValueOnce(mockOk({ price: '92.30' })); // Twelve Data: success

    const req = { query: { symbol: 'AAPL' } };
    const res = makeMockRes();
    await stockHandler(req, res);
    expect(res._body.price).toBe(92.30);
    expect(fetch.mock.calls.at(-1)[0]).toContain(TD_URL);
  });

  test('returns 404 when all three sources fail', async () => {
    fetch.mockResolvedValue(mockFail(503)); // every call fails

    const req = { query: { symbol: 'AAPL' } };
    const res = makeMockRes();
    await stockHandler(req, res);
    expect(res._status).toBe(404);
    expect(res._body.error).toMatch(/No quote found/);
  });

  test('returns 400 when no symbol is provided', async () => {
    const req = { query: {} };
    const res = makeMockRes();
    await stockHandler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toMatch(/Missing symbol/);
    expect(fetch).not.toHaveBeenCalled();
  });
});
