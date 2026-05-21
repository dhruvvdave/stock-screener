import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "./components/Header";
import StockList from "./components/StockList";
import StockDetail from "./components/StockDetail";
import {
  fetchAllQuotes,
  fetchCandleData,
  fetchCompanyProfile,
  fetchExchangeRate,
  fetchSupplementaryQuotes,
} from "./data/api";
import { fmt } from "./data/stocks";
import { useLocalStorage } from "./hooks/useLocalStorage";

const STYLE = `
  .ts-app {
    min-height: 100%;
    display: flex;
    flex-direction: column;
  }

  .ts-rail-card {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: rgba(255,255,255,0.02);
    padding: 14px;
    margin-bottom: 12px;
  }
  .ts-rail-title {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-3);
    margin-bottom: 10px;
  }

  .ts-watch-row {
    display: grid;
    grid-template-columns: 1fr 72px 78px;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
  }
  .ts-watch-row:last-child { margin-bottom: 0; }
  .ts-watch-ticker {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .ts-watch-price {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-2);
    text-align: right;
  }
  .ts-input {
    width: 100%;
    background: rgba(255,255,255,0.02);
    border: 1px solid var(--border);
    border-radius: 7px;
    color: var(--text-1);
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 6px 7px;
    outline: none;
  }
  .ts-input:focus { border-color: var(--border-2); }

  .ts-muted {
    color: var(--text-3);
    font-size: 11px;
    line-height: 1.5;
  }

  .ts-table {
    width: 100%;
    border-collapse: collapse;
  }
  .ts-table th {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--text-3);
    letter-spacing: 0.07em;
    text-transform: uppercase;
    padding: 0 0 6px;
    text-align: right;
    white-space: nowrap;
  }
  .ts-table th:first-child,
  .ts-table td:first-child { text-align: left; }
  .ts-table td {
    padding: 6px 0;
    border-top: 1px solid var(--border);
    font-size: 11px;
    color: var(--text-2);
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .ts-table .ts-col-ticker {
    color: var(--accent);
    font-family: var(--font-mono);
  }
  .ts-pos { color: var(--pos); }
  .ts-neg { color: var(--neg); }

  .ts-inline-form {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    margin: 0 0 10px;
  }
  .ts-btn {
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-2);
    border-radius: 7px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 0 8px;
    cursor: pointer;
    transition: color 0.1s, border-color 0.1s;
  }
  .ts-btn:hover { color: var(--text-1); border-color: var(--border-2); }

  .ts-earn-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    border-top: 1px solid var(--border);
    padding: 7px 0;
  }
  .ts-earn-item:first-of-type { border-top: none; padding-top: 0; }
  .ts-earn-ticker {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent);
  }
  .ts-earn-date {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-2);
  }
`;

function formatClock(date = new Date()) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatEarnings(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function parseNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sortStocks(stocks, sort) {
  const { key, direction } = sort;
  const dir = direction === "asc" ? 1 : -1;
  return [...stocks].sort((a, b) => {
    const va = a[key];
    const vb = b[key];

    if (key === "ticker") {
      return dir * String(va ?? "").localeCompare(String(vb ?? ""));
    }

    const na = typeof va === "number" ? va : Number.NEGATIVE_INFINITY;
    const nb = typeof vb === "number" ? vb : Number.NEGATIVE_INFINITY;
    if (na === nb) return String(a.ticker).localeCompare(String(b.ticker));
    return dir * (na - nb);
  });
}

function createStockFromResult(result) {
  return {
    ticker: result.symbol,
    name: result.name || result.symbol,
    exchange: result.exchange || "US",
    sector: "—",
    description: "",
    price: null,
    change: null,
    mktCap: null,
    pe: null,
    pb: null,
    beta: null,
    epsGrowth: null,
    revGrowth: null,
    vol: null,
    avgVol: null,
    high52w: null,
    low52w: null,
    dividendYield: null,
    earningsDate: null,
  };
}

export default function StockScreener() {
  const [stocks, setStocks] = useLocalStorage("tickerly_stocks", []);
  const [watchlist, setWatchlist] = useLocalStorage("tickerly_watchlist", []);
  const [priceAlerts, setPriceAlerts] = useLocalStorage("tickerly_price_alerts", {});
  const [portfolio, setPortfolio] = useLocalStorage("tickerly_portfolio", {});
  const [currency, setCurrency] = useLocalStorage("tickerly_currency", "USD");

  const [profiles, setProfiles] = useState({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesLive, setQuotesLive] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [chartRange, setChartRange] = useState("1mo");
  const [candleData, setCandleData] = useState(null);
  const [sort, setSort] = useState({ key: "ticker", direction: "asc" });
  const [navIndex, setNavIndex] = useState(0);
  const [clock, setClock] = useState(formatClock());
  const [nowTs, setNowTs] = useState(() => Math.floor(Date.now() / 1000));
  const [usdToCadRate, setUsdToCadRate] = useState(1.36);
  const [portfolioTickerInput, setPortfolioTickerInput] = useState("");

  const previousPricesRef = useRef({});
  const crossedStateRef = useRef({});
  const loadingProfilesRef = useRef(new Set());

  const sortedStocks = useMemo(() => sortStocks(stocks, sort), [stocks, sort]);
  const clampedNavIndex = Math.min(navIndex, Math.max(0, sortedStocks.length - 1));
  const activeTicker = sortedStocks[clampedNavIndex]?.ticker ?? null;
  const selectedStock = useMemo(
    () => stocks.find((s) => s.ticker === selectedTicker) ?? null,
    [selectedTicker, stocks]
  );

  const toggleWatch = useCallback((ticker) => {
    setWatchlist((prev) => (prev.includes(ticker) ? prev.filter((t) => t !== ticker) : [...prev, ticker]));
  }, [setWatchlist]);

  const ensureNotificationPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }, []);

  const notifyThresholdCrossed = useCallback((ticker, current, threshold) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    new Notification(`Tickerly alert: ${ticker}`, {
      body: `Price ${current >= threshold ? "rose above" : "fell below"} ${fmt(threshold, 2)} (now ${fmt(current, 2)})`,
      silent: false,
    });
  }, []);

  const refreshQuotes = useCallback(async () => {
    if (!stocks.length) {
      setQuotesLive(false);
      return;
    }

    setQuotesLoading(true);
    try {
      const [quotesMap, supplementaryMap] = await Promise.all([
        fetchAllQuotes(stocks),
        fetchSupplementaryQuotes(stocks),
      ]);

      // Keep quote fields live while preserving each stock's custom metadata.
      setStocks((prev) => prev.map((stock) => ({
        ...stock,
        ...(quotesMap.get(stock.ticker) ?? {}),
        ...(supplementaryMap[stock.ticker] ?? {}),
      })));

      const nextPrices = {};
      quotesMap.forEach((quote, ticker) => {
        if (typeof quote.price === "number") nextPrices[ticker] = quote.price;
      });

      // Detect threshold crossings on each refresh and fire notifications only on state transitions.
      Object.entries(priceAlerts).forEach(([ticker, thresholdRaw]) => {
        const threshold = Number(thresholdRaw);
        const prev = previousPricesRef.current[ticker];
        const current = nextPrices[ticker];
        if (!Number.isFinite(threshold) || typeof prev !== "number" || typeof current !== "number") return;

        const crossedUp = prev < threshold && current >= threshold;
        const crossedDown = prev > threshold && current <= threshold;
        const direction = crossedUp ? "above" : crossedDown ? "below" : null;
        if (!direction) return;

        if (crossedStateRef.current[ticker] !== direction) {
          crossedStateRef.current[ticker] = direction;
          notifyThresholdCrossed(ticker, current, threshold);
        }
      });

      previousPricesRef.current = { ...previousPricesRef.current, ...nextPrices };
      setQuotesLive(quotesMap.size > 0);
    } catch {
      setQuotesLive(false);
    } finally {
      setQuotesLoading(false);
    }
  }, [notifyThresholdCrossed, priceAlerts, setStocks, stocks]);

  const addStock = useCallback((result, options = {}) => {
    const incoming = createStockFromResult({
      ...result,
      symbol: String(result.symbol || "").toUpperCase(),
    });

    if (!incoming.ticker) return;

    let alreadyExists = false;
    setStocks((prev) => {
      const existing = prev.find((s) => s.ticker === incoming.ticker);
      if (existing) {
        alreadyExists = true;
        return prev.map((s) => (s.ticker === incoming.ticker
          ? { ...s, name: existing.name || incoming.name, exchange: existing.exchange || incoming.exchange }
          : s));
      }
      return [incoming, ...prev];
    });

    if (options.select || alreadyExists) {
      setSelectedTicker(incoming.ticker);
    }
  }, [setStocks]);

  const onSortChange = useCallback((key) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { ...prev, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: key === "ticker" ? "asc" : "desc" };
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClock(formatClock()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Math.floor(Date.now() / 1000)), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchExchangeRate().then((rate) => {
      if (!cancelled) setUsdToCadRate(rate);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { refreshQuotes(); }, 0);
    const interval = setInterval(refreshQuotes, 45000);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
    };
  }, [refreshQuotes]);

  useEffect(() => {
    if (!selectedStock) return;

    let cancelled = false;
    fetchCandleData(selectedStock.ticker, selectedStock.exchange, chartRange).then((prices) => {
      if (!cancelled) setCandleData(prices);
    });

    return () => { cancelled = true; };
  }, [selectedStock, chartRange]);

  useEffect(() => {
    if (!stocks.length) return;

    const missing = stocks.filter(
      (stock) => !profiles[stock.ticker] && !loadingProfilesRef.current.has(stock.ticker)
    );
    if (!missing.length) return;

    missing.forEach((stock) => {
      loadingProfilesRef.current.add(stock.ticker);
      fetchCompanyProfile(stock.ticker, stock.exchange)
        .then((profile) => {
          if (!profile) return;
          setProfiles((prev) => ({ ...prev, [stock.ticker]: profile }));
          setStocks((prev) => prev.map((s) => (
            s.ticker === stock.ticker
              ? {
                ...s,
                name: profile.companyName || s.name,
                sector: profile.sector || s.sector,
                description: profile.description || s.description,
              }
              : s
          )));
        })
        .finally(() => {
          loadingProfilesRef.current.delete(stock.ticker);
        });
    });
  }, [profiles, setStocks, stocks]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;

      if (event.key === "Escape" && selectedTicker) {
        event.preventDefault();
        setSelectedTicker(null);
        return;
      }

      if (!sortedStocks.length) return;

      // Terminal-style keyboard navigation for fast list scanning and starring.
      if (event.key === "j" && !selectedTicker) {
        event.preventDefault();
        setNavIndex((i) => Math.min(sortedStocks.length - 1, i + 1));
      } else if (event.key === "k" && !selectedTicker) {
        event.preventDefault();
        setNavIndex((i) => Math.max(0, i - 1));
      } else if (event.key === "Enter" && !selectedTicker) {
        event.preventDefault();
        setSelectedTicker(sortedStocks[clampedNavIndex]?.ticker ?? null);
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        const targetTicker = selectedTicker || sortedStocks[clampedNavIndex]?.ticker;
        if (targetTicker) toggleWatch(targetTicker);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clampedNavIndex, selectedTicker, sortedStocks, toggleWatch]);

  const trackedTickers = useMemo(() => Array.from(new Set([...watchlist, ...Object.keys(portfolio)])), [portfolio, watchlist]);

  const watchlistStocks = useMemo(
    () => watchlist.map((ticker) => stocks.find((s) => s.ticker === ticker)).filter(Boolean),
    [stocks, watchlist]
  );

  const portfolioRows = useMemo(() => {
    const rows = trackedTickers.map((ticker) => {
      const stock = stocks.find((s) => s.ticker === ticker) ?? { ticker, price: null };
      const entry = portfolio[ticker] ?? { shares: "", avgCost: "" };
      const shares = parseNumber(entry.shares);
      const avgCost = parseNumber(entry.avgCost);
      const value = typeof stock.price === "number" ? stock.price * shares : 0;
      const pl = typeof stock.price === "number" ? (stock.price - avgCost) * shares : 0;
      return {
        ticker,
        shares,
        avgCost,
        value,
        pl,
        price: stock.price,
      };
    });

    const totalValue = rows.reduce((acc, row) => acc + row.value, 0);
    return rows.map((row) => ({
      ...row,
      allocation: totalValue > 0 ? (row.value / totalValue) * 100 : 0,
    }));
  }, [portfolio, stocks, trackedTickers]);

  const earningsItems = useMemo(() => {
    return trackedTickers
      .map((ticker) => {
        const stock = stocks.find((s) => s.ticker === ticker);
        return stock?.earningsDate ? { ticker, earningsDate: stock.earningsDate } : null;
      })
      .filter((item) => item && item.earningsDate >= nowTs)
      .sort((a, b) => a.earningsDate - b.earningsDate);
  }, [nowTs, stocks, trackedTickers]);

  const updateAlert = useCallback((ticker, raw) => {
    setPriceAlerts((prev) => {
      if (!raw.trim()) {
        const next = { ...prev };
        delete next[ticker];
        return next;
      }
      return { ...prev, [ticker]: raw };
    });
    ensureNotificationPermission();
  }, [ensureNotificationPermission, setPriceAlerts]);

  const updatePortfolioField = useCallback((ticker, key, value) => {
    setPortfolio((prev) => ({
      ...prev,
      [ticker]: {
        shares: prev[ticker]?.shares ?? "",
        avgCost: prev[ticker]?.avgCost ?? "",
        [key]: value,
      },
    }));
  }, [setPortfolio]);

  const addPortfolioTicker = useCallback(() => {
    const ticker = portfolioTickerInput.trim().toUpperCase();
    if (!ticker) return;
    setPortfolio((prev) => ({
      ...prev,
      [ticker]: prev[ticker] ?? { shares: "", avgCost: "" },
    }));
    addStock({ symbol: ticker, name: ticker, exchange: "US" });
    setPortfolioTickerInput("");
  }, [addStock, portfolioTickerInput, setPortfolio]);

  const rightRail = (
    <>
      <div className="ts-rail-card">
        <div className="ts-rail-title">Watchlist alerts</div>
        {watchlistStocks.length === 0 ? (
          <div className="ts-muted">Star stocks with “s” or ☆, then set native-currency alert thresholds.</div>
        ) : (
          watchlistStocks.map((stock) => (
            <div key={stock.ticker} className="ts-watch-row">
              <div className="ts-watch-ticker">{stock.ticker}</div>
              <div className="ts-watch-price">{typeof stock.price === "number" ? `$${fmt(stock.price, 2)}` : "—"}</div>
              <input
                className="ts-input"
                value={priceAlerts[stock.ticker] ?? ""}
                onChange={(e) => updateAlert(stock.ticker, e.target.value)}
                placeholder="Alert"
                inputMode="decimal"
              />
            </div>
          ))
        )}
      </div>

      <div className="ts-rail-card">
        <div className="ts-rail-title">Portfolio tracker</div>
        <div className="ts-inline-form">
          <input
            className="ts-input"
            value={portfolioTickerInput}
            onChange={(e) => setPortfolioTickerInput(e.target.value)}
            placeholder="Add ticker"
            onKeyDown={(e) => e.key === "Enter" && addPortfolioTicker()}
          />
          <button className="ts-btn" onClick={addPortfolioTicker}>Add</button>
        </div>

        {portfolioRows.length === 0 ? (
          <div className="ts-muted">Add tickers, then enter shares and avg cost to track value, P/L, and allocation.</div>
        ) : (
          <table className="ts-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Shares</th>
                <th>Avg Cost</th>
                <th>Value</th>
                <th>P/L</th>
                <th>Allocation%</th>
              </tr>
            </thead>
            <tbody>
              {portfolioRows.map((row) => (
                <tr key={row.ticker}>
                  <td className="ts-col-ticker">{row.ticker}</td>
                  <td>
                    <input
                      className="ts-input"
                      value={portfolio[row.ticker]?.shares ?? ""}
                      onChange={(e) => updatePortfolioField(row.ticker, "shares", e.target.value)}
                      inputMode="decimal"
                      placeholder="0"
                      aria-label={`${row.ticker} shares`}
                    />
                  </td>
                  <td>
                    <input
                      className="ts-input"
                      value={portfolio[row.ticker]?.avgCost ?? ""}
                      onChange={(e) => updatePortfolioField(row.ticker, "avgCost", e.target.value)}
                      inputMode="decimal"
                      placeholder="0"
                      aria-label={`${row.ticker} average cost`}
                    />
                  </td>
                  <td>${fmt(row.value, 2)}</td>
                  <td className={row.pl >= 0 ? "ts-pos" : "ts-neg"}>{row.pl >= 0 ? "+" : ""}${fmt(row.pl, 2)}</td>
                  <td>{fmt(row.allocation, 1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="ts-rail-card">
        <div className="ts-rail-title">Upcoming earnings</div>
        {earningsItems.length === 0 ? (
          <div className="ts-muted">No upcoming earnings dates in your watchlist/portfolio yet.</div>
        ) : (
          earningsItems.map((item) => (
            <div key={item.ticker} className="ts-earn-item">
              <span className="ts-earn-ticker">{item.ticker}</span>
              <span className="ts-earn-date">{formatEarnings(item.earningsDate)}</span>
            </div>
          ))
        )}
      </div>
    </>
  );

  return (
    <>
      <style>{STYLE}</style>
      <main className="ts-app">
        <Header
          clock={clock}
          watchlistCount={watchlist.length}
          currency={currency}
          onCurrencyToggle={setCurrency}
          quotesLoading={quotesLoading}
          quotesLive={quotesLive}
        />

        {selectedStock ? (
          <StockDetail
            stock={selectedStock}
            onBack={() => { setSelectedTicker(null); setCandleData(null); }}
            watchlist={watchlist}
            onStarClick={toggleWatch}
            currency={currency}
            usdToCadRate={usdToCadRate}
            candleData={candleData}
            supplementary={null}
            profile={profiles[selectedStock.ticker] ?? null}
            chartRange={chartRange}
            onChartRangeChange={setChartRange}
          />
        ) : (
          <StockList
            stocks={sortedStocks}
            watchlist={watchlist}
            onStarClick={toggleWatch}
            onSelect={(stock) => setSelectedTicker(stock.ticker)}
            onAddStock={addStock}
            currency={currency}
            usdToCadRate={usdToCadRate}
            quotesLoading={quotesLoading}
            quotesLive={quotesLive}
            activeTicker={activeTicker}
            sort={sort}
            onSortChange={onSortChange}
            rightRail={rightRail}
          />
        )}
      </main>
    </>
  );
}
