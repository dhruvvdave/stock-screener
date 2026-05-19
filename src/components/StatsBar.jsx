import { momentumScore } from "../data/stocks";

const STYLE = `
  .stats-line {
    height: 28px;
    display: flex;
    align-items: center;
    padding: 0 20px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-1);
    flex-shrink: 0;
    animation: stats-fade 0.2s ease both;
    overflow: hidden;
  }
  @keyframes stats-fade { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
  .stats-text {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .stats-sep { margin: 0 6px; }

  @media (max-width: 768px) {
    .stats-line { padding: 0 14px; }
    .stats-text { font-size: 10px; }
  }
`;

export default function StatsBar({ results, totalCount, visible }) {
  if (!visible) return null;

  const green   = results.filter(s => s.change >= 0).length;
  const avgChg  = results.length ? results.reduce((a, s) => a + s.change, 0) / results.length : 0;
  const highMom = results.filter(s => momentumScore(s) >= 4).length;

  return (
    <>
      <style>{STYLE}</style>
      <div className="stats-line">
        <span className="stats-text">
          {results.length} of {totalCount}
          <span className="stats-sep">·</span>
          <span style={{ color: "var(--pos)" }}>{green}↑</span> advancing
          <span className="stats-sep">·</span>
          avg <span style={{ color: avgChg >= 0 ? "var(--pos)" : "var(--neg)" }}>
            {avgChg >= 0 ? "+" : ""}{avgChg.toFixed(2)}%
          </span>
          <span className="stats-sep">·</span>
          {highMom} high momentum
        </span>
      </div>
    </>
  );
}
