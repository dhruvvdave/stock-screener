import { useState, useEffect } from "react";
import { generateAIAnalysis } from "../data/api";
import { fmt } from "../data/stocks";

const STYLE = `
  .ai-wrap {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }
  .ai-hd {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .ai-title {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-3);
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }
  .ai-source {
    font-size: 10px;
    color: var(--text-3);
  }
  .ai-gen-btn {
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 500;
    color: var(--accent);
    background: var(--accent-dim);
    border: 1px solid rgba(232,160,32,0.2);
    padding: 3px 10px;
    border-radius: var(--radius);
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s;
    touch-action: manipulation;
    white-space: nowrap;
  }
  .ai-gen-btn:hover:not(:disabled) { background: rgba(232,160,32,0.18); border-color: rgba(232,160,32,0.35); }
  .ai-gen-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  .ai-prompt { font-size: 12px; color: var(--text-3); line-height: 1.55; }
  .ai-prompt a { color: var(--accent); text-decoration: none; }
  .ai-prompt a:hover { text-decoration: underline; }

  .ai-signal-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .ai-signal {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
  }
  .sig-buy   { color: var(--pos); }
  .sig-sell  { color: var(--neg); }
  .sig-hold  { color: var(--text-2); }
  .sig-watch { color: var(--accent); }

  .ai-sent {
    font-size: 11px;
    color: var(--text-3);
  }
  .sent-bullish { color: var(--pos); }
  .sent-bearish { color: var(--neg); }
  .sent-neutral { color: var(--text-2); }

  .ai-summary {
    font-size: 12px;
    color: var(--text-1);
    line-height: 1.65;
    margin-bottom: 14px;
  }

  .ai-cases {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 16px;
  }
  .ai-case-hd {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-bottom: 5px;
  }
  .bull-hd { color: var(--pos); }
  .bear-hd { color: var(--neg); }
  .ai-case-list { list-style: none; }
  .ai-case-item {
    font-size: 11px;
    color: var(--text-2);
    line-height: 1.5;
    padding-left: 10px;
    position: relative;
    margin-bottom: 3px;
  }
  .ai-case-item::before { content: '·'; position: absolute; left: 0; color: var(--text-3); }

  .ai-range-hd {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-3);
    letter-spacing: 0.07em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .ai-range-track {
    height: 2px;
    background: var(--surface-4);
    border-radius: 1px;
    position: relative;
    margin-bottom: 6px;
  }
  .ai-range-fill {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: var(--border-2);
    border-radius: 1px;
  }
  .ai-range-now {
    position: absolute;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--text-1);
    top: -1.5px;
    transform: translateX(-50%);
  }
  .ai-range-mid {
    position: absolute;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    top: -2.5px;
    transform: translateX(-50%);
  }
  .ai-range-nums {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
  }

  .ai-error { font-size: 12px; color: var(--neg); line-height: 1.5; }

  @keyframes ai-pulse { 0%,100%{opacity:0.35} 50%{opacity:0.6} }
  .ai-skel {
    height: 10px;
    background: var(--surface-3);
    border-radius: 2px;
    margin-bottom: 8px;
    animation: ai-pulse 1.6s ease-in-out infinite;
  }
`;

const SIG_CLS   = { buy: "sig-buy", sell: "sig-sell", hold: "sig-hold", watch: "sig-watch" };
const SIG_LABEL = { buy: "BUY", sell: "SELL", hold: "HOLD", watch: "WATCH" };
const SENT_CLS  = { bullish: "sent-bullish", bearish: "sent-bearish", neutral: "sent-neutral" };

export default function AIInsights({ stock, analystData, sentiment }) {
  const [status, setStatus]   = useState("idle");  // idle | loading | done | error
  const [result, setResult]   = useState(null);
  const [errMsg, setErrMsg]   = useState("");

  // Reset when stock changes
  useEffect(() => {
    setStatus("idle");
    setResult(null);
    setErrMsg("");
  }, [stock?.ticker]);

  const generate = async () => {
    setStatus("loading");
    setResult(null);
    setErrMsg("");
    try {
      const r = await generateAIAnalysis(stock, analystData, sentiment);
      setResult(r);
      setStatus("done");
    } catch (e) {
      setErrMsg(e.message ?? "Analysis failed");
      setStatus("error");
    }
  };

  const hasResult = status === "done" && result;

  return (
    <>
      <style>{STYLE}</style>
      <div className="ai-wrap">
        <div className="ai-hd">
          <span className="ai-title">AI Analysis</span>
          <button className="ai-gen-btn" onClick={generate} disabled={status === "loading"}>
            {status === "loading" ? "Analyzing…" : hasResult ? "Regenerate" : "Generate"}
          </button>
        </div>

        {status === "loading" && (
          <>
            <div className="ai-skel" style={{ width: "55%" }} />
            <div className="ai-skel" style={{ width: "100%" }} />
            <div className="ai-skel" style={{ width: "92%" }} />
            <div className="ai-skel" style={{ width: "80%", marginBottom: 14 }} />
            <div className="ai-skel" style={{ width: "45%" }} />
            <div className="ai-skel" style={{ width: "60%" }} />
          </>
        )}

        {status === "error" && (
          <p className="ai-error">{errMsg}</p>
        )}

        {hasResult && (() => {
          const { summary, bulls = [], bears = [], forecast30d, sentiment: sent, signal } = result;
          const { low, mid, high } = forecast30d ?? {};
          const range = (high != null && low != null) ? (high - low) : null;
          const midPct = range ? Math.min(100, Math.max(0, ((mid - low) / range) * 100)) : 50;
          const curPct = range ? Math.min(100, Math.max(0, ((stock.price - low) / range) * 100)) : 50;

          return (
            <>
              <div className="ai-signal-row">
                {signal && (
                  <span className={`ai-signal ${SIG_CLS[signal] ?? "sig-hold"}`}>
                    {SIG_LABEL[signal] ?? signal.toUpperCase()}
                  </span>
                )}
                {sent && (
                  <span className={`ai-sent ${SENT_CLS[sent] ?? "sent-neutral"}`}>
                    {sent.charAt(0).toUpperCase() + sent.slice(1)} sentiment
                  </span>
                )}
              </div>

              {summary && <p className="ai-summary">{summary}</p>}

              {(bulls.length > 0 || bears.length > 0) && (
                <div className="ai-cases">
                  <div>
                    <div className="ai-case-hd bull-hd">Bull case</div>
                    <ul className="ai-case-list">
                      {bulls.map((b, i) => <li key={i} className="ai-case-item">{b}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div className="ai-case-hd bear-hd">Bear case</div>
                    <ul className="ai-case-list">
                      {bears.map((b, i) => <li key={i} className="ai-case-item">{b}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              {range != null && (
                <>
                  <div className="ai-range-hd">30-day range</div>
                  <div className="ai-range-track">
                    <div className="ai-range-fill" />
                    <div className="ai-range-mid" style={{ left: `${midPct}%` }} />
                    <div className="ai-range-now" style={{ left: `${curPct}%` }} />
                  </div>
                  <div className="ai-range-nums">
                    <span>Low ${fmt(low, 2)}</span>
                    <span>Mid ${fmt(mid, 2)}</span>
                    <span>High ${fmt(high, 2)}</span>
                  </div>
                </>
              )}
            </>
          );
        })()}
      </div>
    </>
  );
}
