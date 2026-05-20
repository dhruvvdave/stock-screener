import AreaChart    from "./AreaChart";
import MomentumDots from "./MomentumDots";
import AIInsights   from "./AIInsights";
import { fmt, fmtLarge, fmtVol, volRatio, momentumScore } from "../data/stocks";
import { convertPrice } from "../data/api";

const STYLE = `
  .sd-page {
    min-height: calc(100svh - 48px);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .sd-container {
    max-width: 880px;
    margin: 0 auto;
    padding: 0 24px 80px;
    width: 100%;
  }

  /* Back nav */
  .sd-nav {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 24px 0 0;
    margin-bottom: 0;
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
    transition: color 0.1s;
    touch-action: manipulation;
  }
  .sd-back:hover { color: var(--text-1); }
  .sd-crumb {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    letter-spacing: 0.04em;
  }

  /* Hero */
  .sd-hero {
    padding: 28px 0 36px;
    border-bottom: 1px solid var(--border);
  }
  .sd-hero-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    flex-wrap: wrap;
  }

  .sd-hero-left { min-width: 0; }
  .sd-ticker-line {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
  }
  .sd-ticker {
    font-family: var(--font-mono);
    font-size: 28px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: 0.02em;
    line-height: 1;
  }
  .sd-star {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: var(--text-3);
    padding: 2px 4px;
    line-height: 1;
    transition: color 0.1s;
    touch-action: manipulation;
  }
  .sd-star.on  { color: var(--accent); }
  .sd-star:hover { color: var(--accent); }

  .sd-company {
    font-size: 15px;
    color: var(--text-2);
    margin-bottom: 12px;
    font-weight: 400;
  }
  .sd-chips { display: flex; gap: 14px; }
  .sd-chip {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    letter-spacing: 0.04em;
  }

  .sd-hero-right { flex-shrink: 0; text-align: right; }
  .sd-price-row {
    display: flex;
    align-items: baseline;
    gap: 12px;
    justify-content: flex-end;
    flex-wrap: wrap;
  }
  .sd-price {
    font-family: var(--font-mono);
    font-size: 38px;
    font-weight: 700;
    color: var(--text-1);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    line-height: 1;
  }
  .sd-chg {
    font-family: var(--font-mono);
    font-size: 17px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .sd-chg.pos { color: var(--pos); }
  .sd-chg.neg { color: var(--neg); }
  .sd-ccy-note {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    margin-top: 4px;
  }

  /* Chart */
  .sd-chart { padding: 28px 0 0; }
  .sd-chart-hd {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-3);
    letter-spacing: 0.10em;
    text-transform: uppercase;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sd-live { font-size: 9px; color: var(--pos); letter-spacing: 0.04em; }
  .sd-sim  { font-size: 9px; color: var(--text-3); }

  /* Sections */
  .sd-section { padding: 28px 0 0; }
  .sd-section-hd {
    font-size: 9px;
    font-weight: 600;
    color: var(--text-3);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 18px;
  }

  /* Metrics grid */
  .sd-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 22px 28px;
    padding-bottom: 4px;
  }
  .sd-kv { display: flex; flex-direction: column; gap: 5px; }
  .sd-k {
    font-size: 11px;
    color: var(--text-3);
    line-height: 1.3;
  }
  .sd-v {
    font-family: var(--font-mono);
    font-size: 15px;
    font-weight: 500;
    color: var(--text-1);
    font-variant-numeric: tabular-nums;
  }

  /* Analyst */
  .sd-analyst-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .sd-cons {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    flex-shrink: 0;
  }
  .sd-cons.buy  { color: var(--pos); }
  .sd-cons.sell { color: var(--neg); }
  .sd-cons.hold { color: var(--text-2); }
  .sd-bars { display: flex; gap: 2px; flex: 1; height: 3px; }
  .sd-bar  { border-radius: 2px; }
  .sd-analyst-meta {
    font-size: 11px;
    color: var(--text-3);
    line-height: 1.6;
  }

  @media (max-width: 640px) {
    .sd-price  { font-size: 28px; }
    .sd-ticker { font-size: 22px; }
    .sd-chg    { font-size: 14px; }
    .sd-hero-row { flex-direction: column; gap: 16px; }
    .sd-hero-right { text-align: left; }
    .sd-price-row  { justify-content: flex-start; }
    .sd-grid { grid-template-columns: 1fr 1fr; }
  }
`;

function pClr(v, med) {
  return v == null || med == null ? "var(--text-1)" : v < med ? "var(--pos)" : "var(--neg)";
}

function AnalystSection({ analyst, sentiment }) {
  if (!analyst?.total) return null;
  const { buy, hold, sell, total, meanTarget, highTarget, lowTarget } = analyst;
  const consensus = buy > hold && buy > sell ? "BUY"
    : sell > buy  && sell > hold ? "SELL"
    : "HOLD";
  const consCls = consensus === "BUY" ? "buy" : consensus === "SELL" ? "sell" : "hold";

  return (
    <div className="sd-section">
      <div className="sd-section-hd">Analyst Consensus</div>
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
  );
}

export default function StockDetail({
  stock: s, onBack, watchlist, onStarClick,
  currency, usdToCadRate, sectorMedians,
  candleData, supplementary,
}) {
  if (!s) return null;
  const starred  = watchlist.includes(s.ticker);
  const { price: disp, converted } = convertPrice(s.price, s.exchange, currency, usdToCadRate);
  const dec      = disp < 10 ? 3 : 2;
  const chgPos   = s.change >= 0;
  const vr       = volRatio(s);
  const ms       = momentumScore(s);
  const med      = sectorMedians[s.sector] ?? {};

  return (
    <>
      <style>{STYLE}</style>
      <div className="sd-page">
        <div className="sd-container">

          {/* Back nav */}
          <div className="sd-nav">
            <button className="sd-back" onClick={onBack}>← All stocks</button>
            <span className="sd-crumb">/ {s.ticker}</span>
          </div>

          {/* Hero */}
          <div className="sd-hero">
            <div className="sd-hero-row">
              <div className="sd-hero-left">
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

              <div className="sd-hero-right">
                <div className="sd-price-row">
                  <span className="sd-price">{converted && "~"}${fmt(disp, dec)}</span>
                  <span className={`sd-chg ${chgPos ? "pos" : "neg"}`}>
                    {chgPos ? "+" : ""}{fmt(s.change)}%
                  </span>
                </div>
                {converted && <div className="sd-ccy-note">converted to {currency}</div>}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="sd-chart">
            <div className="sd-chart-hd">
              30-day price
              {candleData
                ? <span className="sd-live">live</span>
                : <span className="sd-sim">simulated</span>}
            </div>
            <AreaChart positive={chgPos} prices={candleData ?? null} width={832} height={160} />
          </div>

          {/* Valuation */}
          <div className="sd-section">
            <div className="sd-section-hd">Valuation</div>
            <div className="sd-grid">
              <div className="sd-kv">
                <span className="sd-k">P/E Ratio</span>
                <span className="sd-v" style={{ color: pClr(s.pe, med.pe) }}>
                  {s.pe ? fmt(s.pe, 1) : "—"}
                </span>
              </div>
              <div className="sd-kv">
                <span className="sd-k">Sector P/E</span>
                <span className="sd-v" style={{ color: "var(--text-2)" }}>
                  {med.pe ? fmt(med.pe, 1) : "—"}
                </span>
              </div>
              <div className="sd-kv">
                <span className="sd-k">P/B Ratio</span>
                <span className="sd-v" style={{ color: pClr(s.pb, med.pb) }}>
                  {fmt(s.pb, 1)}
                </span>
              </div>
              <div className="sd-kv">
                <span className="sd-k">Beta</span>
                <span className="sd-v">{fmt(s.beta)}</span>
              </div>
            </div>
          </div>

          {/* Growth */}
          <div className="sd-section">
            <div className="sd-section-hd">Growth</div>
            <div className="sd-grid">
              <div className="sd-kv">
                <span className="sd-k">EPS Growth</span>
                <span className="sd-v" style={{ color: s.epsGrowth > 0 ? "var(--pos)" : s.epsGrowth < 0 ? "var(--neg)" : "var(--text-2)" }}>
                  {s.epsGrowth != null ? (s.epsGrowth > 0 ? "+" : "") + s.epsGrowth + "%" : "—"}
                </span>
              </div>
              <div className="sd-kv">
                <span className="sd-k">Revenue Growth</span>
                <span className="sd-v" style={{ color: s.revGrowth > 0 ? "var(--pos)" : "var(--neg)" }}>
                  {s.revGrowth > 0 ? "+" : ""}{s.revGrowth}%
                </span>
              </div>
            </div>
          </div>

          {/* Volume & Momentum */}
          <div className="sd-section">
            <div className="sd-section-hd">Volume & Momentum</div>
            <div className="sd-grid">
              <div className="sd-kv">
                <span className="sd-k">Today's volume</span>
                <span className="sd-v">{fmtVol(s.vol)}</span>
              </div>
              <div className="sd-kv">
                <span className="sd-k">Avg daily vol</span>
                <span className="sd-v">{fmtVol(s.avgVol)}</span>
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

          {/* Size */}
          <div className="sd-section">
            <div className="sd-section-hd">Size</div>
            <div className="sd-grid">
              <div className="sd-kv">
                <span className="sd-k">Market cap</span>
                <span className="sd-v">{fmtLarge(s.mktCap)}</span>
              </div>
              <div className="sd-kv">
                <span className="sd-k">Exchange</span>
                <span className="sd-v" style={{ color: "var(--text-2)" }}>{s.exchange}</span>
              </div>
            </div>
          </div>

          {/* Analyst */}
          <AnalystSection
            analyst={supplementary?.analyst ?? null}
            sentiment={supplementary?.sentiment ?? null}
          />

          {/* AI */}
          <div className="sd-section">
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
