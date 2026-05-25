import TVChart      from "./TVChart";
import MomentumDots from "./MomentumDots";
import AIInsights   from "./AIInsights";
import { fmt, fmtLarge, volRatio, momentumScore } from "../data/stocks";
import { convertPrice, calculateTechnicals } from "../data/api";
import { useState } from "react";

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

  .sd-news-item {
    border-top: 1px solid var(--border);
    padding: 10px 0;
  }
  .sd-news-item:first-of-type { border-top: none; padding-top: 0; }
  .sd-news-title {
    font-size: 12px;
    color: var(--text-1);
    line-height: 1.5;
    text-decoration: none;
    display: block;
    margin-bottom: 3px;
  }
  .sd-news-title:hover { color: var(--accent); }
  .sd-news-meta {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-3);
  }

  .sd-expand-btn {
    background: none;
    border: none;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-3);
    cursor: pointer;
    padding: 6px 0 0;
    letter-spacing: 0.04em;
    transition: color 0.1s;
  }
  .sd-expand-btn:hover { color: var(--text-2); }

  @media (max-width: 640px) {
    .sd-price  { font-size: 26px; }
    .sd-ticker { font-size: 20px; }
    .sd-hero-row { flex-direction: column; gap: 12px; }
    .sd-price-block { text-align: left; }
    .sd-chg-row { justify-content: flex-start; }
    .sd-metrics-grid { grid-template-columns: repeat(2, 1fr); }
    /* Orphaned last item in 2-col grid spans both columns to keep symmetry */
    .sd-metrics-grid .sd-kv:last-child:nth-child(odd) {
      grid-column: span 2;
    }
    .sd-container { padding: 0 16px 80px; }
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

function FinancialHealthSection({ fundamentals: f }) {
  if (!f) return null;
  const hasAny = [
    f.forwardPE, f.pegRatio, f.shortRatio, f.shortPctFloat,
    f.currentRatio, f.debtToEquity, f.freeCashFlow,
    f.operatingMargins, f.profitMargins, f.returnOnEquity, f.returnOnAssets,
  ].some(v => v != null);
  if (!hasAny) return null;

  const pct = v => v != null ? `${(v * 100).toFixed(1)}%` : "—";
  const num = (v, dec = 2) => v != null ? fmt(v, dec) : "—";

  return (
    <>
      <div className="sd-divider" />
      <div className="sd-analyst">
        <div className="sd-section-label">Financial Health</div>
        <div className="sd-metrics-grid">
          {f.forwardPE != null && (
            <div className="sd-kv">
              <span className="sd-k">Fwd P/E</span>
              <span className="sd-v">{num(f.forwardPE, 1)}</span>
            </div>
          )}
          {f.pegRatio != null && (
            <div className="sd-kv">
              <span className="sd-k">PEG</span>
              <span className="sd-v">{num(f.pegRatio, 2)}</span>
            </div>
          )}
          {f.currentRatio != null && (
            <div className="sd-kv">
              <span className="sd-k">Current Ratio</span>
              <span className="sd-v">{num(f.currentRatio, 2)}</span>
            </div>
          )}
          {f.debtToEquity != null && (
            <div className="sd-kv">
              <span className="sd-k">D/E</span>
              <span className="sd-v">{num(f.debtToEquity, 2)}</span>
            </div>
          )}
          {f.operatingMargins != null && (
            <div className="sd-kv">
              <span className="sd-k">Op Margin</span>
              <span className="sd-v">{pct(f.operatingMargins)}</span>
            </div>
          )}
          {f.profitMargins != null && (
            <div className="sd-kv">
              <span className="sd-k">Net Margin</span>
              <span className="sd-v">{pct(f.profitMargins)}</span>
            </div>
          )}
          {f.returnOnEquity != null && (
            <div className="sd-kv">
              <span className="sd-k">ROE</span>
              <span className="sd-v">{pct(f.returnOnEquity)}</span>
            </div>
          )}
          {f.returnOnAssets != null && (
            <div className="sd-kv">
              <span className="sd-k">ROA</span>
              <span className="sd-v">{pct(f.returnOnAssets)}</span>
            </div>
          )}
          {f.freeCashFlow != null && (
            <div className="sd-kv">
              <span className="sd-k">Free CF</span>
              <span className="sd-v">{fmtLarge(f.freeCashFlow / 1e9)}</span>
            </div>
          )}
          {f.shortRatio != null && (
            <div className="sd-kv">
              <span className="sd-k">Short Ratio</span>
              <span className="sd-v">{num(f.shortRatio, 1)}</span>
            </div>
          )}
          {f.shortPctFloat != null && (
            <div className="sd-kv">
              <span className="sd-k">Short Float</span>
              <span className="sd-v">{pct(f.shortPctFloat)}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function IncomeStatementSection({ fmp, overview }) {
  if (!fmp && !overview) return null;
  const f = fmp    ?? {};
  const o = overview ?? {};
  const pick = (...vals) => vals.find(v => v != null) ?? null;

  const revenue    = pick(f.revenueAnnual,   o.revenueTTM);
  const netIncome  = f.netIncomeAnnual;
  const grossMgn   = f.grossMargin;
  const eps        = pick(f.epsAnnual,       o.eps);
  const evEbitda   = pick(f.evToEbitda,      o.evToEbitda);
  const ps         = pick(f.psRatio,         o.priceToSales);
  const roic       = f.roic;
  const fwdPE      = pick(f.peRatio,         o.forwardPE);
  const target     = o.analystTarget;
  const opMgn      = o.operatingMargin;
  const profMgn    = o.profitMargin;
  const roe        = o.roe;
  const roa        = o.roa;

  const hasAny = [revenue, netIncome, grossMgn, eps, evEbitda, ps, roic, target, opMgn, profMgn, roe, roa].some(v => v != null);
  if (!hasAny) return null;

  const KV = ({ k, v }) => (
    <div className="sd-kv">
      <span className="sd-k">{k}</span>
      <span className="sd-v">{v}</span>
    </div>
  );

  return (
    <>
      <div className="sd-divider" />
      <div className="sd-analyst">
        <div className="sd-section-label">Income &amp; Valuation</div>
        <div className="sd-metrics-grid">
          {revenue   != null && <KV k="Revenue"      v={`$${fmt(revenue, 1)}B`} />}
          {netIncome != null && <KV k="Net Income"   v={`$${fmt(netIncome, 2)}B`} />}
          {grossMgn  != null && <KV k="Gross Margin" v={`${fmt(grossMgn, 1)}%`} />}
          {eps       != null && <KV k="EPS"          v={`$${fmt(eps, 2)}`} />}
          {opMgn     != null && <KV k="Op Margin"    v={`${fmt(opMgn, 1)}%`} />}
          {profMgn   != null && <KV k="Net Margin"   v={`${fmt(profMgn, 1)}%`} />}
          {roe       != null && <KV k="ROE"          v={`${fmt(roe, 1)}%`} />}
          {roa       != null && <KV k="ROA"          v={`${fmt(roa, 1)}%`} />}
          {evEbitda  != null && <KV k="EV/EBITDA"    v={fmt(evEbitda, 1)} />}
          {ps        != null && <KV k="P/S Ratio"    v={fmt(ps, 2)} />}
          {roic      != null && <KV k="ROIC"         v={`${fmt(roic, 1)}%`} />}
          {fwdPE     != null && <KV k="Fwd P/E"      v={fmt(fwdPE, 1)} />}
          {target    != null && <KV k="Analyst Target" v={`$${fmt(target, 2)}`} />}
        </div>
        {fmp?.earningsHistory?.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-3)", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Quarterly Earnings
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px 12px" }}>
              <span style={{ fontSize: 10, color: "var(--text-3)" }}>Period</span>
              <span style={{ fontSize: 10, color: "var(--text-3)", textAlign: "right" }}>EPS</span>
              <span style={{ fontSize: 10, color: "var(--text-3)", textAlign: "right" }}>Revenue</span>
              {fmp.earningsHistory.map((q, i) => (
                <><span key={`p${i}`} style={{ fontSize: 11, color: "var(--text-2)" }}>{q.period}</span>
                  <span key={`e${i}`} style={{ fontSize: 11, color: "var(--text-1)", textAlign: "right" }}>${fmt(q.eps, 2)}</span>
                  <span key={`r${i}`} style={{ fontSize: 11, color: "var(--text-1)", textAlign: "right" }}>${fmt(q.revenue / 1e9, 1)}B</span>
                </>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function NewsSection({ news }) {
  const [expanded, setExpanded] = useState(false);
  if (!news?.length) return null;
  const visible = expanded ? news : news.slice(0, 3);

  return (
    <>
      <div className="sd-divider" />
      <div className="sd-analyst">
        <div className="sd-section-label">Recent News</div>
        {visible.map((item, i) => (
          <div key={i} className="sd-news-item">
            {item.link ? (
              <a className="sd-news-title" href={item.link} target="_blank" rel="noopener noreferrer">
                {item.title}
              </a>
            ) : (
              <span className="sd-news-title" style={{ cursor: "default" }}>{item.title}</span>
            )}
            <div className="sd-news-meta">
              {item.publisher}
              {item.publishedAt && ` · ${new Date(item.publishedAt * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            </div>
          </div>
        ))}
        {news.length > 3 && (
          <button className="sd-expand-btn" onClick={() => setExpanded(e => !e)}>
            {expanded ? "Show less" : `+${news.length - 3} more`}
          </button>
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

  // Merge data across all sources — first non-null wins
  const pick = (...vals) => vals.find(v => v != null) ?? null;
  const ov  = supplementary?.overview ?? {};
  const fmp = supplementary?.fmp      ?? {};
  const mergedPE      = pick(s.pe,          fmp.peRatio,    ov.peRatio);
  const mergedBeta    = pick(s.beta,         ov.beta);
  const mergedHigh52w = pick(s.high52w,      ov.high52w);
  const mergedLow52w  = pick(s.low52w,       ov.low52w);
  const mergedDivYld  = pick(s.dividendYield, ov.dividendYield);
  const mergedSector  = pick(profile?.sector, s.sector, ov.sector);

  // 52-week range in display currency (use merged values)
  const { price: disp52Low }  = convertPrice(mergedLow52w,  s.exchange, currency, usdToCadRate);
  const { price: disp52High } = convertPrice(mergedHigh52w, s.exchange, currency, usdToCadRate);
  const has52w = disp52Low != null && disp52High != null && disp52High > disp52Low;
  const pct52  = has52w && hasPrice
    ? Math.min(100, Math.max(0, (disp - disp52Low) / (disp52High - disp52Low) * 100))
    : null;

  // Technical indicators from price history
  const techs = calculateTechnicals(candleData);
  const companyName = profile?.companyName ?? s.name;
  const sector      = mergedSector;
  const description = profile?.description ?? ov.description ?? "";

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
                Live Chart
                <span className="sd-live">live</span>
              </div>
            </div>
            <TVChart key={`${s.ticker}-${s.exchange}`} ticker={s.ticker} exchange={s.exchange} />
          </div>

          <div className="sd-divider" />

          <div className="sd-metrics">
            <div className="sd-metrics-grid">
              <div className="sd-kv">
                <span className="sd-k">P/E</span>
                <span className="sd-v">{mergedPE ? fmt(mergedPE, 1) : "—"}</span>
              </div>
              <div className="sd-kv">
                <span className="sd-k">P/B</span>
                <span className="sd-v">{s.pb ? fmt(s.pb, 1) : "—"}</span>
              </div>
              <div className="sd-kv">
                <span className="sd-k">Beta</span>
                <span className="sd-v">{mergedBeta ? fmt(mergedBeta) : "—"}</span>
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
                  {mergedDivYld != null ? `${fmt(mergedDivYld, 2)}%` : "—"}
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
          {(techs.rsi != null || techs.ma50 != null || techs.ma200 != null || techs.macd != null || techs.bbUpper != null) && (
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
                  {techs.macd != null && techs.macdSignal != null && (
                    <div className="sd-kv">
                      <span className="sd-k">MACD</span>
                      <span className="sd-v" style={{ color: techs.macd > techs.macdSignal ? "var(--pos)" : "var(--neg)" }}>
                        {techs.macd > techs.macdSignal ? "▲ " : "▼ "}
                        {fmt(Math.abs(techs.macd - techs.macdSignal), 3)}
                      </span>
                    </div>
                  )}
                  {techs.bbUpper != null && hasPrice && (() => {
                    const bw = techs.bbUpper - techs.bbLower;
                    const pctB = bw > 0 ? +((disp - techs.bbLower) / bw * 100).toFixed(1) : null;
                    return (
                      <>
                        <div className="sd-kv">
                          <span className="sd-k">BB Upper</span>
                          <span className="sd-v">${fmt(techs.bbUpper, 2)}</span>
                        </div>
                        <div className="sd-kv">
                          <span className="sd-k">BB Lower</span>
                          <span className="sd-v">${fmt(techs.bbLower, 2)}</span>
                        </div>
                        {pctB !== null && (
                          <div className="sd-kv">
                            <span className="sd-k">%B</span>
                            <span className="sd-v" style={{
                              color: pctB > 100 ? "var(--neg)" : pctB < 0 ? "var(--pos)" : "var(--text-1)"
                            }}>
                              {pctB.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </>
          )}

          <AnalystSection
            analyst={supplementary?.analyst ?? null}
            sentiment={supplementary?.sentiment ?? null}
          />

          <FinancialHealthSection fundamentals={supplementary?.fundamentals ?? null} />

          <IncomeStatementSection
            fmp={supplementary?.fmp ?? null}
            overview={supplementary?.overview ?? null}
          />

          <NewsSection news={supplementary?.news ?? null} />

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
