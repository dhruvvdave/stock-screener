import AreaChart from "./AreaChart";
import MomentumDots from "./MomentumDots";
import { fmt, fmtLarge, fmtVol } from "../data/stocks";

const STYLE = `
  .dp {
    position: fixed;
    right: 0; top: 0; bottom: 0;
    width: 340px;
    background: var(--surface-1);
    border-left: 1px solid var(--border);
    z-index: 200;
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.18s ease-out;
    overflow-y: auto;
  }
  .dp.open { transform: translateX(0); }

  .dp-head {
    padding: 20px 20px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-1);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-shrink: 0;
  }
  .dp-price-line {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 4px;
  }
  .dp-price {
    font-family: var(--font-mono);
    font-size: 24px;
    font-weight: 600;
    color: var(--text-1);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }
  .dp-chg {
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .dp-chg-pos { color: var(--pos); }
  .dp-chg-neg { color: var(--neg); }
  .dp-ticker {
    font-family: var(--font-mono);
    font-size: 15px;
    font-weight: 600;
    color: var(--accent);
    letter-spacing: 0.04em;
    margin-bottom: 2px;
  }
  .dp-name {
    font-family: var(--font-ui);
    font-size: 12px;
    color: var(--text-3);
    margin-bottom: 10px;
  }
  .dp-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .dp-chip {
    font-family: var(--font-ui);
    font-size: 11px;
    padding: 2px 8px;
    border: 1px solid var(--border);
    color: var(--text-3);
    border-radius: 3px;
  }

  .dp-head-actions { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; flex-shrink: 0; }
  .dp-close {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-3);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 2px;
    transition: color 0.1s, border-color 0.1s;
    line-height: 1.2;
  }
  .dp-close:hover { color: var(--neg); border-color: var(--neg); }
  .dp-star {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-3);
    cursor: pointer;
    font-size: 14px;
    padding: 4px 10px;
    border-radius: 2px;
    transition: color 0.1s, border-color 0.1s;
    line-height: 1.2;
  }
  .dp-star:hover   { color: var(--accent); border-color: rgba(232,160,32,0.3); }
  .dp-star.starred { color: var(--accent); border-color: rgba(232,160,32,0.3); }

  .dp-chart {
    padding: 16px 20px 12px;
    border-bottom: 1px solid var(--border);
  }
  .dp-section-label {
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 500;
    color: var(--text-3);
    margin-bottom: 12px;
    letter-spacing: 0;
  }

  .dp-section {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }
  .dp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .dp-kv { display: flex; flex-direction: column; gap: 4px; }
  .dp-k {
    font-family: var(--font-ui);
    font-size: 11px;
    color: var(--text-3);
    letter-spacing: 0;
  }
  .dp-v {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--text-1);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
`;

export default function DetailPanel({ stock, onClose, watchlist, onStarClick, volRatio, momentumScore, sectorMedians }) {
  const s = stock;
  const starred = s ? watchlist.includes(s.ticker) : false;

  const peColor = (val, med) => {
    if (val == null || med == null) return "var(--text-1)";
    return val < med ? "var(--pos)" : "var(--neg)";
  };

  return (
    <>
      <style>{STYLE}</style>
      <div className={`dp ${s ? "open" : ""}`}>
        {s && (
          <>
            <div className="dp-head">
              <div>
                <div className="dp-price-line">
                  <span className="dp-price">${fmt(s.price, s.price < 10 ? 3 : 2)}</span>
                  <span className={`dp-chg ${s.change >= 0 ? "dp-chg-pos" : "dp-chg-neg"}`}>
                    {s.change >= 0 ? "+" : ""}{fmt(s.change)}%
                  </span>
                </div>
                <div className="dp-ticker">{s.ticker}</div>
                <div className="dp-name">{s.name}</div>
                <div className="dp-chips">
                  <span className="dp-chip">{s.exchange}</span>
                  <span className="dp-chip">{s.sector}</span>
                </div>
              </div>
              <div className="dp-head-actions">
                <button className="dp-close" onClick={onClose}>✕</button>
                <button className={`dp-star ${starred ? "starred" : ""}`} onClick={() => onStarClick(s.ticker)}>
                  {starred ? "★" : "☆"}
                </button>
              </div>
            </div>

            <div className="dp-chart">
              <div className="dp-section-label">30-day price (simulated)</div>
              <AreaChart positive={s.change >= 0} />
            </div>

            <div className="dp-section">
              <div className="dp-section-label">Valuation</div>
              <div className="dp-grid">
                <div className="dp-kv">
                  <span className="dp-k">P/E Ratio</span>
                  <span className="dp-v" style={{ color: peColor(s.pe, sectorMedians[s.sector]?.pe) }}>
                    {s.pe ? fmt(s.pe, 1) : "—"}
                  </span>
                </div>
                <div className="dp-kv">
                  <span className="dp-k">Sector median P/E</span>
                  <span className="dp-v" style={{ color: "var(--text-2)" }}>
                    {sectorMedians[s.sector]?.pe ? fmt(sectorMedians[s.sector].pe, 1) : "—"}
                  </span>
                </div>
                <div className="dp-kv">
                  <span className="dp-k">P/B Ratio</span>
                  <span className="dp-v" style={{ color: peColor(s.pb, sectorMedians[s.sector]?.pb) }}>
                    {fmt(s.pb, 1)}
                  </span>
                </div>
                <div className="dp-kv">
                  <span className="dp-k">Beta</span>
                  <span className="dp-v">{fmt(s.beta)}</span>
                </div>
              </div>
            </div>

            <div className="dp-section">
              <div className="dp-section-label">Growth</div>
              <div className="dp-grid">
                <div className="dp-kv">
                  <span className="dp-k">EPS Growth</span>
                  <span className="dp-v" style={{ color: s.epsGrowth > 0 ? "var(--pos)" : s.epsGrowth < 0 ? "var(--neg)" : "var(--text-2)" }}>
                    {s.epsGrowth != null ? (s.epsGrowth > 0 ? "+" : "") + s.epsGrowth + "%" : "—"}
                  </span>
                </div>
                <div className="dp-kv">
                  <span className="dp-k">Revenue Growth</span>
                  <span className="dp-v" style={{ color: s.revGrowth > 0 ? "var(--pos)" : "var(--neg)" }}>
                    {s.revGrowth > 0 ? "+" : ""}{s.revGrowth}%
                  </span>
                </div>
              </div>
            </div>

            <div className="dp-section">
              <div className="dp-section-label">Volume & momentum</div>
              <div className="dp-grid">
                <div className="dp-kv">
                  <span className="dp-k">Today</span>
                  <span className="dp-v">{fmtVol(s.vol)}</span>
                </div>
                <div className="dp-kv">
                  <span className="dp-k">Avg daily</span>
                  <span className="dp-v">{fmtVol(s.avgVol)}</span>
                </div>
                <div className="dp-kv">
                  <span className="dp-k">Vol / Avg</span>
                  <span className="dp-v" style={{ color: volRatio(s) > 1.5 ? "var(--accent)" : "var(--text-1)" }}>
                    {fmt(volRatio(s))}×
                  </span>
                </div>
                <div className="dp-kv">
                  <span className="dp-k">Momentum score</span>
                  <span className="dp-v"><MomentumDots score={momentumScore(s)} /></span>
                </div>
              </div>
            </div>

            <div className="dp-section">
              <div className="dp-section-label">Size</div>
              <div className="dp-grid">
                <div className="dp-kv">
                  <span className="dp-k">Market cap</span>
                  <span className="dp-v">{fmtLarge(s.mktCap)}</span>
                </div>
                <div className="dp-kv">
                  <span className="dp-k">Beta</span>
                  <span className="dp-v">{fmt(s.beta)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
