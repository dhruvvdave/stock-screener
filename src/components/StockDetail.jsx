import TVChart      from "./TVChart";
import MomentumDots from "./MomentumDots";
import AIInsights   from "./AIInsights";
import { fmt, fmtLarge, volRatio, momentumScore } from "../data/stocks";
import { convertPrice, calculateTechnicals } from "../data/api";
import { useState } from "react";

function fmtEarnings(ts) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  const diff = d.getTime() - Date.now();
  if (diff < -30 * 86400000 || diff > 180 * 86400000) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function AnalystSection({ analyst, sentiment, loading }) {
  if (loading && !analyst) {
    return (
      <>
        <div className="sd-divider" />
        <div className="sd-analyst">
          <div className="sd-section-label">Analyst consensus</div>
          <div className="sd-skel sd-skel-sm" />
          <div className="sd-skel sd-skel-lg" />
          <div className="sd-skel sd-skel-md" />
        </div>
      </>
    );
  }
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
          <div style={{ flex: 1 }}>
            <div className="sd-bar-counts">
              <span>{buy} buy</span>
              <span>{hold} hold</span>
              <span>{sell} sell</span>
            </div>
            <div className="sd-bars">
              <div className="sd-bar sd-bar-buy"  style={{ flex: buy  > 0 ? buy  : 0.15 }} />
              <div className="sd-bar sd-bar-hold" style={{ flex: hold > 0 ? hold : 0.15 }} />
              <div className="sd-bar sd-bar-sell" style={{ flex: sell > 0 ? sell : 0.15 }} />
            </div>
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
          <div className="sd-analyst-meta">
            News {Math.round(sentiment.bullish * 100)}% bullish
            {sentiment.articles > 0 && ` · ${sentiment.articles} articles/week`}
          </div>
        )}
      </div>
    </>
  );
}

function FinancialHealthSection({ fundamentals: f, loading }) {
  if (loading && !f) {
    return (
      <>
        <div className="sd-divider" />
        <div className="sd-analyst">
          <div className="sd-section-label">Financial Health</div>
          <div className="sd-metrics-grid">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="sd-kv">
                <div className="sd-skel" style={{ width: 50, animationDelay: `${i * 40}ms` }} />
                <div className="sd-skel sd-skel-lg" style={{ animationDelay: `${i * 40 + 20}ms` }} />
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }
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
          {f.forwardPE    != null && <div className="sd-kv"><span className="sd-k">Fwd P/E</span><span className="sd-v">{num(f.forwardPE, 1)}</span></div>}
          {f.pegRatio     != null && <div className="sd-kv"><span className="sd-k">PEG</span><span className="sd-v">{num(f.pegRatio, 2)}</span></div>}
          {f.currentRatio != null && <div className="sd-kv"><span className="sd-k">Current Ratio</span><span className="sd-v">{num(f.currentRatio, 2)}</span></div>}
          {f.debtToEquity != null && <div className="sd-kv"><span className="sd-k">D/E</span><span className="sd-v">{num(f.debtToEquity, 2)}</span></div>}
          {f.operatingMargins != null && <div className="sd-kv"><span className="sd-k">Op Margin</span><span className="sd-v">{pct(f.operatingMargins)}</span></div>}
          {f.profitMargins    != null && <div className="sd-kv"><span className="sd-k">Net Margin</span><span className="sd-v">{pct(f.profitMargins)}</span></div>}
          {f.returnOnEquity   != null && <div className="sd-kv"><span className="sd-k">ROE</span><span className="sd-v">{pct(f.returnOnEquity)}</span></div>}
          {f.returnOnAssets   != null && <div className="sd-kv"><span className="sd-k">ROA</span><span className="sd-v">{pct(f.returnOnAssets)}</span></div>}
          {f.freeCashFlow     != null && <div className="sd-kv"><span className="sd-k">Free CF</span><span className="sd-v">{fmtLarge(f.freeCashFlow / 1e9)}</span></div>}
          {f.shortRatio       != null && <div className="sd-kv"><span className="sd-k">Short Ratio</span><span className="sd-v">{num(f.shortRatio, 1)}</span></div>}
          {f.shortPctFloat    != null && <div className="sd-kv"><span className="sd-k">Short Float</span><span className="sd-v">{pct(f.shortPctFloat)}</span></div>}
        </div>
      </div>
    </>
  );
}

function IncomeStatementSection({ fmp, overview, loading }) {
  if (loading && !fmp && !overview) {
    return (
      <>
        <div className="sd-divider" />
        <div className="sd-analyst">
          <div className="sd-section-label">Income &amp; Valuation</div>
          <div className="sd-metrics-grid">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="sd-kv">
                <div className="sd-skel" style={{ width: 55, animationDelay: `${i * 35}ms` }} />
                <div className="sd-skel sd-skel-lg" style={{ animationDelay: `${i * 35 + 15}ms` }} />
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }
  if (!fmp && !overview) return null;
  const f = fmp      ?? {};
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
    <div className="sd-kv"><span className="sd-k">{k}</span><span className="sd-v">{v}</span></div>
  );

  return (
    <>
      <div className="sd-divider" />
      <div className="sd-analyst">
        <div className="sd-section-label">Income &amp; Valuation</div>
        <div className="sd-metrics-grid">
          {revenue    != null && <KV k="Revenue"        v={`$${fmt(revenue, 1)}B`} />}
          {netIncome  != null && <KV k="Net Income"     v={`$${fmt(netIncome, 2)}B`} />}
          {grossMgn   != null && <KV k="Gross Margin"   v={`${fmt(grossMgn, 1)}%`} />}
          {eps        != null && <KV k="EPS"            v={`$${fmt(eps, 2)}`} />}
          {opMgn      != null && <KV k="Op Margin"      v={`${fmt(opMgn, 1)}%`} />}
          {profMgn    != null && <KV k="Net Margin"     v={`${fmt(profMgn, 1)}%`} />}
          {roe        != null && <KV k="ROE"            v={`${fmt(roe, 1)}%`} />}
          {roa        != null && <KV k="ROA"            v={`${fmt(roa, 1)}%`} />}
          {evEbitda   != null && <KV k="EV/EBITDA"      v={fmt(evEbitda, 1)} />}
          {ps         != null && <KV k="P/S Ratio"      v={fmt(ps, 2)} />}
          {roic       != null && <KV k="ROIC"           v={`${fmt(roic, 1)}%`} />}
          {fwdPE      != null && <KV k="Fwd P/E"        v={fmt(fwdPE, 1)} />}
          {target     != null && <KV k="Analyst Target" v={`$${fmt(target, 2)}`} />}
        </div>
        {fmp?.earningsHistory?.length > 0 && (
          <div className="sd-earn-section">
            <div className="sd-earn-title">Quarterly Earnings</div>
            <div className="sd-earn-grid">
              <span className="sd-earn-hd">Period</span>
              <span className="sd-earn-hd right">EPS</span>
              <span className="sd-earn-hd right">Revenue</span>
              {fmp.earningsHistory.map((q, i) => (
                <>
                  <span key={`p${i}`} className="sd-earn-period">{q.period}</span>
                  <span key={`e${i}`} className="sd-earn-val">${fmt(q.eps, 2)}</span>
                  <span key={`r${i}`} className="sd-earn-val">${fmt(q.revenue / 1e9, 1)}B</span>
                </>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function NewsSection({ news, loading }) {
  const [expanded, setExpanded] = useState(false);
  if (loading && !news) {
    return (
      <>
        <div className="sd-divider" />
        <div className="sd-analyst">
          <div className="sd-section-label">Recent News</div>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="sd-news-item">
              <div className="sd-skel sd-skel-lg" style={{ animationDelay: `${i * 60}ms` }} />
              <div className="sd-skel sd-skel-sm" style={{ animationDelay: `${i * 60 + 20}ms` }} />
            </div>
          ))}
        </div>
      </>
    );
  }
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
            {expanded ? "Show less ↑" : `Show ${news.length - 3} more articles ↓`}
          </button>
        )}
      </div>
    </>
  );
}

export default function StockDetail({
  stock: s, onBack, watchlist, onStarClick,
  currency, usdToCadRate,
  candleData, supplementary, supplementaryLoading,
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

  const pick = (...vals) => vals.find(v => v != null) ?? null;
  const ov  = supplementary?.overview ?? {};
  const fmp = supplementary?.fmp      ?? {};
  const mergedPE      = pick(s.pe,           fmp.peRatio,    ov.peRatio);
  const mergedBeta    = pick(s.beta,          ov.beta);
  const mergedHigh52w = pick(s.high52w,       ov.high52w);
  const mergedLow52w  = pick(s.low52w,        ov.low52w);
  const mergedDivYld  = pick(s.dividendYield, ov.dividendYield);
  const mergedSector  = pick(profile?.sector, s.sector, ov.sector);

  const { price: disp52Low }  = convertPrice(mergedLow52w,  s.exchange, currency, usdToCadRate);
  const { price: disp52High } = convertPrice(mergedHigh52w, s.exchange, currency, usdToCadRate);
  const has52w = disp52Low != null && disp52High != null && disp52High > disp52Low;
  const pct52  = has52w && hasPrice
    ? Math.min(100, Math.max(0, (disp - disp52Low) / (disp52High - disp52Low) * 100))
    : null;

  const techs = calculateTechnicals(candleData);
  const hasAnyTechs = techs.rsi != null || techs.ma50 != null || techs.ma200 != null || techs.macd != null || techs.bbUpper != null;
  const companyName = profile?.companyName ?? s.name;
  const sector      = mergedSector;
  const description = profile?.description ?? ov.description ?? "";
  const chartSource = candleData?.source;

  return (
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
                <button
                  className={`sd-star ${starred ? "on" : ""}`}
                  onClick={() => onStarClick(s.ticker)}
                  aria-label={`${starred ? "Remove from" : "Add to"} watchlist`}
                >
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
              {chartSource && chartSource !== "finnhub" && (
                <span className="sd-chart-source">via {chartSource}</span>
              )}
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
              <span className={`sd-v ${s.epsGrowth > 0 ? "pos" : s.epsGrowth < 0 ? "neg" : ""}`}>
                {s.epsGrowth != null ? (s.epsGrowth > 0 ? "+" : "") + s.epsGrowth + "%" : "—"}
              </span>
            </div>
            <div className="sd-kv">
              <span className="sd-k">Rev Growth</span>
              <span className={`sd-v ${s.revGrowth > 0 ? "pos" : s.revGrowth != null ? "neg" : ""}`}>
                {s.revGrowth != null ? (s.revGrowth > 0 ? "+" : "") + s.revGrowth + "%" : "—"}
              </span>
            </div>
            <div className="sd-kv">
              <span className="sd-k">Vol / Avg</span>
              <span className={`sd-v ${vr != null && vr > 1.5 ? "c-accent" : ""}`}>
                {vr != null ? `${fmt(vr, 1)}×` : "—"}
              </span>
            </div>
            <div className="sd-kv">
              <span className="sd-k">Momentum</span>
              <span className="sd-v-flex">
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
        {candleData?.prices?.length > 0 && (
          <>
            <div className="sd-divider" />
            <div className="sd-analyst">
              <div className="sd-section-label">Technicals</div>
              {hasAnyTechs ? (
                <div className="sd-metrics-grid">
                  {techs.rsi != null && (
                    <div className="sd-kv">
                      <span className="sd-k">RSI (14)</span>
                      <span className={`sd-v ${techs.rsi < 30 ? "pos" : techs.rsi > 70 ? "neg" : ""}`}>
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
                        <span className={`sd-v ${pct >= 0 ? "pos" : "neg"}`}>
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
                        <span className={`sd-v ${pct >= 0 ? "pos" : "neg"}`}>
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
                      <span className={`sd-v ${techs.macd > techs.macdSignal ? "pos" : "neg"}`}>
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
                            <span className={`sd-v ${pctB > 100 ? "neg" : pctB < 0 ? "pos" : ""}`}>
                              {pctB.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <p className="sd-insuf">Not enough price history for indicators.</p>
              )}
            </div>
          </>
        )}

        <AnalystSection
          analyst={supplementary?.analyst ?? null}
          sentiment={supplementary?.sentiment ?? null}
          loading={supplementaryLoading}
        />

        <FinancialHealthSection
          fundamentals={supplementary?.fundamentals ?? null}
          loading={supplementaryLoading}
        />

        <IncomeStatementSection
          fmp={supplementary?.fmp ?? null}
          overview={supplementary?.overview ?? null}
          loading={supplementaryLoading}
        />

        <NewsSection
          news={supplementary?.news ?? null}
          loading={supplementaryLoading}
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
  );
}
