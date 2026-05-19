import { useState, useEffect, useCallback, useMemo, useRef } from "react";

import Header        from "./components/Header";
import Sidebar       from "./components/Sidebar";
import StatsBar      from "./components/StatsBar";
import Toolbar       from "./components/Toolbar";
import ResultsTable  from "./components/ResultsTable";
import DetailPanel   from "./components/DetailPanel";
import SettingsModal from "./components/SettingsModal";

import { useLocalStorage } from "./hooks/useLocalStorage";
import { useDebounce }     from "./hooks/useDebounce";

import { STOCKS, computeSectorMedians, volRatio, momentumScore } from "./data/stocks";
import { DEFAULT_FILTERS, DEFAULT_COLUMNS, computeActiveFilterCount } from "./data/presets";
import {
  fetchExchangeRate, fetchAllQuotes, fetchCandleData,
  fetchAnalystData, fetchNewsSentiment, filterBoundToNative,
} from "./data/api";

const STYLE = `
  .app     { min-height: 100svh; display: flex; flex-direction: column; }
  .main    { display: flex; flex: 1; overflow: hidden; height: calc(100svh - var(--header-h)); }
  .content { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
`;

export default function StockScreener() {
  const [clock, setClock]             = useState("");
  const [filtersOpen,  setFiltersOpen]  = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Persisted preferences
  const [filters,        setFilters]        = useLocalStorage("mktscan_filters",   DEFAULT_FILTERS);
  const [watchlist,      setWatchlist]       = useLocalStorage("mktscan_watchlist", []);
  const [visibleColumns, setVisibleColumns]  = useLocalStorage("mktscan_cols",      DEFAULT_COLUMNS);
  const [currency,       setCurrency]        = useLocalStorage("mktscan_currency",  "USD");
  const [finnhubKey,     setFinnhubKey]      = useLocalStorage("mktscan_finnhub_key", "");
  const [claudeKey,      setClaudeKey]       = useLocalStorage("mktscan_claude_key",  "");

  // Live data
  const [usdToCad,       setUsdToCad]      = useState(1.36);
  const [liveQuotes,     setLiveQuotes]    = useState({});
  const [quotesLoading,  setQuotesLoading] = useState(false);
  const [candleCache,    setCandleCache]   = useState({});   // { [ticker]: number[] | null }
  const [suppCache,      setSuppCache]     = useState({});   // { [ticker]: { analyst, sentiment } }

  // Scan / UI state
  const [loading,   setLoading]   = useState(false);
  const [results,   setResults]   = useState(STOCKS);
  const [searchRaw, setSearchRaw] = useState("");
  const [sortKey,   setSortKey]   = useState("mktCap");
  const [sortDir,   setSortDir]   = useState(-1);
  const [selected,  setSelected]  = useState(null);
  const [scanned,   setScanned]   = useState(false);

  const searchRef = useRef(null);
  const search    = useDebounce(searchRaw, 150);

  // Merge live quotes into STOCKS fallback
  const stocksWithLive = useMemo(() => STOCKS.map(s => ({
    ...s,
    ...(liveQuotes[s.ticker] ?? {}),
  })), [liveQuotes]);

  const sectorMedians     = useMemo(() => computeSectorMedians(STOCKS), []);
  const activeFilterCount = useMemo(() => computeActiveFilterCount(filters), [filters]);

  const sorted = useMemo(() => {
    const q = search.toUpperCase();
    return [...results]
      .filter(s => !search || s.ticker.includes(q) || s.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => ((a[sortKey] ?? -Infinity) - (b[sortKey] ?? -Infinity)) * sortDir);
  }, [results, search, sortKey, sortDir]);

  // Clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") { setSelected(null); setFiltersOpen(false); setSettingsOpen(false); }
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Fetch exchange rate on mount
  useEffect(() => {
    fetchExchangeRate().then(setUsdToCad);
  }, []);

  // Fetch live quotes when Finnhub key is set
  useEffect(() => {
    if (!finnhubKey) return;
    setQuotesLoading(true);
    const tickers = STOCKS.map(s => s.ticker);
    fetchAllQuotes(tickers, finnhubKey)
      .then(map => {
        const obj = {};
        map.forEach((v, k) => { obj[k] = v; });
        setLiveQuotes(obj);
      })
      .finally(() => setQuotesLoading(false));
  }, [finnhubKey]);

  // Lazy-fetch candle + supplementary data when detail panel opens
  useEffect(() => {
    if (!selected || !finnhubKey) return;
    const ticker = selected.ticker;

    if (candleCache[ticker] === undefined) {
      setCandleCache(c => ({ ...c, [ticker]: null }));   // mark as fetching
      fetchCandleData(ticker, finnhubKey).then(data => {
        setCandleCache(c => ({ ...c, [ticker]: data }));
      });
    }

    if (!suppCache[ticker]) {
      Promise.all([
        fetchAnalystData(ticker, finnhubKey),
        fetchNewsSentiment(ticker, finnhubKey),
      ]).then(([analyst, sentiment]) => {
        setSuppCache(c => ({ ...c, [ticker]: { analyst, sentiment } }));
      });
    }
  }, [selected?.ticker, finnhubKey]);  // eslint-disable-line

  const runScan = useCallback(() => {
    setLoading(true);
    setScanned(true);
    setFiltersOpen(false);
    setTimeout(() => {
      const f = filters;
      const out = stocksWithLive.filter(s => {
        if (!f.exchanges.includes(s.exchange)) return false;
        if (!f.sectors.includes(s.sector))    return false;
        // Convert filter bounds from display currency to the stock's native currency
        const toNative = (v) => filterBoundToNative(v, s.exchange, currency, usdToCad);
        if (f.minPrice     && s.price    < toNative(f.minPrice))                             return false;
        if (f.maxPrice     && s.price    > toNative(f.maxPrice))                             return false;
        if (f.minPE        && (s.pe == null || s.pe < +f.minPE))                            return false;
        if (f.maxPE        && (s.pe == null || s.pe > +f.maxPE))                            return false;
        if (f.minPB        && s.pb       < +f.minPB)                                        return false;
        if (f.maxPB        && s.pb       > +f.maxPB)                                        return false;
        if (f.minEPSGrowth && (s.epsGrowth == null || s.epsGrowth < +f.minEPSGrowth))      return false;
        if (f.minRevGrowth && s.revGrowth < +f.minRevGrowth)                                return false;
        if (f.minVolRatio  && s.vol / s.avgVol < +f.minVolRatio)                            return false;
        if (f.minMktCap    && s.mktCap   < +f.minMktCap)                                    return false;
        if (f.maxMktCap    && s.mktCap   > +f.maxMktCap)                                    return false;
        return true;
      });
      setResults(out);
      setLoading(false);
    }, 900);
  }, [filters, stocksWithLive, currency, usdToCad]);

  const handleSort = useCallback((key) => {
    setSortKey(prev => { if (prev === key) setSortDir(d => -d); else setSortDir(-1); return key; });
  }, []);

  const handleExport = useCallback(() => {
    const ccy = currency;
    const headers = ["Ticker","Name","Exchange","Sector",`Price (${ccy})`,"Change%","PE","PB","EPS Gr%","Rev Gr%","Vol","Avg Vol","Mkt Cap ($B)"];
    const rows = sorted.map(s => {
      const { price: dp } = { price: s.price };  // native price in CSV
      return [s.ticker, `"${s.name}"`, s.exchange, s.sector, dp, s.change, s.pe ?? "", s.pb, s.epsGrowth ?? "", s.revGrowth, s.vol, s.avgVol, s.mktCap];
    });
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: `mktscan_${Date.now()}.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  }, [sorted, currency]);

  const handleSaveSettings = useCallback(({ finnhub, claude }) => {
    setFinnhubKey(finnhub);
    setClaudeKey(claude);
    // Clear caches so data is re-fetched with the new key
    setLiveQuotes({});
    setCandleCache({});
    setSuppCache({});
  }, [setFinnhubKey, setClaudeKey]);

  const handleStarClick = useCallback((t) => {
    setWatchlist(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  }, [setWatchlist]);

  return (
    <>
      <style>{STYLE}</style>
      <div className="app">
        <Header
          clock={clock}
          watchlistCount={watchlist.length}
          currency={currency}
          onCurrencyToggle={setCurrency}
          onSettingsOpen={() => setSettingsOpen(true)}
          onFiltersOpen={() => setFiltersOpen(true)}
          activeFilterCount={activeFilterCount}
          quotesLoading={quotesLoading}
        />

        <div className="main">
          <Sidebar
            filters={filters}
            onFiltersChange={setFilters}
            onRunScan={runScan}
            onReset={() => setFilters(DEFAULT_FILTERS)}
            loading={loading}
            activeFilterCount={activeFilterCount}
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
          />

          <div className="content">
            <StatsBar results={results} totalCount={STOCKS.length} visible={scanned} />

            <Toolbar
              ref={searchRef}
              resultCount={sorted.length}
              searchValue={searchRaw}
              onSearchChange={setSearchRaw}
              sortKey={sortKey}
              onSortChange={key => { setSortKey(key); setSortDir(-1); }}
              visibleColumns={visibleColumns}
              onColumnToggle={col => setVisibleColumns(p => ({ ...p, [col]: !p[col] }))}
              onExport={handleExport}
            />

            <ResultsTable
              rows={sorted}
              loading={loading}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              onRowClick={setSelected}
              onStarClick={handleStarClick}
              watchlist={watchlist}
              visibleColumns={visibleColumns}
              sectorMedians={sectorMedians}
              currency={currency}
              usdToCadRate={usdToCad}
            />
          </div>
        </div>
      </div>

      <DetailPanel
        stock={selected}
        onClose={() => setSelected(null)}
        watchlist={watchlist}
        onStarClick={handleStarClick}
        volRatio={volRatio}
        momentumScore={momentumScore}
        sectorMedians={sectorMedians}
        currency={currency}
        usdToCadRate={usdToCad}
        candleData={selected ? (candleCache[selected.ticker] ?? null) : null}
        supplementary={selected ? (suppCache[selected.ticker] ?? null) : null}
        claudeKey={claudeKey}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        finnhubKey={finnhubKey}
        claudeKey={claudeKey}
        onSave={handleSaveSettings}
      />
    </>
  );
}
