const STYLE = `
  .hdr {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: 40px;
    padding: 0 20px;
    border-bottom: 1px solid var(--border);
    background: rgba(5,5,5,0.9);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    position: sticky;
    top: 0;
    z-index: 100;
    flex-shrink: 0;
    gap: 18px;
  }

  .hdr-currency {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-mono);
    font-size: 11px;
    user-select: none;
  }
  .hdr-ccy-sep { color: var(--text-3); }
  .hdr-ccy-on  { color: var(--text-1); font-weight: 600; cursor: default; }
  .hdr-ccy-off { color: var(--text-3); cursor: pointer; transition: color 0.1s; }
  .hdr-ccy-off:hover { color: var(--text-2); }

  .hdr-wl {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    cursor: default;
  }
  .hdr-wl-star { color: var(--accent); font-size: 10px; }

  .hdr-status { display: flex; align-items: center; gap: 7px; }
  .hdr-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: var(--pos); flex-shrink: 0; transition: background 0.3s;
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
`;

export default function Header({
  clock, watchlistCount, currency, onCurrencyToggle,
  quotesLoading, quotesLive,
}) {
  return (
    <>
      <style>{STYLE}</style>
      <header className="hdr">
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
      </header>
    </>
  );
}
