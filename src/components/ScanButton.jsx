const STYLE = `
  .scan-btn {
    width: 100%;
    background: var(--accent);
    color: #000;
    border: none;
    font-family: var(--font-ui);
    font-size: 13px;
    font-weight: 600;
    padding: 10px 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.1s;
    letter-spacing: 0;
  }
  .scan-btn:hover:not(:disabled) { background: #d4911c; }
  .scan-btn:disabled { background: var(--surface-3); color: var(--text-3); cursor: not-allowed; }

  .scan-spinner {
    width: 12px;
    height: 12px;
    border: 1.5px solid rgba(0,0,0,0.25);
    border-top-color: #000;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

export default function ScanButton({ loading, activeFilterCount, onClick }) {
  const label = loading
    ? "Scanning"
    : activeFilterCount > 0
      ? `Scan  (${activeFilterCount})`
      : "Scan";

  return (
    <>
      <style>{STYLE}</style>
      <button className="scan-btn" onClick={onClick} disabled={loading}>
        {loading && <span className="scan-spinner" />}
        {label}
      </button>
    </>
  );
}
