import { useState, useEffect, useRef } from "react";

const PHRASES = [
  "Real-time quotes on any ticker",
  "Search any stock in seconds",
  "Live market data, no noise",
];

const STYLE = `
  .app {
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    position: relative;
    gap: 48px;
  }

  .app::before {
    content: '';
    position: absolute;
    top: 15%;
    left: 50%;
    transform: translateX(-50%);
    width: 700px;
    height: 500px;
    border-radius: 50%;
    background: radial-gradient(ellipse, rgba(255,255,255,0.055) 0%, transparent 68%);
    pointer-events: none;
    z-index: 0;
  }

  .hero {
    text-align: center;
    position: relative;
    z-index: 1;
  }

  .hero-title {
    font-size: clamp(2.4rem, 7vw, 4.5rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.1;
    color: var(--text-1);
    margin-bottom: 16px;
    font-family: var(--font-ui);
  }

  .hero-sub {
    font-size: clamp(1rem, 3vw, 1.35rem);
    color: var(--text-2);
    min-height: 1.8em;
    font-family: var(--font-ui);
  }

  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  .hero-cursor { animation: blink 1s step-end infinite; }

  .search-card {
    width: 100%;
    max-width: 520px;
    position: relative;
    z-index: 1;
  }

  .search-pill {
    display: flex;
    align-items: center;
    border: 1px solid var(--border-2);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    padding: 6px 6px 6px 20px;
    gap: 8px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: border-color 0.2s;
  }

  .search-pill:focus-within {
    border-color: rgba(255, 255, 255, 0.18);
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-1);
    font-size: 15px;
    outline: none;
    font-family: var(--font-ui);
    height: 38px;
  }

  .search-input::placeholder {
    color: var(--text-3);
  }

  .search-btn {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: none;
    background: var(--text-1);
    color: var(--bg);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: opacity 0.15s;
  }

  .search-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .search-btn-icon {
    width: 16px;
    height: 16px;
  }

  .search-btn-spin {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(5,5,5,0.3);
    border-top-color: var(--bg);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .error {
    margin-top: 12px;
    color: var(--neg);
    font-size: 13px;
    line-height: 1.4;
    padding-left: 4px;
  }

  .quote {
    margin-top: 20px;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.02);
  }

  .quote-symbol {
    font-family: var(--font-mono);
    color: var(--accent);
    font-size: 12px;
    letter-spacing: 0.08em;
    margin-bottom: 10px;
  }

  .quote-price {
    font-family: var(--font-mono);
    font-size: 30px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .quote-change {
    font-family: var(--font-mono);
    font-size: 14px;
    margin-bottom: 14px;
  }

  .quote-change.pos { color: var(--pos); }
  .quote-change.neg { color: var(--neg); }

  .quote-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 14px;
  }

  .quote-k {
    color: var(--text-3);
    font-size: 11px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .quote-v {
    font-family: var(--font-mono);
    font-size: 14px;
    margin-top: 2px;
  }
`;

function formatCurrency(value) {
  return typeof value === "number" ? `$${value.toFixed(2)}` : "—";
}

function formatPercent(value) {
  if (typeof value !== "number") return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatChange(value) {
  if (typeof value !== "number") return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function formatUpdated(timestamp) {
  if (!timestamp) return "—";
  return new Date(timestamp * 1000).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
}

export default function StockScreener() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quote, setQuote] = useState(null);

  const [displayText, setDisplayText] = useState("");
  const typeState = useRef({ phraseIndex: 0, charIndex: 0, isDeleting: false });

  useEffect(() => {
    let timer;
    const tick = () => {
      const { phraseIndex, charIndex, isDeleting } = typeState.current;
      const phrase = PHRASES[phraseIndex];

      if (!isDeleting) {
        const next = charIndex + 1;
        setDisplayText(phrase.slice(0, next));
        if (next === phrase.length) {
          typeState.current = { phraseIndex, charIndex: next, isDeleting: true };
          timer = setTimeout(tick, 1800);
        } else {
          typeState.current = { phraseIndex, charIndex: next, isDeleting: false };
          timer = setTimeout(tick, 65);
        }
      } else {
        const next = charIndex - 1;
        setDisplayText(phrase.slice(0, next));
        if (next === 0) {
          const nextPhrase = (phraseIndex + 1) % PHRASES.length;
          typeState.current = { phraseIndex: nextPhrase, charIndex: 0, isDeleting: false };
          timer = setTimeout(tick, 300);
        } else {
          typeState.current = { phraseIndex, charIndex: next, isDeleting: true };
          timer = setTimeout(tick, 38);
        }
      }
    };
    timer = setTimeout(tick, 800);
    return () => clearTimeout(timer);
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();

    const symbol = query.trim().toUpperCase();
    if (!symbol) {
      setError("Enter a ticker symbol (e.g., AAPL).");
      setQuote(null);
      return;
    }

    setLoading(true);
    setError("");
    setQuote(null);

    try {
      const response = await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to fetch quote.");
      }

      setQuote(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to fetch quote.");
    } finally {
      setLoading(false);
    }
  };

  const changeClass =
    typeof quote?.changePercent === "number"
      ? quote.changePercent >= 0
        ? "pos"
        : "neg"
      : "";

  return (
    <>
      <style>{STYLE}</style>
      <main className="app">
        <div className="hero">
          <h1 className="hero-title">Stock Screener</h1>
          <p className="hero-sub">
            <span>{displayText}</span>
            <span className="hero-cursor">_</span>
          </p>
        </div>

        <section className="search-card">
          <form onSubmit={onSubmit}>
            <div className="search-pill">
              <input
                className="search-input"
                type="text"
                placeholder="Ask Anything (e.g., AAPL)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                spellCheck="false"
              />
              <button className="search-btn" type="submit" disabled={loading}>
                {loading ? (
                  <span className="search-btn-spin" />
                ) : (
                  <svg className="search-btn-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 13V3M3 8l5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </div>
          </form>

          {error && <p className="error">{error}</p>}

          {quote && (
            <article className="quote">
              <div className="quote-symbol">{quote.symbol}</div>
              <div className="quote-price">{formatCurrency(quote.price)}</div>
              <div className={`quote-change ${changeClass}`}>
                {formatChange(quote.change)} ({formatPercent(quote.changePercent)})
              </div>

              <div className="quote-grid">
                <div>
                  <div className="quote-k">Open</div>
                  <div className="quote-v">{formatCurrency(quote.open)}</div>
                </div>
                <div>
                  <div className="quote-k">Previous Close</div>
                  <div className="quote-v">{formatCurrency(quote.previousClose)}</div>
                </div>
                <div>
                  <div className="quote-k">High</div>
                  <div className="quote-v">{formatCurrency(quote.high)}</div>
                </div>
                <div>
                  <div className="quote-k">Low</div>
                  <div className="quote-v">{formatCurrency(quote.low)}</div>
                </div>
                <div>
                  <div className="quote-k">Updated</div>
                  <div className="quote-v">{formatUpdated(quote.timestamp)}</div>
                </div>
              </div>
            </article>
          )}
        </section>
      </main>
    </>
  );
}
