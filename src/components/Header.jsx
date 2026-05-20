const STYLE = `
  .hdr {
    display: flex;
    align-items: center;
    height: var(--header-h);
    padding: 0 20px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-1);
    position: sticky;
    top: 0;
    z-index: 100;
    flex-shrink: 0;
  }

  .hdr-logo {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--accent);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    flex-shrink: 0;
    user-select: none;
  }
  .hdr-logo-slash { color: var(--text-3); font-weight: 400; margin: 0 1px; }

  .hdr-right {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-shrink: 0;
    margin-left: auto;
  }

  /* Currency toggle */
  .hdr-currency {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-mono);
    font-size: 11px;
    cursor: pointer;
    user-select: none;
    flex-shrink: 0;
  }
  .hdr-ccy-sep { color: var(--text-3); }
  .hdr-ccy-on  { color: var(--text-1); font-weight: 600; }
  .hdr-ccy-off { color: var(--text-3); transition: color 0.1s; }
  .hdr-ccy-off:hover { color: var(--text-2); }

  /* Watchlist */
  .hdr-wl {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--text-2);
    cursor: default;
    flex-shrink: 0;
  }
  .hdr-wl-star { color: var(--accent); font-size: 10px; }

  /* Loading dot */
  .hdr-status { display: flex; align-items: center; gap: 7px; flex-shrink: 0; }
  .hdr-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--pos);
    flex-shrink: 0;
    transition: background 0.3s;
  }
  .hdr-dot.loading { animation: dot-pulse 1s ease-in-out infinite; }
  .hdr-dot.offline { background: var(--text-3); }
  @keyframes dot-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
  .hdr-clock {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
  }

  /* Mobile filter button — hidden on desktop */
  .hdr-filter-btn {
    display: none;
    align-items: center;
    gap: 7px;
    font-family: var(--font-ui);
    font-size: 12px;
    font-weight: 500;
    background: var(--surface-3);
    border: 1px solid var(--border);
    color: var(--text-2);
    padding: 0 12px;
    height: 30px;
    border-radius: var(--radius);
    cursor: pointer;
    transition: color 0.1s, border-color 0.1s;
    touch-action: manipulation;
    white-space: nowrap;
  }
  .hdr-filter-btn:hover { color: var(--text-1); border-color: var(--border-2); }
  .hdr-filter-badge {
    background: var(--accent);
    color: #000;
    font-size: 10px;
    font-weight: 700;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @media (max-width: 768px) {
    .hdr { padding: 0 16px; gap: 0; }
    .hdr-filter-btn { display: flex; }
    .hdr-right { gap: 12px; }
    .hdr-currency { display: none; }
  }
`;

export default function Header({
  clock, watchlistCount, currency, onCurrencyToggle,
  quotesLoading, quotesLive, onFiltersOpen, activeFilterCount,
}) {
  return (
    <>
      <style>{STYLE}</style>
      <header className="hdr">
        <div className="hdr-logo">
          MKTSCAN<span className="hdr-logo-slash">/</span>PRO
        </div>

        {/* Mobile filter button */}
        <button className="hdr-filter-btn" onClick={onFiltersOpen}>
          Filters
          {activeFilterCount > 0 && (
            <span className="hdr-filter-badge">{activeFilterCount}</span>
          )}
        </button>

        <div className="hdr-right">
          {/* Currency toggle */}
          <div className="hdr-currency">
            <span
              className={currency === "USD" ? "hdr-ccy-on" : "hdr-ccy-off"}
              onClick={() => currency !== "USD" && onCurrencyToggle("USD")}
            >USD</span>
            <span className="hdr-ccy-sep">·</span>
            <span
              className={currency === "CAD" ? "hdr-ccy-on" : "hdr-ccy-off"}
              onClick={() => currency !== "CAD" && onCurrencyToggle("CAD")}
            >CAD</span>
          </div>

          {watchlistCount > 0 && (
            <div className="hdr-wl">
              <span className="hdr-wl-star">★</span>
              <span>{watchlistCount}</span>
            </div>
          )}

          <div className="hdr-status">
            <div className={`hdr-dot${quotesLoading ? " loading" : !quotesLive ? " offline" : ""}`} />
            <span className="hdr-clock">{clock}</span>
          </div>
        </div>
      </header>
    </>
  );
}
