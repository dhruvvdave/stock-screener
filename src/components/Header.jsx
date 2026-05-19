const TAPE_ITEMS = [
  { label: "SPY", price: "512.84", change: "+0.32%", pos: true },
  { label: "QQQ", price: "441.22", change: "+0.61%", pos: true },
  { label: "TSX",  price: "22,847", change: "+0.18%", pos: true },
  { label: "VIX",  price: "13.4",   change: "-2.10%", pos: false },
  { label: "DXY",  price: "104.2",  change: "-0.08%", pos: false },
  { label: "WTI",  price: "78.34",  change: "+1.24%", pos: true },
  { label: "GOLD", price: "2,341",  change: "+0.44%", pos: true },
  { label: "BTC",  price: "67,240", change: "+2.18%", pos: true },
];

const TAPE_STRING = [...TAPE_ITEMS, ...TAPE_ITEMS]
  .map(t => `${t.label}  ${t.price}  ${t.pos ? "+" : ""}${t.change}`)
  .join("     ·     ");

const STYLE = `
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    height: 48px;
    border-bottom: 1px solid #2a2a2a;
    background: linear-gradient(180deg, #161616 0%, #111111 100%);
    position: sticky;
    top: 0;
    z-index: 100;
    gap: 16px;
  }
  .header-left { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }

  .logo {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    background: linear-gradient(90deg, #f0b429 0%, #ffd166 40%, #e07b00 70%, #f0b429 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: shimmer 3s linear infinite;
  }
  @keyframes shimmer { to { background-position: 200% center; } }

  .logo-slash { -webkit-text-fill-color: #444; color: #444; background: none; }

  .header-tag {
    font-size: 9px;
    padding: 2px 7px;
    border: 1px solid #333;
    color: #555;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .ticker-tape-wrap {
    flex: 1;
    overflow: hidden;
    min-width: 0;
    mask-image: linear-gradient(90deg, transparent 0%, black 5%, black 95%, transparent 100%);
    -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 5%, black 95%, transparent 100%);
  }
  .ticker-tape-inner {
    display: inline-block;
    white-space: nowrap;
    font-size: 10px;
    color: #555;
    letter-spacing: 0.05em;
    animation: scroll-tape 30s linear infinite;
  }
  .ticker-tape-inner .tape-label { color: #888; font-weight: 500; }
  .ticker-tape-inner .tape-pos { color: #22c55e; }
  .ticker-tape-inner .tape-neg { color: #ef4444; }
  @keyframes scroll-tape {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }

  .header-right { display: flex; align-items: center; gap: 16px; flex-shrink: 0; }

  .market-pill { display: flex; align-items: center; gap: 6px; font-size: 10px; color: #555; }
  .market-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }

  .clock { font-size: 10px; color: #555; letter-spacing: 0.06em; font-family: 'IBM Plex Mono', monospace; }

  .watchlist-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    background: rgba(240,180,41,0.08);
    border: 1px solid rgba(240,180,41,0.25);
    color: #f0b429;
    padding: 3px 10px;
    border-radius: 999px;
    letter-spacing: 0.06em;
    cursor: default;
  }
  .watchlist-star { font-size: 11px; }
`;

export default function Header({ clock, watchlistCount }) {
  const tape = (
    <span>
      {[...TAPE_ITEMS, ...TAPE_ITEMS].map((t, i) => (
        <span key={i}>
          {i > 0 && <span style={{ color: "#2a2a2a" }}>     ·     </span>}
          <span className="tape-label">{t.label}</span>
          {"  "}
          <span style={{ color: "#777" }}>{t.price}</span>
          {"  "}
          <span className={t.pos ? "tape-pos" : "tape-neg"}>{t.pos ? "+" : ""}{t.change}</span>
        </span>
      ))}
    </span>
  );

  return (
    <>
      <style>{STYLE}</style>
      <div className="header">
        <div className="header-left">
          <div className="logo">MKTSCAN<span className="logo-slash">/</span>PRO</div>
          <div className="header-tag">BETA</div>
        </div>

        <div className="ticker-tape-wrap">
          <div className="ticker-tape-inner">{tape}</div>
        </div>

        <div className="header-right">
          {watchlistCount > 0 && (
            <div className="watchlist-badge">
              <span className="watchlist-star">★</span>
              {watchlistCount}
            </div>
          )}
          <div className="market-pill">
            <div className="market-dot" />
            <span>LIVE</span>
          </div>
          <div className="clock">{clock} EST</div>
        </div>
      </div>
    </>
  );
}
