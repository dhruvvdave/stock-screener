/**
 * Regression tests for the quote-refresh cadence in StockScreener.
 *
 * refreshQuotes replaces `stocks` on every run. While it also *depended* on
 * `stocks`, each completed refresh gave the callback a new identity, tore
 * down the interval effect keyed on it, and re-fired immediately — so the
 * app polled as fast as the network allowed instead of every 45 seconds.
 */
import { render, act } from "@testing-library/react";
import StockScreener from "../StockScreener.jsx";
import * as api from "../data/api.js";

const REFRESH_MS = 45000;

const STOCK = {
  ticker: "AAPL", name: "Apple", exchange: "NASDAQ", sector: "Tech",
  price: 100, change: 1, mktCap: null, pe: null, pb: null, beta: null,
  epsGrowth: null, revGrowth: null, vol: null, avgVol: null,
  high52w: null, low52w: null, dividendYield: null, earningsDate: null,
};

let quoteCalls;

beforeEach(() => {
  quoteCalls = 0;
  localStorage.clear();
  localStorage.setItem("markr_stocks", JSON.stringify([STOCK]));

  jest.spyOn(api, "fetchAllQuotes").mockImplementation(async (stocks) => {
    quoteCalls += 1;
    return new Map(stocks.map((s) => [s.ticker, { price: 100 + quoteCalls, change: 1 }]));
  });
  jest.spyOn(api, "fetchSupplementaryQuotes").mockResolvedValue({});
  jest.spyOn(api, "fetchExchangeRate").mockResolvedValue(1.36);
  jest.spyOn(api, "fetchCompanyProfile").mockResolvedValue(null);
  jest.spyOn(api, "fetchCandleData").mockResolvedValue(null);
  jest.spyOn(api, "fetchAnalystData").mockResolvedValue(null);
  jest.spyOn(api, "fetchFundamentals").mockResolvedValue(null);
  jest.spyOn(api, "fetchNews").mockResolvedValue(null);
  jest.spyOn(api, "fetchEnrich").mockResolvedValue(null);
  jest.spyOn(api, "fetchMetrics").mockResolvedValue(null);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

/** Let pending promise callbacks run without advancing the fake clock. */
async function flush(times = 6) {
  for (let i = 0; i < times; i++) {
    await act(async () => { await Promise.resolve(); });
  }
}

test("fetches once on mount", async () => {
  jest.useFakeTimers();
  await act(async () => { render(<StockScreener />); });
  await flush();
  expect(quoteCalls).toBe(1);
});

test("does not refetch between ticks", async () => {
  jest.useFakeTimers();
  await act(async () => { render(<StockScreener />); });
  await flush();
  expect(quoteCalls).toBe(1);

  // Nudge the clock well short of the interval, letting every settled
  // promise run in between. The old cycle refired here on each resolution.
  for (let i = 0; i < 20; i++) {
    await act(async () => { jest.advanceTimersByTime(100); });
    await flush(2);
  }

  expect(quoteCalls).toBe(1);
});

test("refetches once per interval", async () => {
  jest.useFakeTimers();
  await act(async () => { render(<StockScreener />); });
  await flush();

  await act(async () => { jest.advanceTimersByTime(REFRESH_MS); });
  await flush();
  expect(quoteCalls).toBe(2);

  await act(async () => { jest.advanceTimersByTime(REFRESH_MS); });
  await flush();
  expect(quoteCalls).toBe(3);
});

test("a refresh slower than the interval does not stack requests", async () => {
  jest.useFakeTimers();
  let release;
  api.fetchAllQuotes.mockImplementation(async (stocks) => {
    quoteCalls += 1;
    await new Promise((resolve) => { release = resolve; });
    return new Map(stocks.map((s) => [s.ticker, { price: 101, change: 1 }]));
  });

  await act(async () => { render(<StockScreener />); });
  await flush();
  expect(quoteCalls).toBe(1);

  // Three ticks pass while the first request is still outstanding.
  for (let i = 0; i < 3; i++) {
    await act(async () => { jest.advanceTimersByTime(REFRESH_MS); });
    await flush(2);
  }
  expect(quoteCalls).toBe(1);

  await act(async () => { release(); await Promise.resolve(); });
  await flush();
  expect(quoteCalls).toBe(1);
});

test("stops polling when unmounted", async () => {
  jest.useFakeTimers();
  let unmount;
  await act(async () => { ({ unmount } = render(<StockScreener />)); });
  await flush();
  expect(quoteCalls).toBe(1);

  await act(async () => { unmount(); });
  await act(async () => { jest.advanceTimersByTime(REFRESH_MS * 3); });
  await flush();
  expect(quoteCalls).toBe(1);
});

test("makes no requests with an empty watchlist", async () => {
  localStorage.setItem("markr_stocks", JSON.stringify([]));
  jest.useFakeTimers();
  await act(async () => { render(<StockScreener />); });
  await flush();
  await act(async () => { jest.advanceTimersByTime(REFRESH_MS * 2); });
  await flush();
  expect(quoteCalls).toBe(0);
});
