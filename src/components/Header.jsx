const MARKET_DATA = [
  { label: "SPY",  price: "512.84", change: "+0.32%", pos: true },
  { label: "QQQ",  price: "441.22", change: "+0.61%", pos: true },
  { label: "TSX",  price: "22,847", change: "+0.18%", pos: true },
  { label: "VIX",  price: "13.40",  change: "−2.10%", pos: false },
];

const STYLE = `
  .header {
    display: flex;
    align-items: center;
    height: 44px;
    padding: 0 24px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-1);
    position: sticky;
    top: 0;
    z-index: 100;
    gap: 0;
  }

  .logo {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
    letter-spacing: 0.04em;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .logo-sep {
    color: var(--text-3);
    font-weight: 300;
    margin: 0 1px;
  }

  .header-divider {
    width: 1px;
    height: 16px;
    background: var(--border);
    margin: 0 20px;
    flex-shrink: 0;
  }

  .market-pills {
    display: flex;
    gap: 4px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }
  .market-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    border: 1px solid var(--border);
    background: transparent;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .mp-label {
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 500;
    color: var(--text-3);
    letter-spacing: 0.02em;
  }
  .mp-price {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-1);
    font-variant-numeric: tabular-nums;
  }
  .mp-change {
    font-family: var(--font-mono);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .mp-pos { color: var(--pos); }
  .mp-neg { color: var(--neg); }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
    margin-left: 20px;
  }

  .wl-count {
    font-family: var(--font-ui);
    font-size: 12px;
    color: var(--text-2);
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .wl-star { color: var(--accent); font-size: 11px; }

  .status-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .status-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--pos);
    flex-shrink: 0;
  }
  .clock {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
  }
`;

export default function Header({ clock, watchlistCount }) {
  return (
    <>
      <style>{STYLE}</style>
      <div className="header">
        <div className="logo">MKTSCAN<span className="logo-sep">/</span>PRO</div>

        <div className="header-divider" />

        <div className="market-pills">
          {MARKET_DATA.map(m => (
            <div key={m.label} className="market-pill">
              <span className="mp-label">{m.label}</span>
              <span className="mp-price">{m.price}</span>
              <span className={`mp-change ${m.pos ? "mp-pos" : "mp-neg"}`}>{m.change}</span>
            </div>
          ))}
        </div>

        <div className="header-right">
          {watchlistCount > 0 && (
            <div className="wl-count">
              <span className="wl-star">★</span>
              {watchlistCount}
            </div>
          )}
          <div className="status-row">
            <div className="status-dot" />
            <span className="clock">{clock}</span>
          </div>
        </div>
      </div>
    </>
  );
}
