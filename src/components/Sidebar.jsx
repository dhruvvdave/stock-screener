import ScanButton from "./ScanButton";
import { SECTORS } from "../data/stocks";
import { PRESETS } from "../data/presets";

const STYLE = `
  .sb-backdrop {
    display: none;
  }

  .sidebar {
    width: 240px;
    min-width: 240px;
    border-right: 1px solid var(--border);
    background: var(--surface-1);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    flex-shrink: 0;
  }

  .sb-section {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }

  .sb-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-3);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 6px;
    opacity: 0.7;
  }

  .toggle-group { display: flex; flex-wrap: wrap; gap: 4px; }
  .toggle-btn {
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 500;
    padding: 4px 8px;
    border: none;
    background: transparent;
    color: var(--text-3);
    cursor: pointer;
    border-radius: var(--radius);
    transition: color 0.1s, background 0.1s;
    line-height: 1.4;
    touch-action: manipulation;
  }
  .toggle-btn.on {
    color: var(--text-1);
    background: var(--surface-3);
  }
  .toggle-btn:not(.on):hover {
    color: var(--text-2);
  }

  .preset-group { display: flex; flex-wrap: wrap; gap: 4px; }
  .preset-btn {
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 500;
    padding: 4px 8px;
    border: none;
    background: transparent;
    color: var(--text-3);
    cursor: pointer;
    border-radius: var(--radius);
    transition: color 0.1s, background 0.1s;
    line-height: 1.4;
    touch-action: manipulation;
  }
  .preset-btn:hover {
    color: var(--text-2);
    background: var(--surface-3);
  }

  .filter-stack { display: flex; flex-direction: column; gap: 10px; }
  .filter-field { display: flex; flex-direction: column; gap: 4px; }
  .filter-label { font-size: 11px; font-weight: 400; color: var(--text-2); }
  .filter-range { display: flex; gap: 6px; align-items: center; }
  .filter-range-sep { font-size: 11px; color: var(--text-3); flex-shrink: 0; }

  .f-input {
    flex: 1;
    background: var(--surface-3);
    border: 1px solid var(--border);
    color: var(--text-1);
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 6px 8px;
    outline: none;
    border-radius: var(--radius);
    transition: border-color 0.1s, background 0.1s;
    min-width: 0;
    font-variant-numeric: tabular-nums;
    width: 100%;
  }
  .f-input:focus {
    border-color: rgba(232,160,32,0.45);
    background: var(--surface-4);
  }
  .f-input::placeholder { color: var(--text-3); }

  .sb-actions {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: auto;
    border-top: 1px solid var(--border);
  }
  .reset-btn {
    background: none;
    border: none;
    color: var(--text-3);
    font-family: var(--font-ui);
    font-size: 12px;
    cursor: pointer;
    text-align: center;
    padding: 6px;
    transition: color 0.1s;
    border-radius: var(--radius);
    touch-action: manipulation;
  }
  .reset-btn:hover { color: var(--text-2); }

  /* Mobile drawer */
  .sb-drawer-handle { display: none; }

  @media (max-width: 768px) {
    .sb-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0);
      z-index: 299;
      pointer-events: none;
      transition: background 0.25s ease;
    }
    .sb-backdrop.open {
      background: rgba(0, 0, 0, 0.6);
      pointer-events: auto;
    }

    .sidebar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100% !important;
      min-width: unset !important;
      max-height: 88svh;
      border-right: none;
      border-top: 1px solid var(--border);
      border-radius: 14px 14px 0 0;
      z-index: 300;
      transform: translateY(100%);
      transition: transform 0.26s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    .sidebar.open { transform: translateY(0); }

    .sb-drawer-handle {
      display: flex;
      justify-content: center;
      padding: 12px 0 4px;
      flex-shrink: 0;
    }
    .sb-drawer-handle::before {
      content: '';
      width: 36px;
      height: 4px;
      background: var(--border-2);
      border-radius: 2px;
    }

    .sb-actions { padding-bottom: 28px; }
  }
`;

function Range({ label, minKey, maxKey, f, onChange }) {
  return (
    <div className="filter-field">
      <span className="filter-label">{label}</span>
      <div className="filter-range">
        <input className="f-input" placeholder="Min" value={f[minKey]} onChange={e => onChange({ ...f, [minKey]: e.target.value })} />
        <span className="filter-range-sep">–</span>
        <input className="f-input" placeholder="Max" value={f[maxKey]} onChange={e => onChange({ ...f, [maxKey]: e.target.value })} />
      </div>
    </div>
  );
}

function Single({ label, field, f, onChange, ph }) {
  return (
    <div className="filter-field">
      <span className="filter-label">{label}</span>
      <input className="f-input" placeholder={ph ?? "Min"} value={f[field]} onChange={e => onChange({ ...f, [field]: e.target.value })} />
    </div>
  );
}

export default function Sidebar({ filters: f, onFiltersChange: set, onRunScan, onReset, loading, activeFilterCount, open, onClose }) {
  const toggle = (key, val) => set({ ...f, [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val] });

  return (
    <>
      <style>{STYLE}</style>
      <div className={`sb-backdrop ${open ? "open" : ""}`} onClick={onClose} />
      <div className={`sidebar ${open ? "open" : ""}`}>
        <div className="sb-drawer-handle" />

        <div className="sb-section">
          <div className="sb-label">Presets</div>
          <div className="preset-group">
            {Object.keys(PRESETS).map(name => (
              <button key={name} className="preset-btn" onClick={() => set(PRESETS[name])}>{name}</button>
            ))}
          </div>
        </div>

        <div className="sb-section">
          <div className="sb-label">Exchange</div>
          <div className="toggle-group">
            {["TSX","TSX-V","NYSE","NASDAQ"].map(ex => (
              <button key={ex} className={`toggle-btn ${f.exchanges.includes(ex) ? "on" : ""}`} onClick={() => toggle("exchanges", ex)}>{ex}</button>
            ))}
          </div>
        </div>

        <div className="sb-section">
          <div className="sb-label">Sector</div>
          <div className="toggle-group">
            {SECTORS.map(s => (
              <button key={s} className={`toggle-btn ${f.sectors.includes(s) ? "on" : ""}`} onClick={() => toggle("sectors", s)}>{s}</button>
            ))}
          </div>
        </div>

        <div className="sb-section">
          <div className="sb-label">Valuation</div>
          <div className="filter-stack">
            <Range label="Price ($)" minKey="minPrice" maxKey="maxPrice" f={f} onChange={set} />
            <Range label="P/E" minKey="minPE" maxKey="maxPE" f={f} onChange={set} />
            <Range label="P/B" minKey="minPB" maxKey="maxPB" f={f} onChange={set} />
          </div>
        </div>

        <div className="sb-section">
          <div className="sb-label">Growth</div>
          <div className="filter-stack">
            <Single label="Min EPS Growth %" field="minEPSGrowth" f={f} onChange={set} ph="e.g. 10" />
            <Single label="Min Revenue Growth %" field="minRevGrowth" f={f} onChange={set} ph="e.g. 5" />
          </div>
        </div>

        <div className="sb-section">
          <div className="sb-label">Momentum & Size</div>
          <div className="filter-stack">
            <Single label="Min Vol / Avg" field="minVolRatio" f={f} onChange={set} ph="e.g. 1.5" />
            <Range label="Market Cap ($B)" minKey="minMktCap" maxKey="maxMktCap" f={f} onChange={set} />
          </div>
        </div>

        <div className="sb-actions">
          <ScanButton loading={loading} activeFilterCount={activeFilterCount} onClick={onRunScan} />
          <button className="reset-btn" onClick={onReset}>Reset all filters</button>
        </div>
      </div>
    </>
  );
}
