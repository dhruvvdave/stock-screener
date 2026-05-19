const STYLE = `
  .scan-btn {
    width: 100%;
    background: var(--accent);
    color: #000;
    border: none;
    font-family: var(--font-ui);
    font-size: 13px;
    font-weight: 600;
    padding: 11px 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: var(--radius);
    letter-spacing: 0.01em;
    transition: background 0.12s, opacity 0.12s;
    position: relative;
    overflow: hidden;
  }
  .scan-btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(255,255,255,0);
    transition: background 0.12s;
  }
  .scan-btn:hover:not(:disabled)::after { background: rgba(255,255,255,0.07); }
  .scan-btn:active:not(:disabled)::after { background: rgba(0,0,0,0.08); }
  .scan-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .scan-spinner {
    width: 13px;
    height: 13px;
    border: 1.5px solid rgba(0,0,0,0.2);
    border-top-color: rgba(0,0,0,0.7);
    border-radius: 50%;
    animation: spin 0.65s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

export default function ScanButton({ loading, activeFilterCount, onClick }) {
  return (
    <>
      <style>{STYLE}</style>
      <button className="scan-btn" onClick={onClick} disabled={loading}>
        {loading && <span className="scan-spinner" />}
        {loading ? "Scanning…" : activeFilterCount > 0 ? `Scan  (${activeFilterCount})` : "Scan"}
      </button>
    </>
  );
}
