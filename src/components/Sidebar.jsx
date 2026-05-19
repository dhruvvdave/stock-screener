import ScanButton from "./ScanButton";
import { SECTORS } from "../data/stocks";
import { PRESETS } from "../data/presets";

const STYLE = `
  .sidebar {
    width: 264px;
    min-width: 264px;
    border-right: 1px solid var(--border);
    background: var(--surface-1);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .sb-section {
    border-bottom: 1px solid var(--border);
    padding: 16px;
  }
  .sb-title {
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 500;
    color: var(--text-3);
    margin-bottom: 8px;
    letter-spacing: 0;
  }

  .toggle-row { display: flex; flex-wrap: wrap; gap: 4px; }
  .toggle-btn {
    font-family: var(--font-ui);
    font-size: 12px;
    font-weight: 400;
    padding: 4px 10px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-3);
    cursor: pointer;
    transition: color 0.1s, background 0.1s, border-color 0.1s;
    border-radius: 3px;
    letter-spacing: 0;
  }
  .toggle-btn.active {
    color: var(--accent);
    background: rgba(232, 160, 32, 0.08);
    border-color: rgba(232, 160, 32, 0.25);
  }
  .toggle-btn:not(.active):hover {
    color: var(--text-2);
    border-color: var(--border-2);
  }

  .preset-row { display: flex; flex-wrap: wrap; gap: 4px; }
  .preset-btn {
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 400;
    padding: 4px 10px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-3);
    cursor: pointer;
    border-radius: 3px;
    transition: color 0.1s, border-color 0.1s;
    letter-spacing: 0;
  }
  .preset-btn:hover {
    color: var(--text-1);
    border-color: var(--border-2);
  }

  .filter-group { display: flex; flex-direction: column; gap: 12px; }
  .filter-item { display: flex; flex-direction: column; gap: 4px; }
  .filter-label {
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 400;
    color: var(--text-3);
    letter-spacing: 0;
  }
  .filter-row { display: flex; gap: 6px; align-items: center; }
  .filter-input {
    flex: 1;
    background: var(--surface-3);
    border: 1px solid var(--border);
    color: var(--text-1);
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 6px 8px;
    outline: none;
    transition: border-color 0.1s;
    min-width: 0;
    border-radius: 2px;
    font-variant-numeric: tabular-nums;
  }
  .filter-input:focus { border-color: rgba(232,160,32,0.5); }
  .filter-input::placeholder { color: var(--text-3); }
  .filter-sep { font-size: 11px; color: var(--text-3); flex-shrink: 0; }

  .scan-section {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: auto;
  }
  .reset-btn {
    background: none;
    border: none;
    color: var(--text-3);
    font-family: var(--font-ui);
    font-size: 12px;
    cursor: pointer;
    text-align: center;
    padding: 4px;
    transition: color 0.1s;
    letter-spacing: 0;
  }
  .reset-btn:hover { color: var(--neg); }
`;

function FilterRange({ label, minKey, maxKey, filters, onChange, min, max }) {
  return (
    <div className="filter-item">
      <span className="filter-label">{label}</span>
      <div className="filter-row">
        <input
          className="filter-input"
          placeholder={min ?? "Min"}
          value={filters[minKey]}
          onChange={e => onChange({ ...filters, [minKey]: e.target.value })}
        />
        <span className="filter-sep">–</span>
        <input
          className="filter-input"
          placeholder={max ?? "Max"}
          value={filters[maxKey]}
          onChange={e => onChange({ ...filters, [maxKey]: e.target.value })}
        />
      </div>
    </div>
  );
}

function FilterSingle({ label, field, filters, onChange, placeholder }) {
  return (
    <div className="filter-item">
      <span className="filter-label">{label}</span>
      <input
        className="filter-input"
        placeholder={placeholder ?? "Min"}
        value={filters[field]}
        onChange={e => onChange({ ...filters, [field]: e.target.value })}
      />
    </div>
  );
}

export default function Sidebar({ filters, onFiltersChange, onRunScan, onReset, loading, activeFilterCount }) {
  const toggle = (key, value) => {
    const arr = filters[key];
    onFiltersChange({
      ...filters,
      [key]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value],
    });
  };

  return (
    <>
      <style>{STYLE}</style>
      <div className="sidebar">

        <div className="sb-section">
          <div className="sb-title">Presets</div>
          <div className="preset-row">
            {Object.keys(PRESETS).map(name => (
              <button key={name} className="preset-btn" onClick={() => onFiltersChange(PRESETS[name])}>
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="sb-section">
          <div className="sb-title">Exchange</div>
          <div className="toggle-row">
            {["TSX", "TSX-V", "NYSE", "NASDAQ"].map(ex => (
              <button
                key={ex}
                className={`toggle-btn ${filters.exchanges.includes(ex) ? "active" : ""}`}
                onClick={() => toggle("exchanges", ex)}
              >{ex}</button>
            ))}
          </div>
        </div>

        <div className="sb-section">
          <div className="sb-title">Sector</div>
          <div className="toggle-row">
            {SECTORS.map(s => (
              <button
                key={s}
                className={`toggle-btn ${filters.sectors.includes(s) ? "active" : ""}`}
                onClick={() => toggle("sectors", s)}
              >{s}</button>
            ))}
          </div>
        </div>

        <div className="sb-section">
          <div className="sb-title">Valuation</div>
          <div className="filter-group">
            <FilterRange label="Price" minKey="minPrice" maxKey="maxPrice" filters={filters} onChange={onFiltersChange} />
            <FilterRange label="P/E" minKey="minPE" maxKey="maxPE" filters={filters} onChange={onFiltersChange} />
            <FilterRange label="P/B" minKey="minPB" maxKey="maxPB" filters={filters} onChange={onFiltersChange} />
          </div>
        </div>

        <div className="sb-section">
          <div className="sb-title">Growth</div>
          <div className="filter-group">
            <FilterSingle label="Min EPS Growth %" field="minEPSGrowth" filters={filters} onChange={onFiltersChange} placeholder="e.g. 10" />
            <FilterSingle label="Min Revenue Growth %" field="minRevGrowth" filters={filters} onChange={onFiltersChange} placeholder="e.g. 5" />
          </div>
        </div>

        <div className="sb-section">
          <div className="sb-title">Momentum & Size</div>
          <div className="filter-group">
            <FilterSingle label="Min Vol / Avg" field="minVolRatio" filters={filters} onChange={onFiltersChange} placeholder="e.g. 1.5" />
            <FilterRange label="Market Cap ($B)" minKey="minMktCap" maxKey="maxMktCap" filters={filters} onChange={onFiltersChange} />
          </div>
        </div>

        <div className="scan-section">
          <ScanButton loading={loading} activeFilterCount={activeFilterCount} onClick={onRunScan} />
          <button className="reset-btn" onClick={onReset}>Reset filters</button>
        </div>
      </div>
    </>
  );
}
