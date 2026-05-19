import AreaChart    from "./AreaChart";
import MomentumDots from "./MomentumDots";
import AIInsights   from "./AIInsights";
import { fmt, fmtLarge, fmtVol } from "../data/stocks";
import { convertPrice } from "../data/api";

const STYLE = `
  .dp {
    position: fixed;
    right: 0; top: 0; bottom: 0;
    width: 348px;
    background: var(--surface-1);
    border-left: 1px solid var(--border);
    z-index: 200;
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
  }
  .dp.open { transform: translateX(0); }

  .dp-head {
    padding: 20px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .dp-left { min-width: 0; }

  .dp-price-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 6px;
  }
  .dp-price {
    font-family: var(--font-mono);
    font-size: 26px;
    font-weight: 700;
    color: var(--text-1);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    line-height: 1;
  }
  .dp-price-conv {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
    align-self: flex-end;
    margin-bottom: 2px;
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
    font-size: 16px;
    font-weight: 600;
    color: var(--accent);
    letter-spacing: 0.04em;
    margin-bottom: 2px;
  }
  .dp-name {
    font-size: 12px;
    color: var(--text-3);
    margin-bottom: 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dp-chips { display: flex; gap: 5px; flex-wrap: wrap; }
  .dp-chip {
    font-size: 10px;
    font-weight: 500;
    padding: 2px 7px;
    border: 1px solid var(--border);
    color: var(--text-3);
    border-radius: var(--radius);
    letter-spacing: 0.02em;
  }

  .dp-actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
  .dp-close, .dp-star {
    background: var(--surface-3);
    border: 1px solid var(--border);
    color: var(--text-2);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 13px;
    padding: 5px 11px;
    border-radius: var(--radius);
    transition: color 0.1s, border-color 0.1s, background 0.1s;
    line-height: 1.2;
    touch-action: manipulation;
  }
  .dp-close:hover { color: var(--neg); border-color: rgba(255,69,58,0.3); }
  .dp-star:hover  { color: var(--accent); border-color: rgba(232,160,32,0.3); }
  .dp-star.on     { color: var(--accent); border-color: rgba(232,160,32,0.3); background: var(--accent-dim); }

  .dp-chart-wrap { padding: 16px 20px 12px; border-bottom: 1px solid var(--border); }
  .dp-chart-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-3);
    letter-spacing: 0.07em;
    text-transform: uppercase;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .dp-chart-live {
    font-size: 9px;
    color: var(--pos);
    font-weight: 500;
    letter-spacing: 0.04em;
  }

  .dp-section { padding: 16px 20px; border-bottom: 1px solid var(--border); }
  .dp-section-hd {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-3);
    letter-spacing: 0.07em;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  .dp-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .dp-kv    { display: flex; flex-direction: column; gap: 3px; }
  .dp-k     { font-size: 11px; color: var(--text-3); line-height: 1.3; }
  .dp-v     { font-family: var(--font-mono); font-size: 14px; font-weight: 500; color: var(--text-1); font-variant-numeric: tabular-nums; }

  /* Analyst section */
  .dp-analyst-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .dp-cons {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
  }
  .dp-cons-buy  { color: var(--pos); }
  .dp-cons-sell { color: var(--neg); }
  .dp-cons-hold { color: var(--text-2); }
  .dp-cons-n    { color: var(--text-3); }
  .dp-analyst-bars { display: flex; gap: 2px; flex: 1; }
  .dp-analyst-bar  { height: 3px; border-radius: 2px; }
  .dp-analyst-meta { font-size: 11px; color: var(--text-3); }

  @media (max-width: 768px) {
    .dp { width: 100%; left: 0; border-left: none; top: var(--header-h); }
  }
`;

function pClr(v, med) {
  return v == null || med == null ? "var(--text-1)" : v < med ? "var(--pos)" : "var(--neg)";
}

function AnalystRow({ analyst }) {
  if (!analyst || !analyst.total) return null;
  const { buy, hold, sell, total, meanTarget, highTarget, lowTarget } = analyst;

  const consensus = buy > hold && buy > sell ? "BUY"
    : sell > buy && sell > hold ? "SELL"
    : "HOLD";
  const consCls = consensus === "BUY" ? "dp-cons-buy" : consensus === "SELL" ? "dp-cons-sell" : "dp-cons-hold";

  return (
    <div style={{ marginBottom: 12 }}>
      <div className="dp-analyst-row">
        <span className={`dp-cons ${consCls}`}>{consensus}</span>
        <div className="dp-analyst-bars">
          {buy  > 0 && <div className="dp-analyst-bar" style={{ flex: buy,  background: "var(--pos)" }} />}
          {hold > 0 && <div className="dp-analyst-bar" style={{ flex: hold, background: "var(--text-3)" }} />}
          {sell > 0 && <div className="dp-analyst-bar" style={{ flex: sell, background: "var(--neg)" }} />}
        </div>
        <span className="dp-analyst-meta">{total} analysts</span>
      </div>
      {meanTarget != null && (
        <div className="dp-analyst-meta">
          Target ${fmt(meanTarget, 2)}
          {highTarget && lowTarget && ` · range $${fmt(lowTarget, 2)}–$${fmt(highTarget, 2)}`}
        </div>
      )}
    </div>
  );
}

export default function DetailPanel({
  stock, onClose, watchlist, onStarClick,
  volRatio, momentumScore, sectorMedians,
  currency, usdToCadRate,
  candleData, supplementary, claudeKey,
}) {
  const s       = stock;
  const open    = !!s;
  const starred = s ? watchlist.includes(s.ticker) : false;

  return (
    <>
      <style>{STYLE}</style>
      <div className={`dp ${open ? "open" : ""}`}>
        {s && (
          <>
            <div className="dp-head">
              <div className="dp-left">
                {(() => {
                  const { price: dispPrice, converted } = convertPrice(s.price, s.exchange, currency, usdToCadRate);
                  const dec = dispPrice < 10 ? 3 : 2;
                  return (
                    <div className="dp-price-row">
                      <span className="dp-price">{converted && "~"}${fmt(dispPrice, dec)}</span>
                      <span className={`dp-chg ${s.change >= 0 ? "dp-chg-pos" : "dp-chg-neg"}`}>
                        {s.change >= 0 ? "+" : ""}{fmt(s.change)}%
                      </span>
                      {converted && (
                        <span className="dp-price-conv">{currency}</span>
                      )}
                    </div>
                  );
                })()}
                <div className="dp-ticker">{s.ticker}</div>
                <div className="dp-name">{s.name}</div>
                <div className="dp-chips">
                  <span className="dp-chip">{s.exchange}</span>
                  <span className="dp-chip">{s.sector}</span>
                </div>
              </div>
              <div className="dp-actions">
                <button className="dp-close" onClick={onClose}>✕</button>
                <button className={`dp-star ${starred ? "on" : ""}`} onClick={() => onStarClick(s.ticker)}>
                  {starred ? "★" : "☆"}
                </button>
              </div>
            </div>

            <div className="dp-chart-wrap">
              <div className="dp-chart-label">
                30-day price
                {candleData ? <span className="dp-chart-live">live</span> : <span style={{ color: "var(--text-3)", fontSize: 9 }}>simulated</span>}
              </div>
              <AreaChart positive={s.change >= 0} prices={candleData ?? null} />
            </div>

            {/* Analyst data (when available) */}
            {supplementary?.analyst?.total > 0 && (
              <div className="dp-section">
                <div className="dp-section-hd">Analyst Consensus</div>
                <AnalystRow analyst={supplementary.analyst} />
                {supplementary.sentiment?.bullish != null && (
                  <div className="dp-analyst-meta" style={{ marginTop: 6 }}>
                    News: {Math.round(supplementary.sentiment.bullish * 100)}% bullish
                    {supplementary.sentiment.articles > 0 && ` · ${supplementary.sentiment.articles} articles/week`}
                  </div>
                )}
              </div>
            )}

            <div className="dp-section">
              <div className="dp-section-hd">Valuation</div>
              <div className="dp-grid">
                <div className="dp-kv">
                  <span className="dp-k">P/E Ratio</span>
                  <span className="dp-v" style={{ color: pClr(s.pe, sectorMedians[s.sector]?.pe) }}>
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
                  <span className="dp-v" style={{ color: pClr(s.pb, sectorMedians[s.sector]?.pb) }}>{fmt(s.pb, 1)}</span>
                </div>
                <div className="dp-kv">
                  <span className="dp-k">Beta</span>
                  <span className="dp-v">{fmt(s.beta)}</span>
                </div>
              </div>
            </div>

            <div className="dp-section">
              <div className="dp-section-hd">Growth</div>
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
              <div className="dp-section-hd">Volume & Momentum</div>
              <div className="dp-grid">
                <div className="dp-kv">
                  <span className="dp-k">Today's volume</span>
                  <span className="dp-v">{fmtVol(s.vol)}</span>
                </div>
                <div className="dp-kv">
                  <span className="dp-k">Avg daily vol</span>
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
                  <span className="dp-v" style={{ display: "flex", alignItems: "center" }}>
                    <MomentumDots score={momentumScore(s)} size={7} />
                  </span>
                </div>
              </div>
            </div>

            <div className="dp-section">
              <div className="dp-section-hd">Size</div>
              <div className="dp-grid">
                <div className="dp-kv">
                  <span className="dp-k">Market cap</span>
                  <span className="dp-v">{fmtLarge(s.mktCap)}</span>
                </div>
                <div className="dp-kv">
                  <span className="dp-k">Exchange</span>
                  <span className="dp-v" style={{ color: "var(--text-2)" }}>{s.exchange}</span>
                </div>
              </div>
            </div>

            <AIInsights
              stock={s}
              analystData={supplementary?.analyst ?? null}
              sentiment={supplementary?.sentiment ?? null}
              claudeKey={claudeKey}
            />
          </>
        )}
      </div>
    </>
  );
}
