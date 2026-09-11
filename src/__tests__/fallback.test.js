/**
 * Markr — fallback chain + helper tests
 *
 * Covers:
 *   1. Symbol resolution (resolveSymbol, toTVSymbol, isCADExchange, convertPrice)
 *   2. calculateTechnicals (pure function — RSI, MACD, Bollinger Bands, moving averages)
 *   3. Frontend fetch wrappers (fetchAllQuotes, fetchSupplementaryQuotes, fetchCandleData)
 *   4. Backend /api/stock handler — Finnhub → Yahoo → Twelve Data → 404 fallback chain
 */

import {
  toTVSymbol,
  isCADExchange,
  convertPrice,
  calculateTechnicals,
  fetchAllQuotes,
  fetchSupplementaryQuotes,
  fetchCandleData,
  resolveSymbol,
  clearResolutionCache,
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

/** A resolved /api/resolve body. */
const resolution = (over = {}) => ({
  status: 'resolved',
  ticker: 'GSI',
  exchange: 'TSX-V',
  name: 'Gatos Silver',
  currency: 'CAD',
  symbols: {
    finnhub: 'TSXV:GSI', yahoo: 'GSI.V', stooq: 'gsi.ca',
    tradingview: 'TSXV:GSI', twelvedata: 'GSI:TSXV',
  },
  candidates: [],
  ...over,
});

/** US listing, where every provider spelling is the bare ticker. */
const usResolution = (ticker) => resolution({
  ticker,
  exchange: 'NASDAQ',
  name: ticker,
  currency: 'USD',
  symbols: {
    finnhub: ticker, yahoo: ticker, stooq: `${ticker.toLowerCase()}.us`,
    tradingview: `NASDAQ:${ticker}`, twelvedata: ticker,
  },
});

/**
 * Queue a resolution response followed by the data response, which is the
 * order every fetch wrapper now issues them in.
 */
const mockResolveThen = (resolved, ...bodies) => {
  fetch.mockResolvedValueOnce(mockOk(resolved));
  for (const body of bodies) fetch.mockResolvedValueOnce(mockOk(body));
};

// Restore all mocks between tests
beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = jest.fn();
  clearResolutionCache();
});

// ─── 1. Symbol resolution ─────────────────────────────────────────────────────

describe('resolveSymbol', () => {
  test('returns every provider spelling for a resolved listing', async () => {
    fetch.mockResolvedValue(mockOk(resolution()));
    const r = await resolveSymbol('GSI');
    expect(r.status).toBe('resolved');
    expect(r.symbols.yahoo).toBe('GSI.V');
    expect(r.symbols.finnhub).toBe('TSXV:GSI');
  });

  test('passes an exchange hint through to the backend', async () => {
    fetch.mockResolvedValue(mockOk(resolution()));
    await resolveSymbol('SHOP', 'TSX');
    expect(fetch.mock.calls[0][0]).toContain('symbol=SHOP');
    expect(fetch.mock.calls[0][0]).toContain('exchange=TSX');
  });

  test('memoises a resolution so repeated lookups make one request', async () => {
    fetch.mockResolvedValue(mockOk(resolution()));
    await resolveSymbol('GSI');
    await resolveSymbol('GSI');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('caches each exchange of a ticker separately', async () => {
    fetch.mockResolvedValue(mockOk(resolution()));
    await resolveSymbol('SHOP', 'TSX');
    await resolveSymbol('SHOP', 'NYSE');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('surfaces an ambiguous listing with its candidates', async () => {
    fetch.mockResolvedValue(mockOk({
      status: 'ambiguous',
      ticker: 'SHOP',
      message: 'SHOP is listed on more than one exchange (TSX, NYSE). Pick one.',
      symbols: {},
      candidates: [
        { ticker: 'SHOP', exchange: 'TSX', name: 'Shopify' },
        { ticker: 'SHOP', exchange: 'NYSE', name: 'Shopify' },
      ],
    }));
    const r = await resolveSymbol('SHOP');
    expect(r.status).toBe('ambiguous');
    expect(r.candidates).toHaveLength(2);
    // Nothing is picked on the user's behalf.
    expect(r.symbols).toEqual({});
  });

  test('surfaces an unknown ticker with a message naming it', async () => {
    fetch.mockResolvedValue(mockOk({
      status: 'not_found', ticker: 'ZZZZ',
      message: 'No listing found for ZZZZ.', symbols: {}, candidates: [],
    }));
    const r = await resolveSymbol('ZZZZ');
    expect(r.status).toBe('not_found');
    expect(r.message).toContain('ZZZZ');
  });

  test('reports unavailable rather than throwing when the request fails', async () => {
    fetch.mockRejectedValue(new Error('network down'));
    const r = await resolveSymbol('GSI');
    expect(r.status).toBe('unavailable');
  });

  test('does not remember a failed lookup as an answer', async () => {
    fetch.mockRejectedValueOnce(new Error('network down'));
    expect((await resolveSymbol('GSI')).status).toBe('unavailable');
    fetch.mockResolvedValue(mockOk(resolution()));
    expect((await resolveSymbol('GSI')).status).toBe('resolved');
  });

  test('an empty ticker never reaches the network', async () => {
    const r = await resolveSymbol('   ');
    expect(r.status).toBe('not_found');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('toTVSymbol', () => {
  test('uses the resolved TradingView spelling', () => {
    expect(toTVSymbol('SHOP', { tradingview: 'TSX:SHOP' })).toBe('TSX:SHOP');
    expect(toTVSymbol('NVDA', { tradingview: 'NASDAQ:NVDA' })).toBe('NASDAQ:NVDA');
  });

  test('falls back to the bare ticker before a stock has resolved', () => {
    expect(toTVSymbol('FOO', null)).toBe('FOO');
    expect(toTVSymbol('FOO', {})).toBe('FOO');
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
    mockResolveThen(usResolution('AAPL'), { price: 220.5, changePercent: 1.23 });
    const result = await fetchAllQuotes(['AAPL']);
    expect(result).toBeInstanceOf(Map);
    expect(result.get('AAPL')).toEqual({ price: 220.5, change: 1.23 });
  });

  test('skips a ticker when the API response is not ok', async () => {
    fetch.mockResolvedValueOnce(mockOk(usResolution('BAD')));
    fetch.mockResolvedValueOnce(mockFail(503));
    const result = await fetchAllQuotes(['BAD']);
    expect(result.has('BAD')).toBe(false);
  });

  test('uses changePercent before falling back to change field', async () => {
    mockResolveThen(usResolution('XYZ'), { price: 50, change: 0.5 });
    const result = await fetchAllQuotes(['XYZ']);
    // changePercent is undefined → falls through to change field
    expect(result.get('XYZ').change).toBe(0.5);
  });

  test('asks the provider for the resolved spelling, not the bare ticker', async () => {
    mockResolveThen(resolution(), { price: 1.23, changePercent: 0 });
    await fetchAllQuotes([{ ticker: 'GSI', exchange: 'TSX-V' }]);
    // The old code sent "GSI", which is a different company on US exchanges.
    expect(fetch.mock.calls[1][0]).toContain('TSXV%3AGSI');
  });

  test('skips a ticker that cannot be resolved rather than guessing', async () => {
    fetch.mockResolvedValueOnce(mockOk({
      status: 'not_found', ticker: 'ZZZZ', message: 'No listing found for ZZZZ.',
      symbols: {}, candidates: [],
    }));
    const result = await fetchAllQuotes(['ZZZZ']);
    expect(result.has('ZZZZ')).toBe(false);
    // Resolution failed, so no quote request was made at all.
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('reuses a resolution already carried on the stock', async () => {
    fetch.mockResolvedValue(mockOk({ price: 10, changePercent: 1 }));
    await fetchAllQuotes([{ ticker: 'GSI', exchange: 'TSX-V', symbols: resolution().symbols }]);
    // One call: the quote. Nothing was resolved again.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain('TSXV%3AGSI');
  });
});

describe('fetchSupplementaryQuotes', () => {
  test('maps Yahoo symbols back to original tickers', async () => {
    mockResolveThen(
      resolution({ ticker: 'SHOP', exchange: 'TSX', symbols: { finnhub: 'TSX:SHOP', yahoo: 'SHOP.TO' } }),
      { 'SHOP.TO': { price: 130, change: -0.5 } },
    );
    const result = await fetchSupplementaryQuotes([{ ticker: 'SHOP', exchange: 'TSX' }]);
    expect(result).toHaveProperty('SHOP');
    expect(result.SHOP.price).toBe(130);
  });

  test('returns empty object on non-ok response', async () => {
    fetch.mockResolvedValueOnce(mockOk(resolution({ ticker: 'RY', exchange: 'TSX',
      symbols: { finnhub: 'TSX:RY', yahoo: 'RY.TO' } })));
    fetch.mockResolvedValueOnce(mockFail(429));
    const result = await fetchSupplementaryQuotes([{ ticker: 'RY', exchange: 'TSX' }]);
    expect(result).toEqual({});
  });

  test('asks for nothing when no stock resolves', async () => {
    fetch.mockResolvedValue(mockOk({
      status: 'not_found', ticker: 'ZZZZ', message: 'nope', symbols: {}, candidates: [],
    }));
    const result = await fetchSupplementaryQuotes([{ ticker: 'ZZZZ', exchange: '' }]);
    expect(result).toEqual({});
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('fetchCandleData', () => {
  test('returns the full payload (prices, lastClose, source) on success', async () => {
    mockResolveThen(usResolution('AAPL'),
      { prices: [100, 102, 101, 105], lastClose: 105, source: 'yahoo' });
    const data = await fetchCandleData('AAPL', '', '1mo');
    expect(data.prices).toEqual([100, 102, 101, 105]);
    expect(data.lastClose).toBe(105);
    expect(data.source).toBe('yahoo');
  });

  test('defaults to a 1y range so long-window indicators can compute', async () => {
    mockResolveThen(usResolution('AAPL'), { prices: [1, 2, 3] });
    await fetchCandleData('AAPL');
    expect(fetch.mock.calls[1][0]).toContain('range=1y');
  });

  test('sends both provider spellings so the fallback chain can use either', async () => {
    mockResolveThen(resolution(), { prices: [1, 2, 3] });
    await fetchCandleData('GSI', 'TSX-V');
    const url = fetch.mock.calls[1][0];
    expect(url).toContain('symbol=GSI.V');
    expect(url).toContain('finnhubSymbol=TSXV%3AGSI');
  });

  test('returns null when response contains no prices field', async () => {
    mockResolveThen(usResolution('AAPL'), { prices: null });
    expect(await fetchCandleData('AAPL')).toBeNull();
  });

  test('returns null for an empty prices array', async () => {
    mockResolveThen(usResolution('AAPL'), { prices: [] });
    expect(await fetchCandleData('AAPL')).toBeNull();
  });

  test('returns null without charting anything when the ticker is unresolvable', async () => {
    fetch.mockResolvedValue(mockOk({
      status: 'not_found', ticker: 'ZZZZ', message: 'No listing found for ZZZZ.',
      symbols: {}, candidates: [],
    }));
    expect(await fetchCandleData('ZZZZ')).toBeNull();
    // An empty chart used to be drawn from a bare-ticker request; now no
    // request is made at all.
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

// ─── 4. /api/stock handler — fallback chain ───────────────────────────────────

describe('/api/stock handler — Finnhub → Yahoo → Twelve Data fallback chain', () => {
  const FINNHUB_URL = 'https://finnhub.io';
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
