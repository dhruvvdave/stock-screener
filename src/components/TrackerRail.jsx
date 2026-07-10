import { useMemo, useState } from "react";
import { fmt } from "../data/stocks";

function formatEarnings(ts) {
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function parseNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function TrackerRail({
  stocks,
  watchlist,
  priceAlerts,
  onAlertChange,
  portfolio,
  onPortfolioField,
  onAddPortfolioTicker,
  nowTs,
}) {
  const [tickerInput, setTickerInput] = useState("");

  const trackedTickers = useMemo(
    () => Array.from(new Set([...watchlist, ...Object.keys(portfolio)])),
    [portfolio, watchlist]
  );

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
      return { ticker, shares, avgCost, value, pl, price: stock.price };
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

  const addTicker = () => {
    const ticker = tickerInput.trim().toUpperCase();
    if (!ticker) return;
    onAddPortfolioTicker(ticker);
    setTickerInput("");
  };

  return (
    <>
      <div className="ts-rail-card">
        <div className="ts-rail-title">Watchlist alerts</div>
        {watchlistStocks.length === 0 ? (
          <div className="ts-muted">Star stocks with "s" or ☆, then set price alert thresholds.</div>
        ) : (
          watchlistStocks.map((stock) => (
            <div key={stock.ticker} className="ts-watch-row">
              <div className="ts-watch-ticker">{stock.ticker}</div>
              <div className="ts-watch-price">{typeof stock.price === "number" ? `$${fmt(stock.price, 2)}` : "—"}</div>
              <input
                className="ts-input"
                value={priceAlerts[stock.ticker] ?? ""}
                onChange={(e) => onAlertChange(stock.ticker, e.target.value)}
                placeholder={typeof stock.price === "number" ? `@ $${fmt(stock.price, 2)}` : "Alert $"}
                inputMode="decimal"
                aria-label={`${stock.ticker} alert price`}
                title="Enter a price to receive a browser notification when crossed"
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
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value)}
            placeholder="Add ticker"
            aria-label="Add ticker to portfolio"
            onKeyDown={(e) => e.key === "Enter" && addTicker()}
          />
          <button className="ts-btn" onClick={addTicker}>Add</button>
        </div>

        {portfolioRows.length === 0 ? (
          <div className="ts-muted">Add tickers, then enter shares and average cost per share to track P/L.</div>
        ) : (
          <table className="ts-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Shares</th>
                <th>Avg Cost</th>
                <th>Value</th>
                <th>P/L</th>
                <th>Alloc%</th>
              </tr>
            </thead>
            <tbody>
              {portfolioRows.map((row) => (
                <tr key={row.ticker}>
                  <td className="ts-col-ticker">{row.ticker}</td>
                  <td>
                    <input
                      className="ts-input"
                      type="number"
                      min="0"
                      step="any"
                      value={portfolio[row.ticker]?.shares ?? ""}
                      onChange={(e) => onPortfolioField(row.ticker, "shares", e.target.value)}
                      placeholder="0"
                      aria-label={`${row.ticker} shares`}
                    />
                  </td>
                  <td>
                    <input
                      className="ts-input"
                      type="number"
                      min="0"
                      step="any"
                      value={portfolio[row.ticker]?.avgCost ?? ""}
                      onChange={(e) => onPortfolioField(row.ticker, "avgCost", e.target.value)}
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
}
