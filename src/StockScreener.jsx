import { useState, useEffect, useCallback, useMemo } from "react";

import Header      from "./components/Header";
import StockList   from "./components/StockList";
import StockDetail from "./components/StockDetail";

import { useLocalStorage } from "./hooks/useLocalStorage";

import { STOCKS } from "./data/stocks";
import {
  fetchExchangeRate, fetchAllQuotes, fetchSupplementaryQuotes,
  fetchCandleData, fetchAnalystData, fetchNewsSentiment,
} from "./data/api";

const STYLE = `
  .app  { min-height: 100svh; display: flex; flex-direction: column; }
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
`;

export default function StockScreener() {
  const [clock, setClock] = useState("");

  // Persisted preferences
  const [watchlist,     setWatchlist]     = useLocalStorage("mktscan_watchlist", []);
  const [currency,      setCurrency]      = useLocalStorage("mktscan_currency",  "USD");
  const [dynamicStocks, setDynamicStocks] = useLocalStorage("mktscan_dynamic",   []);

  // Live data
  const [usdToCad,      setUsdToCad]      = useState(1.36);
  const [liveQuotes,    setLiveQuotes]    = useState({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesLive,    setQuotesLive]    = useState(false);
  const [candleCache,   setCandleCache]   = useState({});
  const [suppCache,     setSuppCache]     = useState({});

  // UI state
  const [selected, setSelected] = useState(null);

  const allStocks = useMemo(() => [...STOCKS, ...dynamicStocks], [dynamicStocks]);

  const stocksWithLive = useMemo(() => allStocks.map(s => ({
    ...s,
    ...(liveQuotes[s.ticker] ?? {}),
  })), [allStocks, liveQuotes]);

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

  // Live quotes — Finnhub prices + Yahoo supplementary data
  useEffect(() => {
    setQuotesLoading(true);

    Promise.all([
      fetchAllQuotes(allStocks),
      fetchSupplementaryQuotes(allStocks),
    ])
      .then(([quotesMap, suppData]) => {
        const obj = {};
        // Supplementary data (Yahoo) as base — includes pe, pb, beta, vol, mktCap, etc.
        for (const [t, v] of Object.entries(suppData)) obj[t] = { ...v };
        // Finnhub price/change wins (more real-time)
        quotesMap.forEach((v, k) => { obj[k] = { ...(obj[k] ?? {}), ...v }; });
        setLiveQuotes(obj);
        setQuotesLive(quotesMap.size > 0);
      })
      .catch(() => setQuotesLive(false))
      .finally(() => setQuotesLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy candle + supplementary when detail opens
  useEffect(() => {
    if (!selected) return;
    const t = selected.ticker;
    if (candleCache[t] === undefined) {
      setCandleCache(c => ({ ...c, [t]: null }));
      fetchCandleData(t, selected.exchange, "1y")
        .then(data => setCandleCache(c => ({ ...c, [t]: data })));
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

  // Add a dynamically searched stock to the list and immediately fetch its data
  const handleAddStock = useCallback((result) => {
    const newStock = {
      ticker:   result.symbol,
      name:     result.name,
      exchange: result.exchange,
      sector:   "—",
    };

    setDynamicStocks(prev => {
      if (prev.some(s => s.ticker === newStock.ticker)) return prev;
      return [...prev, newStock];
    });

    // Fetch quotes for the new stock immediately
    Promise.all([
      fetchAllQuotes([newStock]),
      fetchSupplementaryQuotes([newStock]),
    ]).then(([quotesMap, suppData]) => {
      setLiveQuotes(prev => {
        const merged = { ...prev };
        for (const [t, v] of Object.entries(suppData)) merged[t] = { ...(merged[t] ?? {}), ...v };
        quotesMap.forEach((v, k) => { merged[k] = { ...(merged[k] ?? {}), ...v }; });
        return merged;
      });
    });

    setSelected(newStock);
  }, [setDynamicStocks]);

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
            />
          ) : (
            <StockList
              stocks={stocksWithLive}
              watchlist={watchlist}
              onStarClick={handleStarClick}
              onSelect={handleSelect}
              onAddStock={handleAddStock}
              currency={currency}
              usdToCadRate={usdToCad}
              quotesLoading={quotesLoading}
              quotesLive={quotesLive}
            />
          )}
        </div>
      </div>
    </>
  );
}
