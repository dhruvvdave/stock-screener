const STYLE = `
  .hdr {
    display: flex;
    align-items: center;
    height: 48px;
    padding: 0 20px;
    border-bottom: 1px solid var(--border);
    background: rgba(5,5,5,0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    position: sticky;
    top: 0;
    z-index: 100;
    flex-shrink: 0;
  }

  .hdr-logo {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--accent);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    user-select: none;
    flex-shrink: 0;
  }
  .hdr-logo-slash { color: var(--text-3); font-weight: 400; margin: 0 1px; }

  .hdr-right {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
    margin-left: auto;
  }

  .hdr-currency {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-mono);
    font-size: 11px;
    cursor: pointer;
    user-select: none;
  }
  .hdr-ccy-sep { color: var(--text-3); }
  .hdr-ccy-on  { color: var(--text-1); font-weight: 600; }
  .hdr-ccy-off { color: var(--text-3); transition: color 0.1s; }
  .hdr-ccy-off:hover { color: var(--text-2); }

  .hdr-wl {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: var(--text-2);
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
        <div className="hdr-logo">
          MKTSCAN<span className="hdr-logo-slash">/</span>PRO
        </div>

        <div className="hdr-right">
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
