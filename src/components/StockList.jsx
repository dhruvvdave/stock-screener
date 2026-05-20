import { useState, useEffect, useRef } from "react";
import { fmt, fmtLarge } from "../data/stocks";
import { convertPrice } from "../data/api";

const STYLE = `
  .sl-page {
    min-height: calc(100svh - 48px);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .sl-container {
    max-width: 880px;
    margin: 0 auto;
    padding: 0 24px 80px;
    width: 100%;
  }

  /* Hero */
  .sl-hero {
    position: relative;
    padding: 80px 0 44px;
    text-align: left;
  }
  .sl-hero::before {
    content: '';
    position: fixed;
    top: -100px;
    left: 50%;
    transform: translateX(-50%);
    width: 800px;
    height: 600px;
    border-radius: 50%;
    background: radial-gradient(ellipse at center, rgba(255,255,255,0.04) 0%, transparent 65%);
    pointer-events: none;
    z-index: 0;
  }

  .sl-brand {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    color: var(--accent);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin-bottom: 16px;
    position: relative;
    z-index: 1;
  }

  .sl-title {
    font-family: var(--font-ui);
    font-size: clamp(36px, 6vw, 56px);
    font-weight: 700;
    color: var(--text-1);
    line-height: 1.08;
    letter-spacing: -0.025em;
    margin-bottom: 36px;
    position: relative;
    z-index: 1;
  }

  .sl-cursor {
    color: var(--text-3);
    animation: sl-blink 1s step-end infinite;
  }
  @keyframes sl-blink { 0%,100%{opacity:1} 50%{opacity:0} }

  /* Search pill */
  .sl-pill-wrap {
    position: relative;
    max-width: 540px;
    z-index: 1;
  }
  .sl-pill {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    background: rgba(255,255,255,0.045);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 100px;
    height: 52px;
    padding: 0 8px 0 20px;
    transition: border-color 0.2s;
  }
  .sl-pill:focus-within {
    border-color: rgba(255,255,255,0.18);
  }
  .sl-pill-icon {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--text-3);
    user-select: none;
    flex-shrink: 0;
  }
  .sl-pill-input {
    flex: 1;
    background: none;
    border: none;
    color: var(--text-1);
    font-family: var(--font-ui);
    font-size: 15px;
    outline: none;
  }
  .sl-pill-input::placeholder { color: var(--text-3); }
  .sl-pill-clear {
    background: none;
    border: none;
    color: var(--text-3);
    font-size: 14px;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 100px;
    line-height: 1;
    transition: color 0.1s;
    flex-shrink: 0;
  }
  .sl-pill-clear:hover { color: var(--text-1); }

  .sl-hint {
    margin-top: 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    letter-spacing: 0.02em;
    z-index: 1;
    position: relative;
  }

  /* List */
  .sl-list { width: 100%; }

  .sl-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 13px 10px;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    border-radius: 6px;
    margin: 0 -10px;
    transition: background 0.08s;
  }
  .sl-row:hover { background: rgba(255,255,255,0.028); }

  .sl-row-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    flex: 1;
  }
  .sl-ticker {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--accent);
    letter-spacing: 0.04em;
    min-width: 64px;
    flex-shrink: 0;
  }
  .sl-name {
    font-size: 13px;
    color: var(--text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sl-exch {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-3);
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .sl-row-right {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-shrink: 0;
  }
  .sl-price {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 500;
    color: var(--text-1);
    font-variant-numeric: tabular-nums;
    min-width: 66px;
    text-align: right;
  }
  .sl-chg {
    font-family: var(--font-mono);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    min-width: 54px;
    text-align: right;
  }
  .sl-chg.pos { color: var(--pos); }
  .sl-chg.neg { color: var(--neg); }
  .sl-cap {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
    min-width: 56px;
    text-align: right;
  }
  .sl-star {
    background: none;
    border: none;
    font-size: 13px;
    cursor: pointer;
    padding: 2px 4px;
    line-height: 1;
    transition: color 0.1s;
    touch-action: manipulation;
    flex-shrink: 0;
  }
  .sl-star.on  { color: var(--accent); }
  .sl-star.off { color: var(--text-3); }
  .sl-star.off:hover { color: var(--accent); }

  .sl-empty {
    padding: 48px 0;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-3);
    text-align: center;
  }

  /* Skeleton */
  @keyframes sl-pulse { 0%,100%{opacity:0.25} 50%{opacity:0.5} }
  .sl-skel-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 13px 10px;
    border-bottom: 1px solid var(--border);
  }
  .sl-skel-bar {
    height: 10px;
    border-radius: 3px;
    background: var(--surface-3);
    animation: sl-pulse 1.6s ease-in-out infinite;
  }

  @media (max-width: 640px) {
    .sl-hero { padding: 52px 0 32px; }
    .sl-name { max-width: 130px; }
    .sl-cap  { display: none; }
    .sl-exch { display: none; }
  }
`;

function SkeletonList() {
  return Array.from({ length: 14 }, (_, i) => (
    <div key={i} className="sl-skel-row">
      <div style={{ display: "flex", gap: 12, flex: 1, alignItems: "center" }}>
        <div className="sl-skel-bar" style={{ width: 44, animationDelay: `${i * 35}ms` }} />
        <div className="sl-skel-bar" style={{ width: 90 + (i % 4) * 30, animationDelay: `${i * 35 + 15}ms` }} />
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        <div className="sl-skel-bar" style={{ width: 58, animationDelay: `${i * 35 + 30}ms` }} />
        <div className="sl-skel-bar" style={{ width: 44, animationDelay: `${i * 35 + 45}ms` }} />
      </div>
    </div>
  ));
}

export default function StockList({
  stocks, watchlist, onStarClick, onSelect,
  currency, usdToCadRate, quotesLoading, quotesLive,
  clock, onCurrencyToggle,
}) {
  const [search, setSearch] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const q = search.trim().toUpperCase();
  const filtered = q
    ? stocks.filter(s => s.ticker.includes(q) || s.name.toLowerCase().includes(search.trim().toLowerCase()))
    : stocks;

  return (
    <>
      <style>{STYLE}</style>
      <div className="sl-page">
        <div className="sl-container">
          <div className="sl-hero">
            <div className="sl-brand">MKTSCAN / PRO</div>
            <h1 className="sl-title">
              Stock lookup<span className="sl-cursor">_</span>
            </h1>
            <div className="sl-pill-wrap">
              <div className="sl-pill">
                <span className="sl-pill-icon">/</span>
                <input
                  ref={inputRef}
                  className="sl-pill-input"
                  type="text"
                  placeholder="Ticker or company name…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoComplete="off"
                  spellCheck="false"
                />
                {search && (
                  <button className="sl-pill-clear" onClick={() => setSearch("")}>✕</button>
                )}
              </div>
            </div>
            <div className="sl-hint">
              {quotesLoading
                ? "Loading live prices…"
                : quotesLive
                  ? `${stocks.length} stocks · live prices · press / to search`
                  : `${stocks.length} stocks · press / to search`}
            </div>
          </div>

          <div className="sl-list">
            {quotesLoading ? (
              <SkeletonList />
            ) : filtered.length === 0 ? (
              <div className="sl-empty">No results for "{search}"</div>
            ) : (
              filtered.map(s => {
                const { price: disp, converted } = convertPrice(s.price, s.exchange, currency, usdToCadRate);
                const dec     = disp < 10 ? 3 : 2;
                const priceStr = (converted ? "~$" : "$") + fmt(disp, dec);
                const chgPos  = s.change >= 0;
                const starred = watchlist.includes(s.ticker);

                return (
                  <div key={s.ticker} className="sl-row" onClick={() => onSelect(s)}>
                    <div className="sl-row-left">
                      <span className="sl-ticker">{s.ticker}</span>
                      <span className="sl-name">{s.name}</span>
                      <span className="sl-exch">{s.exchange}</span>
                    </div>
                    <div className="sl-row-right">
                      <span className="sl-price">{priceStr}</span>
                      <span className={`sl-chg ${chgPos ? "pos" : "neg"}`}>
                        {chgPos ? "+" : ""}{fmt(s.change)}%
                      </span>
                      <span className="sl-cap">{fmtLarge(s.mktCap)}</span>
                      <button
                        className={`sl-star ${starred ? "on" : "off"}`}
                        onClick={e => { e.stopPropagation(); onStarClick(s.ticker); }}
                      >
                        {starred ? "★" : "☆"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
