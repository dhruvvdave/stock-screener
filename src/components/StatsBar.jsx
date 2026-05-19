import { useCountUp } from "../hooks/useCountUp";
import { momentumScore } from "../data/stocks";

const STYLE = `
  .stats-bar {
    display: flex;
    border-bottom: 1px solid var(--border);
    background: var(--surface-1);
    overflow-x: auto;
    animation: sb-in 0.25s ease forwards;
  }
  @keyframes sb-in { from { opacity: 0; } to { opacity: 1; } }

  .stat-cell {
    padding: 12px 20px;
    border-right: 1px solid var(--border);
    min-width: 120px;
    flex-shrink: 0;
  }
  .stat-label {
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 400;
    color: var(--text-3);
    margin-bottom: 4px;
    letter-spacing: 0;
  }
  .stat-val {
    font-family: var(--font-mono);
    font-size: 16px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }
  .stat-sub {
    font-family: var(--font-ui);
    font-size: 11px;
    color: var(--text-3);
    margin-top: 2px;
    letter-spacing: 0;
  }
`;

function StatCell({ label, value, color, sub }) {
  const displayed = useCountUp(typeof value === "number" ? Math.round(value) : 0, 600);
  return (
    <div className="stat-cell">
      <div className="stat-label">{label}</div>
      <div className="stat-val" style={{ color }}>{displayed}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export default function StatsBar({ results, totalCount, visible }) {
  if (!visible) return null;

  const greenCount = results.filter(s => s.change >= 0).length;
  const avgChange = results.length
    ? results.reduce((a, s) => a + s.change, 0) / results.length
    : 0;
  const highMom = results.filter(s => momentumScore(s) >= 4).length;

  return (
    <>
      <style>{STYLE}</style>
      <div className="stats-bar">
        <StatCell
          label="Results"
          value={results.length}
          color="var(--accent)"
          sub={`of ${totalCount} total`}
        />
        <StatCell
          label="Advancing"
          value={greenCount}
          color="var(--pos)"
          sub={`${results.length ? Math.round((greenCount / results.length) * 100) : 0}% of results`}
        />
        <div className="stat-cell">
          <div className="stat-label">Avg Change</div>
          <div className="stat-val" style={{ color: avgChange >= 0 ? "var(--pos)" : "var(--neg)" }}>
            {avgChange >= 0 ? "+" : ""}{avgChange.toFixed(2)}%
          </div>
        </div>
        <StatCell
          label="High Momentum"
          value={highMom}
          color="var(--text-1)"
          sub="score ≥ 4/5"
        />
      </div>
    </>
  );
}
