const STYLE = `
  .scan-wrap { padding: 16px; position: relative; }

  .scan-btn {
    width: 100%;
    background: #f0b429;
    color: #000;
    border: none;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    padding: 11px 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    position: relative;
    transition: background 0.15s;
  }
  .scan-btn:hover:not(:disabled) { background: #e07b00; }
  .scan-btn:disabled { background: #2a2a2a; color: #555; cursor: not-allowed; }

  .scan-btn.scanning {
    animation: scan-pulse 1s ease-in-out infinite;
  }
  @keyframes scan-pulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(240,180,41,0.5); }
    50%      { box-shadow: 0 0 0 10px rgba(240,180,41,0); }
  }

  .scan-arc {
    animation: rotate-arc 0.85s linear infinite;
    transform-origin: center;
  }
  @keyframes rotate-arc { to { transform: rotate(360deg); } }

  .filter-count-badge {
    position: absolute;
    top: -6px;
    right: -6px;
    background: #06b6d4;
    color: #000;
    font-size: 9px;
    font-weight: 700;
    min-width: 17px;
    height: 17px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    letter-spacing: 0;
    line-height: 1;
  }
`;

export default function ScanButton({ loading, activeFilterCount, onClick }) {
  return (
    <>
      <style>{STYLE}</style>
      <div className="scan-wrap">
        <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
          <button className={`scan-btn ${loading ? "scanning" : ""}`} onClick={onClick} disabled={loading}>
            {loading ? (
              <>
                <svg className="scan-arc" width="14" height="14" viewBox="0 0 14 14">
                  <circle cx="7" cy="7" r="5" fill="none" stroke="#000" strokeWidth="1.5"
                    strokeDasharray="22 8" strokeLinecap="round" />
                </svg>
                SCANNING
              </>
            ) : (
              <>▶ RUN SCAN</>
            )}
          </button>
          {activeFilterCount > 0 && !loading && (
            <div className="filter-count-badge">{activeFilterCount}</div>
          )}
        </div>
      </div>
    </>
  );
}
