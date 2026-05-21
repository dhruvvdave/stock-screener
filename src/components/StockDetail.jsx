import AreaChart    from "./AreaChart";
import MomentumDots from "./MomentumDots";
import AIInsights   from "./AIInsights";
import { fmt, fmtLarge, volRatio, momentumScore } from "../data/stocks";
import { convertPrice, calculateTechnicals } from "../data/api";

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
  .sd-logo {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid var(--border);
    object-fit: cover;
    background: var(--surface-2);
    flex-shrink: 0;
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

  /* 52-week range bar */
  .sd-52w {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 0 2px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
  }
  .sd-52w-track {
    flex: 1;
    height: 2px;
    background: var(--surface-3, rgba(255,255,255,0.08));
    border-radius: 1px;
    position: relative;
  }
  .sd-52w-dot {
    position: absolute;
    top: 50%;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-1);
    transform: translate(-50%, -50%);
  }
  .sd-52w-label {
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .sd-divider { height: 1px; background: var(--border); }

  .sd-chart { padding: 20px 0; }
  .sd-chart-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }
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
    margin-bottom: 0;
  }
  .sd-live { color: var(--pos); }
  .sd-ranges {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .sd-range-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-3);
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: 10px;
    padding: 4px 9px;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: color 0.12s, border-color 0.12s, background 0.12s;
  }
  .sd-range-btn:hover { color: var(--text-2); border-color: var(--border-2); }
  .sd-range-btn.on {
    color: var(--accent);
    border-color: rgba(232, 160, 32, 0.35);
    background: rgba(232, 160, 32, 0.08);
  }

  .sd-desc {
    padding-top: 14px;
    color: var(--text-2);
    font-size: 13px;
    line-height: 1.6;
    max-width: 72ch;
  }

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

function fmtEarnings(ts) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  const diff = d.getTime() - Date.now();
  if (diff < -30 * 86400000 || diff > 180 * 86400000) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

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
  profile, chartRange, onChartRangeChange,
}) {
  if (!s) return null;
  const starred = watchlist.includes(s.ticker);
  const { price: disp, converted } = convertPrice(s.price, s.exchange, currency, usdToCadRate);
  const hasPrice = typeof disp === "number";
  const hasChg   = typeof s.change === "number";
  const dec    = hasPrice && disp < 10 ? 3 : 2;
  const chgPos = hasChg && s.change >= 0;
  const vr     = volRatio(s);
  const ms     = momentumScore(s);

  // 52-week range in display currency
  const { price: disp52Low }  = convertPrice(s.low52w,  s.exchange, currency, usdToCadRate);
  const { price: disp52High } = convertPrice(s.high52w, s.exchange, currency, usdToCadRate);
  const has52w = disp52Low != null && disp52High != null && disp52High > disp52Low;
  const pct52  = has52w && hasPrice
    ? Math.min(100, Math.max(0, (disp - disp52Low) / (disp52High - disp52Low) * 100))
    : null;

  // Technical indicators from 1-year price history
  const techs = calculateTechnicals(candleData);
  const chartLabel = { "1mo": "1-month price", "3mo": "3-month price", "6mo": "6-month price", "1y": "1-year price" }[chartRange] ?? "Price";
  const companyName = profile?.companyName ?? s.name;
  const sector = profile?.sector ?? s.sector;
  const description = profile?.description ?? "";

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
                  {profile?.logo && <img className="sd-logo" src={profile.logo} alt={`${s.ticker} logo`} />}
                  <span className="sd-ticker">{s.ticker}</span>
                  <button className={`sd-star ${starred ? "on" : ""}`} onClick={() => onStarClick(s.ticker)}>
                    {starred ? "★" : "☆"}
                  </button>
                </div>
                <div className="sd-company">{companyName}</div>
                <div className="sd-chips">
                  <span className="sd-chip">{s.exchange}</span>
                  <span className="sd-chip">{sector}</span>
                </div>
              </div>

              <div className="sd-price-block">
                <div className="sd-price">{hasPrice ? `${converted ? "~" : ""}$${fmt(disp, dec)}` : "—"}</div>
                <div className="sd-chg-row">
                  <span className={`sd-chg ${hasChg ? (chgPos ? "pos" : "neg") : ""}`}>
                    {hasChg ? `${chgPos ? "+" : ""}${fmt(s.change)}%` : "—"}
                  </span>
                  {converted && <span className="sd-ccy-note">{currency}</span>}
                </div>
              </div>
            </div>

            {/* 52-week range bar */}
            {has52w && (
              <div className="sd-52w">
                <span>${fmt(disp52Low, dec)}</span>
                <div className="sd-52w-track">
                  {pct52 !== null && (
                    <div className="sd-52w-dot" style={{ left: `${pct52.toFixed(1)}%` }} />
                  )}
                </div>
                <span>${fmt(disp52High, dec)}</span>
                <span className="sd-52w-label">52W</span>
              </div>
            )}
            {description && <p className="sd-desc">{description}</p>}
          </div>

          <div className="sd-divider" />

          <div className="sd-chart">
            <div className="sd-chart-top">
              <div className="sd-chart-label">
                {chartLabel}
                {candleData ? <span className="sd-live">live</span> : <span>unavailable</span>}
              </div>
              <div className="sd-ranges">
                {["1mo", "3mo", "6mo", "1y"].map((range) => (
                  <button
                    key={range}
                    className={`sd-range-btn ${chartRange === range ? "on" : ""}`}
                    onClick={() => onChartRangeChange(range)}
                  >
                    {range}
                  </button>
                ))}
              </div>
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
                <span className="sd-v" style={{ color: s.revGrowth > 0 ? "var(--pos)" : s.revGrowth != null ? "var(--neg)" : "var(--text-1)" }}>
                  {s.revGrowth != null ? (s.revGrowth > 0 ? "+" : "") + s.revGrowth + "%" : "—"}
                </span>
              </div>
              <div className="sd-kv">
                <span className="sd-k">Vol / Avg</span>
                <span className="sd-v" style={{ color: vr !== null && vr !== undefined && vr > 1.5 ? "var(--accent)" : "var(--text-1)" }}>
                  {vr !== null && vr !== undefined ? `${fmt(vr, 1)}×` : "—"}
                </span>
              </div>
              <div className="sd-kv">
                <span className="sd-k">Momentum</span>
                <span className="sd-v" style={{ display: "flex", alignItems: "center", paddingTop: 2 }}>
                  <MomentumDots score={ms} size={7} />
                </span>
              </div>
              <div className="sd-kv">
                <span className="sd-k">Div Yield</span>
                <span className="sd-v">
                  {s.dividendYield != null ? `${fmt(s.dividendYield, 2)}%` : "—"}
                </span>
              </div>
              <div className="sd-kv">
                <span className="sd-k">Earnings</span>
                <span className="sd-v" style={{ fontSize: 13 }}>
                  {fmtEarnings(s.earningsDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Technical indicators */}
          {(techs.rsi != null || techs.ma50 != null || techs.ma200 != null) && (
            <>
              <div className="sd-divider" />
              <div className="sd-analyst">
                <div className="sd-section-label">Technicals</div>
                <div className="sd-metrics-grid">
                  {techs.rsi != null && (
                    <div className="sd-kv">
                      <span className="sd-k">RSI (14)</span>
                      <span className="sd-v" style={{
                        color: techs.rsi < 30 ? "var(--pos)"
                             : techs.rsi > 70 ? "var(--neg)"
                             : "var(--text-1)",
                      }}>
                        {techs.rsi}
                        {techs.rsi < 30 ? " OS" : techs.rsi > 70 ? " OB" : ""}
                      </span>
                    </div>
                  )}
                  {techs.ma50 != null && hasPrice && (() => {
                    const pct = ((disp - techs.ma50) / techs.ma50 * 100);
                    return (
                      <div className="sd-kv">
                        <span className="sd-k">vs MA50</span>
                        <span className="sd-v" style={{ color: pct >= 0 ? "var(--pos)" : "var(--neg)" }}>
                          {pct >= 0 ? "▲ " : "▼ "}{fmt(Math.abs(pct), 1)}%
                        </span>
                      </div>
                    );
                  })()}
                  {techs.ma200 != null && hasPrice && (() => {
                    const pct = ((disp - techs.ma200) / techs.ma200 * 100);
                    const cross = techs.ma50 != null
                      ? (techs.ma50 > techs.ma200 ? " ✦" : " ✕")
                      : "";
                    return (
                      <div className="sd-kv">
                        <span className="sd-k">vs MA200</span>
                        <span className="sd-v" style={{ color: pct >= 0 ? "var(--pos)" : "var(--neg)" }}>
                          {pct >= 0 ? "▲ " : "▼ "}{fmt(Math.abs(pct), 1)}%{cross}
                        </span>
                      </div>
                    );
                  })()}
                  {techs.ma50 != null && (
                    <div className="sd-kv">
                      <span className="sd-k">MA50</span>
                      <span className="sd-v">${fmt(techs.ma50, 2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

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
