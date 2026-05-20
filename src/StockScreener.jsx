import { useState, useEffect, useCallback, useMemo } from "react";

import Header      from "./components/Header";
import StockList   from "./components/StockList";
import StockDetail from "./components/StockDetail";

import { useLocalStorage } from "./hooks/useLocalStorage";

import { STOCKS, computeSectorMedians } from "./data/stocks";
import {
  fetchExchangeRate, fetchAllQuotes, fetchCandleData,
  fetchAnalystData, fetchNewsSentiment,
} from "./data/api";

const STYLE = `
  .app  { min-height: 100svh; display: flex; flex-direction: column; }
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
`;

export default function StockScreener() {
  const [clock, setClock] = useState("");

  // Persisted preferences
  const [watchlist, setWatchlist] = useLocalStorage("mktscan_watchlist", []);
  const [currency,  setCurrency]  = useLocalStorage("mktscan_currency",  "USD");

  // Live data
  const [usdToCad,      setUsdToCad]      = useState(1.36);
  const [liveQuotes,    setLiveQuotes]    = useState({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesLive,    setQuotesLive]    = useState(false);
  const [candleCache,   setCandleCache]   = useState({});
  const [suppCache,     setSuppCache]     = useState({});

  // UI state
  const [selected, setSelected] = useState(null);

  const stocksWithLive = useMemo(() => STOCKS.map(s => ({
    ...s,
    ...(liveQuotes[s.ticker] ?? {}),
  })), [liveQuotes]);

  const sectorMedians = useMemo(() => computeSectorMedians(STOCKS), []);

  // Clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Escape to go back
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape" && selected) setSelected(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [selected]);

  // Exchange rate
  useEffect(() => {
    fetchExchangeRate().then(setUsdToCad);
  }, []);

  // Live quotes
  useEffect(() => {
    setQuotesLoading(true);
    fetchAllQuotes(STOCKS.map(s => s.ticker))
      .then(map => {
        const obj = {};
        map.forEach((v, k) => { obj[k] = v; });
        setLiveQuotes(obj);
        setQuotesLive(map.size > 0);
      })
      .catch(() => setQuotesLive(false))
      .finally(() => setQuotesLoading(false));
  }, []);

  // Lazy candle + supplementary when detail opens
  useEffect(() => {
    if (!selected) return;
    const t = selected.ticker;
    if (candleCache[t] === undefined) {
      setCandleCache(c => ({ ...c, [t]: null }));
      fetchCandleData(t).then(data => setCandleCache(c => ({ ...c, [t]: data })));
    }
    if (!suppCache[t]) {
      Promise.all([fetchAnalystData(t), fetchNewsSentiment(t)]).then(([analyst, sentiment]) => {
        setSuppCache(c => ({ ...c, [t]: { analyst, sentiment } }));
      });
    }
  }, [selected?.ticker]); // eslint-disable-line

  const handleStarClick = useCallback((t) => {
    setWatchlist(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  }, [setWatchlist]);

  const handleSelect = useCallback((stock) => {
    const live = stocksWithLive.find(s => s.ticker === stock.ticker) ?? stock;
    setSelected(live);
  }, [stocksWithLive]);

  return (
    <>
      <style>{STYLE}</style>
      <div className="app">
        <Header
          clock={clock}
          watchlistCount={watchlist.length}
          currency={currency}
          onCurrencyToggle={setCurrency}
          quotesLoading={quotesLoading}
          quotesLive={quotesLive}
        />
        <div className="main">
          {selected ? (
            <StockDetail
              stock={selected}
              onBack={() => setSelected(null)}
              watchlist={watchlist}
              onStarClick={handleStarClick}
              currency={currency}
              usdToCadRate={usdToCad}
              candleData={candleCache[selected.ticker] ?? null}
              supplementary={suppCache[selected.ticker] ?? null}
              sectorMedians={sectorMedians}
            />
          ) : (
            <StockList
              stocks={stocksWithLive}
              watchlist={watchlist}
              onStarClick={handleStarClick}
              onSelect={handleSelect}
              currency={currency}
              onCurrencyToggle={setCurrency}
              usdToCadRate={usdToCad}
              quotesLoading={quotesLoading}
              quotesLive={quotesLive}
              clock={clock}
            />
          )}
        </div>
      </div>
    </>
  );
}
