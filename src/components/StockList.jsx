import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { fmt, fmtLarge } from "../data/stocks";
import { convertPrice, fetchSearchResults } from "../data/api";
import { useDebounce } from "../hooks/useDebounce";

const STYLE = `
  .sl-page {
    min-height: calc(100svh - 48px);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
  .sl-page.minimal .sl-container {
    max-width: 680px;
    min-height: 100svh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .sl-page.minimal .sl-hero {
    width: 100%;
    padding: 0;
    text-align: center;
  }
  .sl-page.minimal .sl-brand-wrap {
    justify-content: center;
  }
  .sl-page.minimal .sl-pill-wrap {
    margin: 0 auto;
  }
  .sl-page.minimal .sl-title {
    margin-bottom: 18px;
  }

  .sl-container {
    max-width: 1120px;
    margin: 0 auto;
    padding: 0 24px 80px;
    width: 100%;
  }

  .sl-hero {
    position: relative;
    padding: 66px 0 32px;
    text-align: left;
  }
  .sl-hero::before {
    content: '';
    position: fixed;
    top: -100px;
    left: 50%;
    transform: translateX(-50%);
    width: 860px;
    height: 620px;
    border-radius: 50%;
    background: radial-gradient(ellipse at center, rgba(255,255,255,0.04) 0%, transparent 65%);
    pointer-events: none;
    z-index: 0;
  }

  .sl-brand-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    position: relative;
    z-index: 1;
  }
  .sl-brand {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    color: var(--accent);
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }
  .sl-logo {
    width: 18px;
    height: 18px;
    display: block;
    opacity: 0.92;
  }

  .sl-title {
    font-family: var(--font-ui);
    font-size: clamp(36px, 6vw, 56px);
    font-weight: 700;
    color: var(--text-1);
    line-height: 1.08;
    letter-spacing: -0.025em;
    margin-bottom: 22px;
    position: relative;
    z-index: 1;
  }

  .sl-cursor {
    color: var(--text-3);
    animation: sl-blink 1s step-end infinite;
  }
  @keyframes sl-blink { 0%,100%{opacity:1} 50%{opacity:0} }

  .sl-pill-wrap {
    position: relative;
    max-width: 540px;
    width: 100%;
    z-index: 5;
  }
  .sl-pill {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    background: rgba(255,255,255,0.045);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 100px;
    height: 52px;
    padding: 0 8px 0 20px;
    transition: border-color 0.2s;
  }
  .sl-pill:focus-within {
    border-color: rgba(255,255,255,0.18);
  }
  .sl-pill-icon {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--text-3);
    user-select: none;
    flex-shrink: 0;
  }
  .sl-pill-input {
    flex: 1;
    background: none;
    border: none;
    color: var(--text-1);
    font-family: var(--font-ui);
    font-size: 15px;
    outline: none;
  }
  .sl-pill-input::placeholder { color: var(--text-3); }
  .sl-pill-clear {
    background: none;
    border: none;
    color: var(--text-3);
    font-size: 14px;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 100px;
    line-height: 1;
    transition: color 0.1s;
    flex-shrink: 0;
  }
  .sl-pill-clear:hover { color: var(--text-1); }

  .sl-autofill {
    margin-top: 8px;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: rgba(15, 15, 15, 0.96);
    backdrop-filter: blur(10px);
    overflow: hidden;
  }
  .sl-autofill-item {
    width: 100%;
    text-align: left;
    border: none;
    background: transparent;
    color: var(--text-2);
    padding: 9px 11px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    border-bottom: 1px solid var(--border);
    font-family: var(--font-ui);
    font-size: 12px;
  }
  .sl-autofill-item:last-child { border-bottom: none; }
  .sl-autofill-item.on,
  .sl-autofill-item:hover { background: rgba(255,255,255,0.03); color: var(--text-1); }
  .sl-autofill-symbol {
    font-family: var(--font-mono);
    color: var(--accent);
    font-size: 11px;
    margin-right: 12px;
    min-width: 64px;
    flex-shrink: 0;
  }
  .sl-autofill-exch {
    color: var(--text-3);
    font-family: var(--font-mono);
    font-size: 10px;
    margin-left: 10px;
    flex-shrink: 0;
  }

  .sl-hint {
    margin-top: 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    letter-spacing: 0.02em;
    z-index: 1;
    position: relative;
  }

  .sl-content {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 22px;
    align-items: start;
  }
  .sl-content.with-rail {
    grid-template-columns: minmax(0, 1fr) 320px;
  }
  .sl-main {
    min-width: 0;
  }
  .sl-rail {
    position: sticky;
    top: 62px;
    align-self: start;
  }

  .sl-head {
    display: grid;
    grid-template-columns: 1fr 80px 80px 88px 30px;
    gap: 8px;
    padding: 0 10px 8px;
    border-bottom: 1px solid var(--border);
    margin: 0 -10px 4px;
  }
  .sl-sort-btn {
    border: none;
    background: none;
    color: var(--text-3);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-align: right;
    cursor: pointer;
    padding: 0;
  }
  .sl-sort-btn.left { text-align: left; }
  .sl-sort-btn:hover { color: var(--text-2); }
  .sl-sort-btn.on { color: var(--accent); }

  .sl-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 13px 10px;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    border-radius: 6px;
    margin: 0 -10px;
    transition: background 0.08s;
  }
  .sl-row:hover { background: rgba(255,255,255,0.028); }
  .sl-row.active {
    background: rgba(232, 160, 32, 0.10);
    border: 1px solid rgba(232, 160, 32, 0.20);
  }

  .sl-row-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    flex: 1;
  }
  .sl-ticker {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--accent);
    letter-spacing: 0.04em;
    min-width: 64px;
    flex-shrink: 0;
  }
  .sl-name {
    font-size: 13px;
    color: var(--text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sl-exch {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-3);
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .sl-row-right {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-shrink: 0;
  }
  .sl-price {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 500;
    color: var(--text-1);
    font-variant-numeric: tabular-nums;
    min-width: 66px;
    text-align: right;
  }
  .sl-chg {
    font-family: var(--font-mono);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    min-width: 54px;
    text-align: right;
  }
  .sl-chg.pos { color: var(--pos); }
  .sl-chg.neg { color: var(--neg); }
  .sl-chg.neu { color: var(--text-3); }
  .sl-cap {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
    min-width: 56px;
    text-align: right;
  }
  .sl-star {
    background: none;
    border: none;
    font-size: 13px;
    cursor: pointer;
    padding: 2px 4px;
    line-height: 1;
    transition: color 0.1s;
    touch-action: manipulation;
    flex-shrink: 0;
  }
  .sl-star.on  { color: var(--accent); }
  .sl-star.off { color: var(--text-3); }
  .sl-star.off:hover { color: var(--accent); }

  .sl-empty {
    padding: 48px 0;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-3);
    text-align: center;
  }

  @keyframes sl-pulse { 0%,100%{opacity:0.25} 50%{opacity:0.5} }
  .sl-skel-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 13px 10px;
    border-bottom: 1px solid var(--border);
  }
  .sl-skel-bar {
    height: 10px;
    border-radius: 3px;
    background: var(--surface-3);
    animation: sl-pulse 1.6s ease-in-out infinite;
  }

  @media (max-width: 980px) {
    .sl-content.with-rail {
      grid-template-columns: minmax(0, 1fr);
    }
    .sl-rail {
      position: static;
    }
  }

  @media (max-width: 640px) {
    .sl-hero { padding: 52px 0 28px; }
    .sl-name { max-width: 130px; }
    .sl-cap  { display: none; }
    .sl-exch { display: none; }
    .sl-head {
      grid-template-columns: 1fr 80px 80px 30px;
    }
    .sl-head .sl-sort-cap {
      display: none;
    }
    .sl-hint { display: none; }
  }

  @media (max-width: 400px) {
    .sl-page.minimal .sl-title {
      font-size: clamp(28px, 9vw, 48px);
    }
    .sl-pill-wrap {
      max-width: calc(100vw - 48px);
    }
  }
`;
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
    <button className={`sl-sort-btn ${sort.key === key ? "on" : ""} ${cls}`} onClick={() => onSortChange(key)}>
      {label}{sortArrow(sort, key)}
    </button>
  );

  return (
    <>
      <style>{STYLE}</style>
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
            <div className="sl-pill-wrap">
              <div className="sl-pill">
                <span className="sl-pill-icon">/</span>
                <input
                  ref={inputRef}
                  className="sl-pill-input"
                  type="text"
                  placeholder="Ticker or company name…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSuggestionsOpen(true); }}
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
                        <span className="sl-autofill-symbol">{item.symbol}</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                      </span>
                      <span className="sl-autofill-exch">{item.exchange}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!minimalSplash && (
              <div className="sl-hint">
                {quotesLoading
                  ? "Loading live prices…"
                  : quotesLive
                    ? `${stocks.length} stocks · live prices · j/k navigate · Enter open · s star`
                    : `${stocks.length} stocks · add with Enter · press / to search`}
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
                  {quotesLoading ? (
                    <SkeletonList />
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
    </>
  );
}
