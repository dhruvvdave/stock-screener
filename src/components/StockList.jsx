import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { fmt, fmtLarge } from "../data/stocks";
import { convertPrice, fetchSearchResults } from "../data/api";
import { useDebounce } from "../hooks/useDebounce";

const MAX_LOCAL_SUGGESTIONS = 4;
const MAX_REMOTE_SUGGESTIONS = 8;

function MarkrLogo() {
  return (
    <svg className="sl-logo" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="1.5" y="1.5" width="21" height="21" rx="5" stroke="var(--border-2)" />
      <path d="M5 15.5L9.2 11.4L12.6 13.9L18.5 8.1" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18.5" cy="8.1" r="1.2" fill="var(--accent)" />
    </svg>
  );
}

function SkeletonList() {
  return Array.from({ length: 14 }, (_, i) => (
    <div key={i} className="sl-skel-row">
      <div style={{ display: "flex", gap: 12, flex: 1, alignItems: "center" }}>
        <div className="sl-skel-bar" style={{ width: 44, animationDelay: `${i * 35}ms` }} />
        <div className="sl-skel-bar" style={{ width: 90 + (i % 4) * 30, animationDelay: `${i * 35 + 15}ms` }} />
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        <div className="sl-skel-bar" style={{ width: 58, animationDelay: `${i * 35 + 30}ms` }} />
        <div className="sl-skel-bar" style={{ width: 44, animationDelay: `${i * 35 + 45}ms` }} />
      </div>
    </div>
  ));
}

function sortArrow(sort, key) {
  if (sort.key !== key) return "";
  return sort.direction === "asc" ? " ↑" : " ↓";
}

function highlightMatch(text, query) {
  if (!text || !query?.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (idx < 0) return text;
  const len = query.trim().length;
  return (
    <>
      {text.slice(0, idx)}
      <strong>{text.slice(idx, idx + len)}</strong>
      {text.slice(idx + len)}
    </>
  );
}

export default function StockList({
  stocks,
  watchlist,
  onStarClick,
  onSelect,
  onAddStock,
  currency,
  usdToCadRate,
  quotesLoading,
  quotesLive,
  quotesInitialized,
  activeTicker,
  sort,
  onSortChange,
  rightRail,
  minimalSplash = false,
}) {
  const [search, setSearch] = useState("");
  const [remoteSuggestions, setRemoteSuggestions] = useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const inputRef = useRef(null);
  const pillRef = useRef(null);

  const debouncedSearch = useDebounce(search, 260);

  useEffect(() => {
    const h = (e) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    const h = (e) => {
      if (pillRef.current && !pillRef.current.contains(e.target)) {
        setSuggestionsOpen(false);
        setSuggestionIndex(-1);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const q = search.trim().toUpperCase();
  const localFiltered = q
    ? stocks.filter((s) => s.ticker.includes(q) || s.name.toLowerCase().includes(search.trim().toLowerCase()))
    : stocks;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const query = debouncedSearch.trim();
      if (query.length < 1) {
        setRemoteSuggestions([]);
        setSuggestionsOpen(false);
        setSuggestionIndex(-1);
        return;
      }

      const results = await fetchSearchResults(query);
      if (cancelled) return;
      const localTickers = new Set(stocks.map((s) => s.ticker));
      setRemoteSuggestions(results.filter((r) => !localTickers.has(r.symbol)).slice(0, MAX_REMOTE_SUGGESTIONS));
      setSuggestionsOpen(true);
      setSuggestionIndex(-1);
    };

    run();
    return () => { cancelled = true; };
  }, [debouncedSearch, stocks]);

  const suggestions = useMemo(() => {
    if (!search.trim()) return [];
    const locals = stocks
      .filter((s) => s.ticker.includes(q) || s.name.toLowerCase().includes(search.trim().toLowerCase()))
      .slice(0, MAX_LOCAL_SUGGESTIONS)
      .map((s) => ({ symbol: s.ticker, name: s.name, exchange: s.exchange, local: true }));

    const seen = new Set(locals.map((s) => s.symbol));
    const remotes = remoteSuggestions.filter((s) => !seen.has(s.symbol)).slice(0, 6);
    return [...locals, ...remotes];
  }, [q, remoteSuggestions, search, stocks]);

  const selectSuggestion = useCallback((result) => {
    onAddStock(result, { select: true });
    setSearch("");
    setRemoteSuggestions([]);
    setSuggestionsOpen(false);
    setSuggestionIndex(-1);
  }, [onAddStock]);

  const addTypedTicker = useCallback(() => {
    const symbol = search.trim().toUpperCase();
    if (!symbol) return;
    onAddStock({ symbol, name: symbol, exchange: "US" }, { select: true });
    setSearch("");
    setSuggestionsOpen(false);
    setSuggestionIndex(-1);
  }, [onAddStock, search]);

  const handleInputKeyDown = useCallback((e) => {
    if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      setSuggestionsOpen(true);
      setSuggestionIndex((i) => (i + 1) % suggestions.length);
      return;
    }

    if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault();
      setSuggestionsOpen(true);
      setSuggestionIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
      return;
    }

    if (e.key === "Escape") {
      setSuggestionsOpen(false);
      setSuggestionIndex(-1);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestionsOpen && suggestionIndex >= 0 && suggestions[suggestionIndex]) {
        selectSuggestion(suggestions[suggestionIndex]);
      } else {
        addTypedTicker();
      }
    }
  }, [addTypedTicker, selectSuggestion, suggestionIndex, suggestions, suggestionsOpen]);

  const renderSortHeader = (label, key, cls = "") => (
    <button
      className={`sl-sort-btn ${sort.key === key ? "on" : ""} ${cls}`}
      onClick={() => onSortChange(key)}
      aria-label={`Sort by ${label}${sort.key === key ? `, currently ${sort.direction}ending` : ""}`}
    >
      {label}{sortArrow(sort, key)}
    </button>
  );

  const showSkeleton = quotesLoading && !quotesInitialized;
  const showRefreshDot = quotesLoading && quotesInitialized;

  return (
    <div className={`sl-page ${minimalSplash ? "minimal" : ""}`}>
      <div className="sl-container">
        <div className="sl-hero">
          <div className="sl-brand-wrap">
            <MarkrLogo />
            {!minimalSplash && <div className="sl-brand">Markr</div>}
          </div>
          <h1 className="sl-title">
            {minimalSplash ? "Markr" : <>Any ticker, instantly<span className="sl-cursor">_</span></>}
          </h1>
          <div className="sl-pill-wrap" ref={pillRef}>
            <div className="sl-pill">
              <span className="sl-pill-icon">/</span>
              <input
                ref={inputRef}
                className="sl-pill-input"
                type="text"
                placeholder="Ticker or company name…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSuggestionsOpen(!!e.target.value.trim()); }}
                onFocus={() => search.trim() && setSuggestionsOpen(true)}
                onKeyDown={handleInputKeyDown}
                autoComplete="off"
                spellCheck="false"
              />
              {search && (
                <button className="sl-pill-clear" onClick={() => { setSearch(""); setSuggestionsOpen(false); }}>
                  ✕
                </button>
              )}
            </div>

            {suggestionsOpen && suggestions.length > 0 && (
              <div className="sl-autofill">
                {suggestions.map((item, idx) => (
                  <button
                    key={`${item.symbol}-${item.exchange}-${idx}`}
                    className={`sl-autofill-item ${idx === suggestionIndex ? "on" : ""}`}
                    onMouseEnter={() => setSuggestionIndex(idx)}
                    onClick={() => selectSuggestion(item)}
                  >
                    <span style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                      <span className="sl-autofill-symbol">{highlightMatch(item.symbol, search)}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {highlightMatch(item.name, search)}
                      </span>
                    </span>
                    <span className="sl-autofill-exch">{item.exchange}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {!minimalSplash && (
            <div className="sl-hint">
              {showSkeleton
                ? "Loading live prices…"
                : showRefreshDot
                  ? <span className="sl-hint-refresh"><span className="sl-hint-dot" />Refreshing…</span>
                  : `${stocks.length} stocks${quotesLive ? " · live prices" : ""} · j/k navigate · Enter open · s star`
              }
            </div>
          )}
        </div>

        {!minimalSplash && (
          <div className={`sl-content ${rightRail ? "with-rail" : ""}`}>
            <div className="sl-main">
              <div className="sl-head">
                {renderSortHeader("Ticker", "ticker", "left")}
                {renderSortHeader("Price", "price")}
                {renderSortHeader("Change", "change")}
                <div className="sl-sort-cap">{renderSortHeader("Mkt Cap", "mktCap")}</div>
                <div />
              </div>

              <div className="sl-list">
                {showSkeleton ? (
                  <SkeletonList />
                ) : stocks.length === 0 ? (
                  <div className="sl-empty">
                    Search a ticker to get started
                    <div className="sl-empty-hint">try AAPL · SHOP · NVDA · GSI.V</div>
                  </div>
                ) : localFiltered.length === 0 ? (
                  <div className="sl-empty">No results for "{search}"</div>
                ) : (
                  localFiltered.map((s) => {
                    const { price: disp, converted } = convertPrice(s.price, s.exchange, currency, usdToCadRate);
                    const dec = disp != null && disp < 10 ? 3 : 2;
                    const hasPrice = typeof disp === "number";
                    const hasChg = typeof s.change === "number";
                    const priceStr = hasPrice ? `${converted ? "~$" : "$"}${fmt(disp, dec)}` : "—";
                    const chgPos = hasChg && s.change >= 0;
                    const starred = watchlist.includes(s.ticker);

                    return (
                      <div
                        key={s.ticker}
                        className={`sl-row ${activeTicker === s.ticker ? "active" : ""}`}
                        onClick={() => onSelect(s)}
                      >
                        <div className="sl-row-left">
                          <span className="sl-ticker">{s.ticker}</span>
                          <span className="sl-name">{s.name}</span>
                          <span className="sl-exch">{s.exchange}</span>
                        </div>
                        <div className="sl-row-right">
                          <span className="sl-price">{priceStr}</span>
                          <span className={`sl-chg ${hasChg ? (chgPos ? "pos" : "neg") : "neu"}`}>
                            {hasChg ? `${chgPos ? "+" : ""}${fmt(s.change)}%` : "—"}
                          </span>
                          <span className="sl-cap">{fmtLarge(s.mktCap)}</span>
                          <button
                            className={`sl-star ${starred ? "on" : "off"}`}
                            onClick={(e) => { e.stopPropagation(); onStarClick(s.ticker); }}
                            aria-label={`${starred ? "Remove" : "Add"} ${s.ticker} ${starred ? "from" : "to"} watchlist`}
                          >
                            {starred ? "★" : "☆"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {rightRail && <aside className="sl-rail">{rightRail}</aside>}
          </div>
        )}
      </div>
    </div>
  );
}
