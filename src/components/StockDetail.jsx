import AreaChart    from "./AreaChart";
import MomentumDots from "./MomentumDots";
import AIInsights   from "./AIInsights";
import { fmt, fmtLarge, volRatio, momentumScore } from "../data/stocks";
import { convertPrice } from "../data/api";

const STYLE = `
  .sd-page {
    min-height: calc(100svh - 48px);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .sd-container {
    max-width: 820px;
    margin: 0 auto;
    padding: 0 24px 80px;
    width: 100%;
  }

  .sd-nav {
    padding: 24px 0 0;
  }
  .sd-back {
    background: none;
    border: none;
    color: var(--text-3);
    font-family: var(--font-mono);
    font-size: 11px;
    cursor: pointer;
    padding: 4px 0;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: color 0.15s;
    touch-action: manipulation;
  }
  .sd-back:hover { color: var(--text-1); }

  .sd-hero { padding: 28px 0 24px; }
  .sd-hero-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    flex-wrap: wrap;
  }

  .sd-ticker-line {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }
  .sd-ticker {
    font-family: var(--font-mono);
    font-size: 24px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: 0.02em;
    line-height: 1;
  }
  .sd-star {
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
    color: var(--text-3);
    padding: 2px 4px;
    line-height: 1;
    transition: color 0.1s;
    touch-action: manipulation;
  }
  .sd-star.on  { color: var(--accent); }
  .sd-star:hover { color: var(--accent); }

  .sd-company { font-size: 14px; color: var(--text-2); margin-bottom: 10px; }
  .sd-chips { display: flex; gap: 12px; }
  .sd-chip {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-3);
    letter-spacing: 0.04em;
  }

  .sd-price-block { text-align: right; }
  .sd-price {
    font-family: var(--font-mono);
    font-size: 34px;
    font-weight: 700;
    color: var(--text-1);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    line-height: 1;
  }
  .sd-chg-row {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 6px;
  }
  .sd-chg {
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .sd-chg.pos { color: var(--pos); }
  .sd-chg.neg { color: var(--neg); }
  .sd-ccy-note {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-3);
  }

  .sd-divider { height: 1px; background: var(--border); }

  .sd-chart { padding: 20px 0; }
  .sd-chart-label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-3);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 12px;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .sd-live { color: var(--pos); }

  .sd-metrics { padding: 20px 0; }
  .sd-metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px 16px;
  }
  .sd-kv { display: flex; flex-direction: column; gap: 5px; }
  .sd-k {
    font-size: 10px;
    color: var(--text-3);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .sd-v {
    font-family: var(--font-mono);
    font-size: 15px;
    font-weight: 500;
    color: var(--text-1);
    font-variant-numeric: tabular-nums;
  }

  .sd-analyst { padding: 20px 0; }
  .sd-section-label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-3);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 14px;
  }
  .sd-analyst-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .sd-cons {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    flex-shrink: 0;
  }
  .sd-cons.buy  { color: var(--pos); }
  .sd-cons.sell { color: var(--neg); }
  .sd-cons.hold { color: var(--text-2); }
  .sd-bars { display: flex; gap: 2px; flex: 1; height: 3px; }
  .sd-bar  { border-radius: 2px; }
  .sd-analyst-meta { font-size: 11px; color: var(--text-3); line-height: 1.6; }

  @media (max-width: 640px) {
    .sd-price  { font-size: 26px; }
    .sd-ticker { font-size: 20px; }
    .sd-hero-row { flex-direction: column; gap: 12px; }
    .sd-price-block { text-align: left; }
    .sd-chg-row { justify-content: flex-start; }
    .sd-metrics-grid { grid-template-columns: repeat(2, 1fr); }
  }
`;

function AnalystSection({ analyst, sentiment }) {
  if (!analyst?.total) return null;
  const { buy, hold, sell, total, meanTarget, highTarget, lowTarget } = analyst;
  const consensus = buy > hold && buy > sell ? "BUY"
    : sell > buy && sell > hold ? "SELL"
    : "HOLD";
  const consCls = consensus === "BUY" ? "buy" : consensus === "SELL" ? "sell" : "hold";

  return (
    <>
      <div className="sd-divider" />
      <div className="sd-analyst">
        <div className="sd-section-label">Analyst consensus</div>
        <div className="sd-analyst-row">
          <span className={`sd-cons ${consCls}`}>{consensus}</span>
          <div className="sd-bars">
            {buy  > 0 && <div className="sd-bar" style={{ flex: buy,  background: "var(--pos)" }} />}
            {hold > 0 && <div className="sd-bar" style={{ flex: hold, background: "var(--text-3)" }} />}
            {sell > 0 && <div className="sd-bar" style={{ flex: sell, background: "var(--neg)" }} />}
          </div>
          <span className="sd-analyst-meta">{total} analysts</span>
        </div>
        {meanTarget != null && (
          <div className="sd-analyst-meta">
            Target ${fmt(meanTarget, 2)}
            {highTarget && lowTarget && ` · range $${fmt(lowTarget, 2)}–$${fmt(highTarget, 2)}`}
          </div>
        )}
        {sentiment?.bullish != null && (
          <div className="sd-analyst-meta" style={{ marginTop: 4 }}>
            News {Math.round(sentiment.bullish * 100)}% bullish
            {sentiment.articles > 0 && ` · ${sentiment.articles} articles/week`}
          </div>
        )}
      </div>
    </>
  );
}

export default function StockDetail({
  stock: s, onBack, watchlist, onStarClick,
  currency, usdToCadRate,
  candleData, supplementary,
}) {
  if (!s) return null;
  const starred = watchlist.includes(s.ticker);
  const { price: disp, converted } = convertPrice(s.price, s.exchange, currency, usdToCadRate);
  const dec    = disp < 10 ? 3 : 2;
  const chgPos = s.change >= 0;
  const vr     = volRatio(s);
  const ms     = momentumScore(s);

  return (
    <>
      <style>{STYLE}</style>
      <div className="sd-page">
        <div className="sd-container">

          <div className="sd-nav">
            <button className="sd-back" onClick={onBack}>← All stocks</button>
          </div>

          <div className="sd-hero">
            <div className="sd-hero-row">
              <div>
                <div className="sd-ticker-line">
                  <span className="sd-ticker">{s.ticker}</span>
                  <button className={`sd-star ${starred ? "on" : ""}`} onClick={() => onStarClick(s.ticker)}>
                    {starred ? "★" : "☆"}
                  </button>
                </div>
                <div className="sd-company">{s.name}</div>
                <div className="sd-chips">
                  <span className="sd-chip">{s.exchange}</span>
                  <span className="sd-chip">{s.sector}</span>
                </div>
              </div>

              <div className="sd-price-block">
                <div className="sd-price">{converted && "~"}${fmt(disp, dec)}</div>
                <div className="sd-chg-row">
                  <span className={`sd-chg ${chgPos ? "pos" : "neg"}`}>
                    {chgPos ? "+" : ""}{fmt(s.change)}%
                  </span>
                  {converted && <span className="sd-ccy-note">{currency}</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="sd-divider" />

          <div className="sd-chart">
            <div className="sd-chart-label">
              30-day price
              {candleData ? <span className="sd-live">live</span> : <span>simulated</span>}
            </div>
            <AreaChart positive={chgPos} prices={candleData ?? null} width={772} height={140} />
          </div>

          <div className="sd-divider" />

          <div className="sd-metrics">
            <div className="sd-metrics-grid">
              <div className="sd-kv">
                <span className="sd-k">P/E</span>
                <span className="sd-v">{s.pe ? fmt(s.pe, 1) : "—"}</span>
              </div>
              <div className="sd-kv">
                <span className="sd-k">P/B</span>
                <span className="sd-v">{s.pb ? fmt(s.pb, 1) : "—"}</span>
              </div>
              <div className="sd-kv">
                <span className="sd-k">Beta</span>
                <span className="sd-v">{s.beta ? fmt(s.beta) : "—"}</span>
              </div>
              <div className="sd-kv">
                <span className="sd-k">Mkt Cap</span>
                <span className="sd-v">{fmtLarge(s.mktCap)}</span>
              </div>
              <div className="sd-kv">
                <span className="sd-k">EPS Growth</span>
                <span className="sd-v" style={{ color: s.epsGrowth > 0 ? "var(--pos)" : s.epsGrowth < 0 ? "var(--neg)" : "var(--text-1)" }}>
                  {s.epsGrowth != null ? (s.epsGrowth > 0 ? "+" : "") + s.epsGrowth + "%" : "—"}
                </span>
              </div>
              <div className="sd-kv">
                <span className="sd-k">Rev Growth</span>
                <span className="sd-v" style={{ color: s.revGrowth > 0 ? "var(--pos)" : "var(--neg)" }}>
                  {s.revGrowth != null ? (s.revGrowth > 0 ? "+" : "") + s.revGrowth + "%" : "—"}
                </span>
              </div>
              <div className="sd-kv">
                <span className="sd-k">Vol / Avg</span>
                <span className="sd-v" style={{ color: vr > 1.5 ? "var(--accent)" : "var(--text-1)" }}>
                  {fmt(vr, 1)}×
                </span>
              </div>
              <div className="sd-kv">
                <span className="sd-k">Momentum</span>
                <span className="sd-v" style={{ display: "flex", alignItems: "center", paddingTop: 2 }}>
                  <MomentumDots score={ms} size={7} />
                </span>
              </div>
            </div>
          </div>

          <AnalystSection
            analyst={supplementary?.analyst ?? null}
            sentiment={supplementary?.sentiment ?? null}
          />

          <div className="sd-divider" />
          <div style={{ paddingTop: 20 }}>
            <AIInsights
              stock={s}
              analystData={supplementary?.analyst ?? null}
              sentiment={supplementary?.sentiment ?? null}
            />
          </div>

        </div>
      </div>
    </>
  );
}
