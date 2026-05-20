import { useState } from "react";

const STYLE = `
  .app {
    min-height: 100svh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .search-card {
    width: 100%;
    max-width: 520px;
  }

  .search-form {
    display: flex;
    gap: 10px;
  }

  .search-input {
    flex: 1;
    height: 44px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-1);
    padding: 0 14px;
    font-size: 15px;
    outline: none;
    font-family: var(--font-ui);
  }

  .search-input:focus {
    border-color: rgba(255, 255, 255, 0.28);
  }

  .search-btn {
    height: 44px;
    border: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-1);
    border-radius: 10px;
    padding: 0 16px;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.04em;
  }

  .search-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .error {
    margin-top: 12px;
    color: var(--neg);
    font-size: 13px;
    line-height: 1.4;
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
  return new Date(timestamp * 1000).toLocaleString();
}

export default function StockScreener() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quote, setQuote] = useState(null);

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
        <section className="search-card">
          <form className="search-form" onSubmit={onSubmit}>
            <input
              className="search-input"
              type="text"
              placeholder="Type ticker (e.g., AAPL)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              spellCheck="false"
            />
            <button className="search-btn" type="submit" disabled={loading}>
              {loading ? "SEARCHING" : "SEARCH"}
            </button>
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
