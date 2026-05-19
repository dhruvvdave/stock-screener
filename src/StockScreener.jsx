import { useState, useEffect, useCallback, useMemo, useRef } from "react";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import StatsBar from "./components/StatsBar";
import Toolbar from "./components/Toolbar";
import ResultsTable from "./components/ResultsTable";
import DetailPanel from "./components/DetailPanel";

import { useLocalStorage } from "./hooks/useLocalStorage";
import { useDebounce } from "./hooks/useDebounce";

import { STOCKS, computeSectorMedians, volRatio, momentumScore } from "./data/stocks";
import { DEFAULT_FILTERS, DEFAULT_COLUMNS, computeActiveFilterCount } from "./data/presets";

const STYLE = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body { background: #0a0a0a; color: #e8e8e8; font-family: 'IBM Plex Mono', monospace; }

  .app { min-height: 100vh; display: flex; flex-direction: column; }
  .main { display: flex; flex: 1; overflow: hidden; height: calc(100vh - 48px); }
  .content { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #0a0a0a; }
  ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
  ::-webkit-scrollbar-thumb:hover { background: #3a3a3a; }
`;

export default function StockScreener() {
  const [clock, setClock] = useState("");

  // Persisted state
  const [filters, setFilters] = useLocalStorage("mktscan_filters", DEFAULT_FILTERS);
  const [watchlist, setWatchlist] = useLocalStorage("mktscan_watchlist", []);
  const [visibleColumns, setVisibleColumns] = useLocalStorage("mktscan_cols", DEFAULT_COLUMNS);

  // Ephemeral state
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(STOCKS);
  const [searchRaw, setSearchRaw] = useState("");
  const [sortKey, setSortKey] = useState("mktCap");
  const [sortDir, setSortDir] = useState(-1);
  const [selected, setSelected] = useState(null);
  const [scanned, setScanned] = useState(false);

  const searchRef = useRef(null);
  const search = useDebounce(searchRaw, 150);

  // Precomputed once
  const sectorMedians = useMemo(() => computeSectorMedians(STOCKS), []);
  const activeFilterCount = useMemo(() => computeActiveFilterCount(filters), [filters]);

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
      if (e.key === "Escape") setSelected(null);
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Sorted + filtered results (memoized)
  const sorted = useMemo(() => {
    const q = search.toUpperCase();
    return [...results]
      .filter(s => !search || s.ticker.includes(q) || s.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const av = a[sortKey] ?? -Infinity;
        const bv = b[sortKey] ?? -Infinity;
        return (av - bv) * sortDir;
      });
  }, [results, search, sortKey, sortDir]);

  const runScan = useCallback(() => {
    setLoading(true);
    setScanned(true);
    setTimeout(() => {
      const f = filters;
      const out = STOCKS.filter(s => {
        if (!f.exchanges.includes(s.exchange)) return false;
        if (!f.sectors.includes(s.sector)) return false;
        if (f.minPrice && s.price < +f.minPrice) return false;
        if (f.maxPrice && s.price > +f.maxPrice) return false;
        if (f.minPE && (s.pe == null || s.pe < +f.minPE)) return false;
        if (f.maxPE && (s.pe == null || s.pe > +f.maxPE)) return false;
        if (f.minPB && s.pb < +f.minPB) return false;
        if (f.maxPB && s.pb > +f.maxPB) return false;
        if (f.minEPSGrowth && (s.epsGrowth == null || s.epsGrowth < +f.minEPSGrowth)) return false;
        if (f.minRevGrowth && s.revGrowth < +f.minRevGrowth) return false;
        if (f.minVolRatio && s.vol / s.avgVol < +f.minVolRatio) return false;
        if (f.minMktCap && s.mktCap < +f.minMktCap) return false;
        if (f.maxMktCap && s.mktCap > +f.maxMktCap) return false;
        return true;
      });
      setResults(out);
      setLoading(false);
    }, 900);
  }, [filters]);

  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, [setFilters]);

  const handleSort = useCallback((key) => {
    setSortKey(prev => {
      if (prev === key) setSortDir(d => -d);
      else { setSortDir(-1); }
      return key;
    });
  }, []);

  const handleColumnToggle = useCallback((col) => {
    setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
  }, [setVisibleColumns]);

  const toggleWatchlist = useCallback((ticker) => {
    setWatchlist(prev =>
      prev.includes(ticker) ? prev.filter(t => t !== ticker) : [...prev, ticker]
    );
  }, [setWatchlist]);

  const handleExport = useCallback(() => {
    const headers = ["Ticker","Name","Exchange","Sector","Price","Change%","PE","PB","EPS Gr%","Rev Gr%","Vol","Avg Vol","Mkt Cap ($B)"];
    const rows = sorted.map(s => [
      s.ticker, `"${s.name}"`, s.exchange, s.sector,
      s.price, s.change, s.pe ?? "", s.pb,
      s.epsGrowth ?? "", s.revGrowth, s.vol, s.avgVol, s.mktCap,
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mktscan_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sorted]);

  return (
    <>
      <style>{STYLE}</style>
      <div className="app">
        <Header clock={clock} watchlistCount={watchlist.length} />

        <div className="main">
          <Sidebar
            filters={filters}
            onFiltersChange={setFilters}
            onRunScan={runScan}
            onReset={handleReset}
            loading={loading}
            activeFilterCount={activeFilterCount}
          />

          <div className="content">
            <StatsBar
              results={results}
              totalCount={STOCKS.length}
              visible={scanned}
            />

            <Toolbar
              ref={searchRef}
              resultCount={sorted.length}
              searchValue={searchRaw}
              onSearchChange={setSearchRaw}
              sortKey={sortKey}
              onSortChange={(key) => { setSortKey(key); setSortDir(-1); }}
              visibleColumns={visibleColumns}
              onColumnToggle={handleColumnToggle}
              onExport={handleExport}
            />

            <ResultsTable
              rows={sorted}
              loading={loading}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              onRowClick={setSelected}
              onStarClick={toggleWatchlist}
              watchlist={watchlist}
              visibleColumns={visibleColumns}
              sectorMedians={sectorMedians}
            />
          </div>
        </div>
      </div>

      <DetailPanel
        stock={selected}
        onClose={() => setSelected(null)}
        watchlist={watchlist}
        onStarClick={toggleWatchlist}
        volRatio={volRatio}
        momentumScore={momentumScore}
        sectorMedians={sectorMedians}
      />
    </>
  );
}
