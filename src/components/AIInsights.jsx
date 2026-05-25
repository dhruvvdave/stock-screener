import { useState, useEffect } from "react";
import { generateAIAnalysis } from "../data/api";
import { fmt } from "../data/stocks";

const SIG_CLS   = { buy: "sig-buy", sell: "sig-sell", hold: "sig-hold", watch: "sig-watch" };
const SIG_LABEL = { buy: "BUY", sell: "SELL", hold: "HOLD", watch: "WATCH" };
const SENT_CLS  = { bullish: "sent-bullish", bearish: "sent-bearish", neutral: "sent-neutral" };

const LS_KEY = "mktscan_openai_key";

export default function AIInsights({ stock, analystData, sentiment }) {
  const [status,   setStatus]   = useState("idle");
  const [result,   setResult]   = useState(null);
  const [errMsg,   setErrMsg]   = useState("");
  const [savedKey, setSavedKey] = useState(() => localStorage.getItem(LS_KEY) ?? "");
  const [keyInput, setKeyInput] = useState("");
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    setStatus("idle");
    setResult(null);
    setErrMsg("");
  }, [stock?.ticker]);

  const saveKey = () => {
    const k = keyInput.trim();
    localStorage.setItem(LS_KEY, k);
    setSavedKey(k);
    setKeyInput("");
    setShowInput(false);
  };

  const clearKey = () => {
    localStorage.removeItem(LS_KEY);
    setSavedKey("");
    setKeyInput("");
  };

  const generate = async () => {
    setStatus("loading");
    setResult(null);
    setErrMsg("");
    try {
      const r = await generateAIAnalysis(stock, analystData, sentiment, savedKey || undefined);
      setResult(r);
      setStatus("done");
    } catch (e) {
      if (e.message === "no_key") {
        setShowInput(true);
        setErrMsg("Enter your OpenAI API key below to enable AI analysis.");
        setStatus("error");
      } else {
        setErrMsg(e.message ?? "Analysis failed");
        setStatus("error");
      }
    }
  };

  const hasResult = status === "done" && result;

  return (
    <div className="ai-wrap">
        <div className="ai-hd">
          <span className="ai-title">AI Analysis</span>
          <button className="ai-gen-btn" onClick={generate} disabled={status === "loading"}>
            {status === "loading" ? "Analyzing…" : hasResult ? "Regenerate" : "Generate"}
          </button>
        </div>

        {/* OpenAI key management */}
        {savedKey ? (
          <div className="ai-key-row">
            <span className="ai-key-display">
              OpenAI key ···{savedKey.slice(-4)}
            </span>
            <button className="ai-key-clear" onClick={clearKey} title="Remove key">✕</button>
          </div>
        ) : (
          <>
            {!showInput ? (
              <p className="ai-key-hint">
                <span
                  style={{ cursor: "pointer", color: "var(--text-3)", textDecoration: "underline", textDecorationStyle: "dotted" }}
                  onClick={() => setShowInput(true)}
                >
                  Add OpenAI key
                </span>
                {" "}to enable AI analysis. Stored locally in your browser.
              </p>
            ) : (
              <>
                <div className="ai-key-row">
                  <input
                    className="ai-key-input"
                    type="password"
                    placeholder="sk-..."
                    value={keyInput}
                    onChange={e => setKeyInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && saveKey()}
                    autoFocus
                  />
                  <button className="ai-key-save" onClick={saveKey}>Save</button>
                  <button className="ai-key-clear" onClick={() => setShowInput(false)}>✕</button>
                </div>
                <p className="ai-key-hint">Key is stored only in your browser. Never sent anywhere except OpenAI.</p>
              </>
            )}
          </>
        )}

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
          const range  = (high != null && low != null) ? (high - low) : null;
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
  );
}
