import { useState, useEffect, useCallback, useMemo, useRef } from "react";

import Header      from "./components/Header";
import Sidebar     from "./components/Sidebar";
import StatsBar    from "./components/StatsBar";
import Toolbar     from "./components/Toolbar";
import ResultsTable from "./components/ResultsTable";
import DetailPanel  from "./components/DetailPanel";

import { useLocalStorage } from "./hooks/useLocalStorage";
import { useDebounce }     from "./hooks/useDebounce";

import { STOCKS, computeSectorMedians, volRatio, momentumScore } from "./data/stocks";
import { DEFAULT_FILTERS, DEFAULT_COLUMNS, computeActiveFilterCount } from "./data/presets";

const STYLE = `
  .app  { min-height: 100vh; display: flex; flex-direction: column; }
  .main { display: flex; flex: 1; overflow: hidden; height: calc(100vh - 44px); }
  .content { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
`;

export default function StockScreener() {
  const [clock, setClock] = useState("");

  const [filters,        setFilters]        = useLocalStorage("mktscan_filters", DEFAULT_FILTERS);
  const [watchlist,      setWatchlist]       = useLocalStorage("mktscan_watchlist", []);
  const [visibleColumns, setVisibleColumns]  = useLocalStorage("mktscan_cols", DEFAULT_COLUMNS);

  const [loading,   setLoading]   = useState(false);
  const [results,   setResults]   = useState(STOCKS);
  const [searchRaw, setSearchRaw] = useState("");
  const [sortKey,   setSortKey]   = useState("mktCap");
  const [sortDir,   setSortDir]   = useState(-1);
  const [selected,  setSelected]  = useState(null);
  const [scanned,   setScanned]   = useState(false);

  const searchRef = useRef(null);
  const search = useDebounce(searchRaw, 150);

  const sectorMedians    = useMemo(() => computeSectorMedians(STOCKS), []);
  const activeFilterCount = useMemo(() => computeActiveFilterCount(filters), [filters]);

  const sorted = useMemo(() => {
    const q = search.toUpperCase();
    return [...results]
      .filter(s => !search || s.ticker.includes(q) || s.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => ((a[sortKey] ?? -Infinity) - (b[sortKey] ?? -Infinity)) * sortDir);
  }, [results, search, sortKey, sortDir]);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") setSelected(null);
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const runScan = useCallback(() => {
    setLoading(true);
    setScanned(true);
    setTimeout(() => {
      const f = filters;
      const out = STOCKS.filter(s => {
        if (!f.exchanges.includes(s.exchange)) return false;
        if (!f.sectors.includes(s.sector))    return false;
        if (f.minPrice    && s.price    < +f.minPrice)                        return false;
        if (f.maxPrice    && s.price    > +f.maxPrice)                        return false;
        if (f.minPE       && (s.pe == null || s.pe < +f.minPE))              return false;
        if (f.maxPE       && (s.pe == null || s.pe > +f.maxPE))              return false;
        if (f.minPB       && s.pb       < +f.minPB)                          return false;
        if (f.maxPB       && s.pb       > +f.maxPB)                          return false;
        if (f.minEPSGrowth && (s.epsGrowth == null || s.epsGrowth < +f.minEPSGrowth)) return false;
        if (f.minRevGrowth && s.revGrowth < +f.minRevGrowth)                 return false;
        if (f.minVolRatio  && s.vol / s.avgVol < +f.minVolRatio)             return false;
        if (f.minMktCap    && s.mktCap  < +f.minMktCap)                      return false;
        if (f.maxMktCap    && s.mktCap  > +f.maxMktCap)                      return false;
        return true;
      });
      setResults(out);
      setLoading(false);
    }, 900);
  }, [filters]);

  const handleSort = useCallback((key) => {
    setSortKey(prev => { if (prev === key) setSortDir(d => -d); else setSortDir(-1); return key; });
  }, []);

  const handleExport = useCallback(() => {
    const headers = ["Ticker","Name","Exchange","Sector","Price","Change%","PE","PB","EPS Gr%","Rev Gr%","Vol","Avg Vol","Mkt Cap ($B)"];
    const rows = sorted.map(s => [s.ticker, `"${s.name}"`, s.exchange, s.sector, s.price, s.change, s.pe ?? "", s.pb, s.epsGrowth ?? "", s.revGrowth, s.vol, s.avgVol, s.mktCap]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: `mktscan_${Date.now()}.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
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
            onReset={() => setFilters(DEFAULT_FILTERS)}
            loading={loading}
            activeFilterCount={activeFilterCount}
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
              onStarClick={t => setWatchlist(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])}
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
        onStarClick={t => setWatchlist(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])}
        volRatio={volRatio}
        momentumScore={momentumScore}
        sectorMedians={sectorMedians}
      />
    </>
  );
}
