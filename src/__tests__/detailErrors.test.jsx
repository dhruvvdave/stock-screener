/**
 * A failed detail-view request used to render as nothing at all, which looks
 * exactly like a ticker that has no analyst coverage or no recent news. These
 * pin the distinction.
 */
import { render, screen, act } from "@testing-library/react";
import StockScreener from "../StockScreener.jsx";
import * as api from "../data/api.js";

const STOCK = {
  ticker: "AAPL", name: "Apple", exchange: "NASDAQ", sector: "Tech",
  price: 100, change: 1, mktCap: 3000, pe: 30, pb: 40, beta: 1.2,
  epsGrowth: 5, revGrowth: 8, vol: 50, avgVol: 45,
  high52w: 200, low52w: 90, dividendYield: 0.5, earningsDate: null,
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("markr_stocks", JSON.stringify([STOCK]));

  jest.spyOn(api, "fetchAllQuotes").mockResolvedValue(new Map());
  jest.spyOn(api, "fetchSupplementaryQuotes").mockResolvedValue({});
  jest.spyOn(api, "fetchExchangeRate").mockResolvedValue(1.36);
  jest.spyOn(api, "fetchCompanyProfile").mockResolvedValue(null);
  jest.spyOn(api, "fetchCandleData").mockResolvedValue(null);
  jest.spyOn(api, "fetchMetrics").mockResolvedValue(null);
  // Default: every section succeeds with no data.
  jest.spyOn(api, "fetchAnalystData").mockResolvedValue(null);
  jest.spyOn(api, "fetchFundamentals").mockResolvedValue(null);
  jest.spyOn(api, "fetchNews").mockResolvedValue(null);
  jest.spyOn(api, "fetchEnrich").mockResolvedValue(null);
});

afterEach(() => jest.restoreAllMocks());

async function openDetail() {
  await act(async () => { render(<StockScreener />); });
  await act(async () => { await Promise.resolve(); });
  const row = await screen.findByText("AAPL");
  await act(async () => { row.click(); });
  for (let i = 0; i < 6; i++) {
    await act(async () => { await Promise.resolve(); });
  }
}

test("a failed news request says so instead of rendering nothing", async () => {
  api.fetchNews.mockRejectedValue(new api.RequestFailed("Couldn't reach the server"));
  await openDetail();

  expect(screen.getByText("Recent News")).toBeInTheDocument();
  expect(screen.getByText("Couldn't reach the server")).toBeInTheDocument();
});

test("a rate-limited section reports the retry delay", async () => {
  api.fetchAnalystData.mockRejectedValue(
    new api.RequestFailed("Rate limited, retry in 12s", 429)
  );
  await openDetail();

  expect(screen.getByText("Rate limited, retry in 12s")).toBeInTheDocument();
});

test("no data and a failed request look different", async () => {
  // Everything resolves with nothing. No error text should appear.
  await openDetail();

  expect(screen.queryByText(/Couldn't reach the server/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Request failed/)).not.toBeInTheDocument();
});

test("one failing section does not blank the others", async () => {
  api.fetchNews.mockRejectedValue(new api.RequestFailed("Request failed (502)"));
  api.fetchAnalystData.mockResolvedValue({
    buy: 10, hold: 2, sell: 1, total: 13,
    meanTarget: 250, highTarget: 300, lowTarget: 200,
    bullish: 0.7, bearish: 0.1, articles: 20,
  });
  await openDetail();

  expect(screen.getByText("Request failed (502)")).toBeInTheDocument();
  expect(screen.getByText("Analyst consensus")).toBeInTheDocument();
  // The analyst data still rendered rather than being lost to the rejection.
  expect(screen.getByText("13 analysts")).toBeInTheDocument();
});

test("every section can fail independently", async () => {
  api.fetchAnalystData.mockRejectedValue(new api.RequestFailed("analyst down"));
  api.fetchFundamentals.mockRejectedValue(new api.RequestFailed("fundamentals down"));
  api.fetchNews.mockRejectedValue(new api.RequestFailed("news down"));
  api.fetchEnrich.mockRejectedValue(new api.RequestFailed("enrich down"));
  await openDetail();

  for (const msg of ["analyst down", "fundamentals down", "news down", "enrich down"]) {
    expect(screen.getByText(msg)).toBeInTheDocument();
  }
});
