import { useState, useEffect } from "react";

const STYLE = `
  .sm-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    z-index: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .sm-panel {
    width: 100%;
    max-width: 400px;
    background: var(--surface-2);
    border: 1px solid var(--border-2);
    border-radius: 6px;
    overflow: hidden;
    animation: sm-slide 0.14s ease;
  }
  @keyframes sm-slide { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

  .sm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }
  .sm-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
  }
  .sm-close {
    background: none;
    border: none;
    color: var(--text-3);
    cursor: pointer;
    font-size: 14px;
    padding: 0;
    line-height: 1;
    transition: color 0.1s;
    touch-action: manipulation;
  }
  .sm-close:hover { color: var(--neg); }

  .sm-body { padding: 20px; }

  .sm-field { margin-bottom: 18px; }
  .sm-field:last-of-type { margin-bottom: 0; }
  .sm-label {
    display: block;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-2);
    margin-bottom: 6px;
  }
  .sm-input-wrap { position: relative; }
  .sm-input {
    width: 100%;
    background: var(--surface-3);
    border: 1px solid var(--border);
    color: var(--text-1);
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 8px 42px 8px 10px;
    border-radius: var(--radius);
    outline: none;
    transition: border-color 0.1s;
    font-variant-numeric: tabular-nums;
  }
  .sm-input:focus { border-color: rgba(232,160,32,0.45); }
  .sm-input::placeholder { color: var(--text-3); }
  .sm-toggle {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--text-3);
    cursor: pointer;
    font-family: var(--font-ui);
    font-size: 10px;
    font-weight: 500;
    padding: 2px 4px;
    letter-spacing: 0.03em;
    touch-action: manipulation;
    transition: color 0.1s;
  }
  .sm-toggle:hover { color: var(--text-2); }
  .sm-hint {
    font-size: 11px;
    color: var(--text-3);
    margin-top: 5px;
  }
  .sm-hint a { color: var(--accent); text-decoration: none; }
  .sm-hint a:hover { text-decoration: underline; }

  .sm-footer {
    display: flex;
    gap: 8px;
    margin-top: 20px;
  }
  .sm-save {
    flex: 1;
    background: var(--accent);
    color: #000;
    border: none;
    font-family: var(--font-ui);
    font-size: 13px;
    font-weight: 600;
    padding: 9px;
    border-radius: var(--radius);
    cursor: pointer;
    transition: opacity 0.12s;
    touch-action: manipulation;
  }
  .sm-save:hover { opacity: 0.88; }
  .sm-clear {
    background: var(--surface-3);
    border: 1px solid var(--border);
    color: var(--text-3);
    font-family: var(--font-ui);
    font-size: 13px;
    padding: 9px 14px;
    border-radius: var(--radius);
    cursor: pointer;
    transition: color 0.1s, border-color 0.1s;
    touch-action: manipulation;
  }
  .sm-clear:hover { color: var(--neg); border-color: rgba(255,69,58,0.3); }
`;

function KeyField({ label, value, onChange, placeholder, hint, hintUrl }) {
  const [show, setShow] = useState(false);
  return (
    <div className="sm-field">
      <label className="sm-label">{label}</label>
      <div className="sm-input-wrap">
        <input
          className="sm-input"
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button className="sm-toggle" onClick={() => setShow(v => !v)} type="button">
          {show ? "hide" : "show"}
        </button>
      </div>
      <p className="sm-hint">
        {hint} <a href={hintUrl} target="_blank" rel="noopener noreferrer">Get key →</a>
      </p>
    </div>
  );
}

export default function SettingsModal({ open, onClose, finnhubKey, claudeKey, onSave }) {
  const [draftFinnhub, setDraftFinnhub] = useState(finnhubKey);
  const [draftClaude,  setDraftClaude]  = useState(claudeKey);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) { setDraftFinnhub(finnhubKey); setDraftClaude(claudeKey); setSaved(false); }
  }, [open]);  // eslint-disable-line

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = () => {
    onSave({ finnhub: draftFinnhub.trim(), claude: draftClaude.trim() });
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 700);
  };

  const handleClear = () => {
    setDraftFinnhub(""); setDraftClaude("");
    onSave({ finnhub: "", claude: "" });
  };

  return (
    <>
      <style>{STYLE}</style>
      <div className="sm-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="sm-panel">
          <div className="sm-header">
            <span className="sm-title">API Settings</span>
            <button className="sm-close" onClick={onClose}>✕</button>
          </div>
          <div className="sm-body">
            <KeyField
              label="Finnhub API Key"
              value={draftFinnhub}
              onChange={setDraftFinnhub}
              placeholder="d1abc2def3..."
              hint="Free tier — 60 req/min, real-time quotes."
              hintUrl="https://finnhub.io/register"
            />
            <KeyField
              label="Claude API Key"
              value={draftClaude}
              onChange={setDraftClaude}
              placeholder="sk-ant-api03-..."
              hint="For AI stock analysis (claude-haiku)."
              hintUrl="https://console.anthropic.com/"
            />
            <div className="sm-footer">
              <button className="sm-save" onClick={handleSave}>{saved ? "Saved ✓" : "Save"}</button>
              <button className="sm-clear" onClick={handleClear}>Clear all</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
