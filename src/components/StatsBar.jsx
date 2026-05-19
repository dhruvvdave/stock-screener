import { useCountUp } from "../hooks/useCountUp";
import { momentumScore } from "../data/stocks";

const STYLE = `
  .stats-bar {
    display: flex;
    border-bottom: 1px solid var(--border);
    background: var(--surface-1);
    overflow-x: auto;
    flex-shrink: 0;
    animation: fade-up 0.2s ease both;
    -webkit-overflow-scrolling: touch;
  }
  @keyframes fade-up { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

  .stat-cell {
    padding: 12px 20px;
    border-right: 1px solid var(--border);
    min-width: 130px;
    flex-shrink: 0;
    position: relative;
  }
  .stat-cell::before {
    content: '';
    position: absolute;
    left: 0; top: 25%; bottom: 25%;
    width: 2px;
  }
  .stat-accent::before  { background: var(--accent); }
  .stat-pos::before     { background: var(--pos); }
  .stat-default::before { background: var(--border-2); }

  .stat-label {
    font-family: var(--font-ui);
    font-size: 10px;
    font-weight: 600;
    color: var(--text-3);
    letter-spacing: 0.07em;
    text-transform: uppercase;
    margin-bottom: 5px;
  }
  .stat-val {
    font-family: var(--font-mono);
    font-size: 20px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    margin-bottom: 3px;
  }
  .stat-sub {
    font-family: var(--font-ui);
    font-size: 11px;
    color: var(--text-3);
  }

  @media (max-width: 768px) {
    .stat-cell { padding: 10px 14px; min-width: 110px; }
    .stat-val  { font-size: 18px; }
    .stat-sub  { font-size: 10px; }
  }
`;

function StatCell({ label, value, color, sub, variant = "default" }) {
  const n = useCountUp(typeof value === "number" ? Math.round(value) : 0, 650);
  return (
    <div className={`stat-cell stat-${variant}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-val" style={{ color }}>{n}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export default function StatsBar({ results, totalCount, visible }) {
  if (!visible) return null;

  const green    = results.filter(s => s.change >= 0).length;
  const avgChg   = results.length ? results.reduce((a, s) => a + s.change, 0) / results.length : 0;
  const highMom  = results.filter(s => momentumScore(s) >= 4).length;

  return (
    <>
      <style>{STYLE}</style>
      <div className="stats-bar">
        <StatCell label="Results"       value={results.length} color="var(--accent)" sub={`of ${totalCount} scanned`} variant="accent" />
        <StatCell label="Advancing"     value={green}          color="var(--pos)"    sub={`${results.length ? Math.round(green / results.length * 100) : 0}% of results`} variant="pos" />
        <div className="stat-cell stat-default">
          <div className="stat-label">Avg Change</div>
          <div className="stat-val" style={{ color: avgChg >= 0 ? "var(--pos)" : "var(--neg)" }}>
            {avgChg >= 0 ? "+" : ""}{avgChg.toFixed(2)}%
          </div>
        </div>
        <StatCell label="High Momentum" value={highMom}        color="var(--text-1)" sub="score ≥ 4 / 5" variant="default" />
      </div>
    </>
  );
}
