import AreaChart from "./AreaChart";
import MomentumDots from "./MomentumDots";
import { fmt, fmtLarge, fmtVol, SECTOR_BADGE_COLOR, SECTOR_ICON } from "../data/stocks";

const STYLE = `
  .detail-panel {
    position: fixed;
    right: 0; top: 0; bottom: 0;
    width: 350px;
    background: #111;
    border-left: 1px solid #2a2a2a;
    z-index: 200;
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    overflow-y: auto;
  }
  .detail-panel.dp-open { transform: translateX(0); }

  .dp-header {
    padding: 16px;
    border-bottom: 1px solid #1e1e1e;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    background: linear-gradient(180deg, #161616 0%, #111 100%);
    flex-shrink: 0;
  }
  .dp-ticker    { font-size: 22px; font-weight: 600; color: #f0b429; letter-spacing: 0.02em; }
  .dp-name      { font-size: 11px; color: #555; margin-top: 3px; font-family: 'IBM Plex Sans', sans-serif; }
  .dp-badges    { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }

  .dp-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 9px;
    padding: 2px 9px;
    border-radius: 999px;
    border: 1px solid #2a2a2a;
    color: #555;
    letter-spacing: 0.05em;
  }
  .dp-badge-blue   { background: rgba(59,130,246,0.08);  color: #3b82f6; border-color: rgba(59,130,246,0.2); }
  .dp-badge-yellow { background: rgba(240,180,41,0.08);  color: #f0b429; border-color: rgba(240,180,41,0.2); }
  .dp-badge-green  { background: rgba(34,197,94,0.08);   color: #22c55e; border-color: rgba(34,197,94,0.2); }
  .dp-badge-cyan   { background: rgba(6,182,212,0.08);   color: #06b6d4; border-color: rgba(6,182,212,0.2); }
  .dp-badge-purple { background: rgba(168,85,247,0.08);  color: #a855f7; border-color: rgba(168,85,247,0.2); }
  .dp-badge-red    { background: rgba(239,68,68,0.08);   color: #ef4444; border-color: rgba(239,68,68,0.2); }

  .dp-header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0; }
  .dp-close {
    background: none;
    border: 1px solid #2a2a2a;
    color: #555;
    cursor: pointer;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    padding: 4px 10px;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .dp-close:hover { border-color: #ef4444; color: #ef4444; }

  .dp-star-btn {
    background: none;
    border: 1px solid #2a2a2a;
    color: #2a2a2a;
    cursor: pointer;
    font-size: 14px;
    padding: 3px 10px;
    border-radius: 2px;
    transition: all 0.15s;
    line-height: 1.2;
  }
  .dp-star-btn.starred { color: #f0b429; border-color: rgba(240,180,41,0.4); background: rgba(240,180,41,0.06); }
  .dp-star-btn:hover { border-color: #f0b429; color: #f0b429; }

  .dp-chart { padding: 14px 16px 10px; border-bottom: 1px solid #1e1e1e; }
  .dp-chart-label {
    font-size: 9px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #444;
    margin-bottom: 10px;
    font-family: 'IBM Plex Sans', sans-serif;
  }

  .dp-section { padding: 13px 16px; border-bottom: 1px solid #1e1e1e; }
  .dp-section-title {
    font-size: 9px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #444;
    margin-bottom: 10px;
    font-family: 'IBM Plex Sans', sans-serif;
  }
  .dp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .dp-kv { display: flex; flex-direction: column; gap: 3px; }
  .dp-k { font-size: 9px; color: #444; letter-spacing: 0.08em; text-transform: uppercase; }
  .dp-v { font-size: 13px; color: #e8e8e8; font-weight: 500; }

  .dp-price-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 4px;
  }
  .dp-price { font-size: 28px; font-weight: 600; color: #f0b429; letter-spacing: -0.02em; }
  .dp-chg { font-size: 14px; font-weight: 500; }
  .dp-chg-pos { color: #22c55e; }
  .dp-chg-neg { color: #ef4444; }
`;

function dpBadgeClass(color) {
  return color ? `dp-badge dp-badge-${color}` : "dp-badge";
}

export default function DetailPanel({ stock, onClose, watchlist, onStarClick, volRatio, momentumScore, sectorMedians }) {
  const isOpen = stock != null;
  const s = stock;

  const isStarred = s ? watchlist.includes(s.ticker) : false;

  return (
    <>
      <style>{STYLE}</style>
      <div className={`detail-panel ${isOpen ? "dp-open" : ""}`}>
        {s && (
          <>
            <div className="dp-header">
              <div>
                <div className="dp-price-row">
                  <div className="dp-price">${fmt(s.price, s.price < 10 ? 3 : 2)}</div>
                  <div className={`dp-chg ${s.change >= 0 ? "dp-chg-pos" : "dp-chg-neg"}`}>
                    {s.change >= 0 ? "+" : ""}{fmt(s.change)}%
                  </div>
                </div>
                <div className="dp-ticker">{s.ticker}</div>
                <div className="dp-name">{s.name}</div>
                <div className="dp-badges">
                  <span className="dp-badge">{s.exchange}</span>
                  <span className={dpBadgeClass(SECTOR_BADGE_COLOR[s.sector])}>
                    <span style={{ fontSize: 8, fontWeight: 700, opacity: 0.6 }}>{SECTOR_ICON[s.sector]}</span>
                    {s.sector}
                  </span>
                </div>
              </div>
              <div className="dp-header-right">
                <button className="dp-close" onClick={onClose}>✕</button>
                <button
                  className={`dp-star-btn ${isStarred ? "starred" : ""}`}
                  onClick={() => onStarClick(s.ticker)}
                  title={isStarred ? "Remove from watchlist" : "Add to watchlist"}
                >
                  {isStarred ? "★" : "☆"}
                </button>
              </div>
            </div>

            <div className="dp-chart">
              <div className="dp-chart-label">30-Day Price (Simulated)</div>
              <AreaChart positive={s.change >= 0} />
            </div>

            <div className="dp-section">
              <div className="dp-section-title">Valuation</div>
              <div className="dp-grid">
                <div className="dp-kv">
                  <span className="dp-k">P/E Ratio</span>
                  <span className="dp-v" style={{ color: s.pe && sectorMedians[s.sector]?.pe ? (s.pe < sectorMedians[s.sector].pe ? "#22c55e" : "#ef4444") : "#e8e8e8" }}>
                    {s.pe ? fmt(s.pe, 1) : "N/A"}
                  </span>
                </div>
                <div className="dp-kv">
                  <span className="dp-k">Sector Median P/E</span>
                  <span className="dp-v" style={{ color: "#555" }}>
                    {sectorMedians[s.sector]?.pe ? fmt(sectorMedians[s.sector].pe, 1) : "—"}
                  </span>
                </div>
                <div className="dp-kv">
                  <span className="dp-k">P/B Ratio</span>
                  <span className="dp-v">{fmt(s.pb, 1)}</span>
                </div>
                <div className="dp-kv">
                  <span className="dp-k">Beta</span>
                  <span className="dp-v">{fmt(s.beta)}</span>
                </div>
              </div>
            </div>

            <div className="dp-section">
              <div className="dp-section-title">Growth</div>
              <div className="dp-grid">
                <div className="dp-kv">
                  <span className="dp-k">EPS Growth</span>
                  <span className="dp-v" style={{ color: s.epsGrowth > 0 ? "#22c55e" : s.epsGrowth < 0 ? "#ef4444" : "#555" }}>
                    {s.epsGrowth != null ? (s.epsGrowth > 0 ? "+" : "") + s.epsGrowth + "%" : "N/A"}
                  </span>
                </div>
                <div className="dp-kv">
                  <span className="dp-k">Rev Growth</span>
                  <span className="dp-v" style={{ color: s.revGrowth > 0 ? "#22c55e" : "#ef4444" }}>
                    {s.revGrowth > 0 ? "+" : ""}{s.revGrowth}%
                  </span>
                </div>
              </div>
            </div>

            <div className="dp-section">
              <div className="dp-section-title">Volume & Momentum</div>
              <div className="dp-grid">
                <div className="dp-kv">
                  <span className="dp-k">Today's Vol</span>
                  <span className="dp-v">{fmtVol(s.vol)}</span>
                </div>
                <div className="dp-kv">
                  <span className="dp-k">Avg Vol</span>
                  <span className="dp-v">{fmtVol(s.avgVol)}</span>
                </div>
                <div className="dp-kv">
                  <span className="dp-k">Vol / Avg</span>
                  <span className="dp-v" style={{ color: volRatio(s) > 1.5 ? "#f0b429" : "#e8e8e8" }}>
                    {fmt(volRatio(s))}x
                  </span>
                </div>
                <div className="dp-kv">
                  <span className="dp-k">Momentum</span>
                  <span className="dp-v"><MomentumDots score={momentumScore(s)} /></span>
                </div>
              </div>
            </div>

            <div className="dp-section">
              <div className="dp-section-title">Size</div>
              <div className="dp-grid">
                <div className="dp-kv">
                  <span className="dp-k">Market Cap</span>
                  <span className="dp-v">{fmtLarge(s.mktCap)}</span>
                </div>
                <div className="dp-kv">
                  <span className="dp-k">Exchange</span>
                  <span className="dp-v" style={{ color: "#888" }}>{s.exchange}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
