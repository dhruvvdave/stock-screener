import { useCountUp } from "../hooks/useCountUp";
import { momentumScore } from "../data/stocks";

const STYLE = `
  .stats-bar {
    display: flex;
    border-bottom: 1px solid #2a2a2a;
    background: #111;
    overflow-x: auto;
  }
  .stat-cell {
    padding: 10px 22px;
    border-right: 1px solid #2a2a2a;
    min-width: 130px;
    opacity: 0;
    transform: translateY(8px);
    animation: stat-appear 0.4s ease forwards;
  }
  .stat-cell:nth-child(1) { animation-delay: 0ms; }
  .stat-cell:nth-child(2) { animation-delay: 70ms; }
  .stat-cell:nth-child(3) { animation-delay: 140ms; }
  .stat-cell:nth-child(4) { animation-delay: 210ms; }
  @keyframes stat-appear { to { opacity: 1; transform: translateY(0); } }

  .stat-label { font-size: 9px; color: #555; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 4px; font-family: 'IBM Plex Sans', sans-serif; }
  .stat-val   { font-size: 18px; font-weight: 600; letter-spacing: -0.01em; }
  .stat-sub   { font-size: 9px; color: #444; margin-top: 2px; }
`;

function StatCell({ label, value, color, sub, animKey }) {
  const displayed = useCountUp(typeof value === "number" ? value : 0, 700);
  return (
    <div className="stat-cell" key={animKey}>
      <div className="stat-label">{label}</div>
      <div className="stat-val" style={{ color }}>{displayed}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

export default function StatsBar({ results, totalCount, visible }) {
  if (!visible) return null;

  const greenCount = results.filter(s => s.change >= 0).length;
  const avgChange = results.length
    ? (results.reduce((a, s) => a + s.change, 0) / results.length)
    : 0;
  const highMom = results.filter(s => momentumScore(s) >= 4).length;

  return (
    <>
      <style>{STYLE}</style>
      <div className="stats-bar">
        <StatCell
          label="Results"
          value={results.length}
          color="#f0b429"
          sub={`of ${totalCount} scanned`}
        />
        <StatCell
          label="Advancing"
          value={greenCount}
          color="#22c55e"
          sub={`${results.length ? ((greenCount / results.length) * 100).toFixed(0) : 0}% of results`}
        />
        <div className="stat-cell">
          <div className="stat-label">Avg Change</div>
          <div className="stat-val" style={{ color: avgChange >= 0 ? "#22c55e" : "#ef4444" }}>
            {avgChange >= 0 ? "+" : ""}{avgChange.toFixed(2)}%
          </div>
          <div className="stat-sub">session avg</div>
        </div>
        <StatCell
          label="High Momentum"
          value={highMom}
          color="#06b6d4"
          sub="score ≥ 4 / 5"
        />
      </div>
    </>
  );
}
