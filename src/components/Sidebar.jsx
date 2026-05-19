import ScanButton from "./ScanButton";
import { SECTORS } from "../data/stocks";
import { PRESETS } from "../data/presets";

const STYLE = `
  .sidebar {
    width: 272px;
    min-width: 272px;
    border-right: 1px solid #2a2a2a;
    background: #111;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
  .sidebar-section { border-bottom: 1px solid #1e1e1e; }
  .sidebar-title {
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #444;
    padding: 11px 14px 7px;
    font-family: 'IBM Plex Sans', sans-serif;
  }

  /* Presets */
  .preset-row { padding: 7px 14px 10px; display: flex; gap: 5px; flex-wrap: wrap; }
  .preset-btn {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    padding: 3px 11px;
    border: 1px solid #2a2a2a;
    background: transparent;
    color: #555;
    cursor: pointer;
    letter-spacing: 0.06em;
    border-radius: 999px;
    transition: all 0.15s;
  }
  .preset-btn:hover { border-color: #f0b429; color: #f0b429; background: rgba(240,180,41,0.06); }

  /* Exchange */
  .exchange-row { padding: 7px 14px 10px; display: flex; gap: 5px; flex-wrap: wrap; }
  .ex-btn {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    padding: 4px 10px;
    border: 1px solid #2a2a2a;
    background: transparent;
    color: #555;
    cursor: pointer;
    letter-spacing: 0.08em;
    transition: all 0.15s;
    border-radius: 2px;
  }
  .ex-btn.active { border-color: #f0b429; color: #f0b429; background: rgba(240,180,41,0.06); }
  .ex-btn:not(.active):hover { border-color: #444; color: #888; }

  /* Sectors */
  .sector-row { padding: 7px 14px 10px; display: flex; gap: 5px; flex-wrap: wrap; }
  .sector-btn {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    padding: 3px 8px;
    border: 1px solid #2a2a2a;
    background: transparent;
    color: #555;
    cursor: pointer;
    letter-spacing: 0.06em;
    border-radius: 2px;
    transition: all 0.15s;
  }
  .sector-btn.active { border-color: #06b6d4; color: #06b6d4; background: rgba(6,182,212,0.06); }
  .sector-btn:not(.active):hover { border-color: #444; color: #888; }

  /* Filter inputs */
  .filter-row { padding: 5px 14px; display: flex; flex-direction: column; gap: 3px; }
  .filter-label { font-size: 9px; color: #444; letter-spacing: 0.1em; text-transform: uppercase; }
  .filter-controls { display: flex; gap: 5px; align-items: center; }
  .filter-input {
    flex: 1;
    background: #161616;
    border: 1px solid #222;
    color: #e8e8e8;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    padding: 5px 7px;
    outline: none;
    transition: border-color 0.15s;
    min-width: 0;
  }
  .filter-input:focus { border-color: #f0b429; }
  .filter-input::placeholder { color: #2a2a2a; }
  .filter-sep { font-size: 10px; color: #2a2a2a; }

  /* Reset button */
  .reset-btn {
    width: 100%;
    background: transparent;
    color: #444;
    border: 1px solid #1e1e1e;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.1em;
    padding: 7px;
    cursor: pointer;
    transition: all 0.15s;
    margin-top: 4px;
  }
  .reset-btn:hover { border-color: #ef4444; color: #ef4444; }
  .scan-section { padding: 14px; display: flex; flex-direction: column; }
`;

function FilterRange({ label, minKey, maxKey, filters, onChange, placeholder }) {
  return (
    <div className="filter-row">
      <div className="filter-label">{label}</div>
      <div className="filter-controls">
        <input
          className="filter-input"
          placeholder={placeholder?.min ?? "Min"}
          value={filters[minKey]}
          onChange={e => onChange({ ...filters, [minKey]: e.target.value })}
        />
        <span className="filter-sep">—</span>
        <input
          className="filter-input"
          placeholder={placeholder?.max ?? "Max"}
          value={filters[maxKey]}
          onChange={e => onChange({ ...filters, [maxKey]: e.target.value })}
        />
      </div>
    </div>
  );
}

function FilterSingle({ label, field, filters, onChange, placeholder }) {
  return (
    <div className="filter-row">
      <div className="filter-label">{label}</div>
      <div className="filter-controls">
        <input
          className="filter-input"
          placeholder={placeholder ?? "Min"}
          value={filters[field]}
          onChange={e => onChange({ ...filters, [field]: e.target.value })}
        />
      </div>
    </div>
  );
}

export default function Sidebar({ filters, onFiltersChange, onRunScan, onReset, loading, activeFilterCount }) {
  const toggleExchange = (ex) => {
    onFiltersChange({
      ...filters,
      exchanges: filters.exchanges.includes(ex)
        ? filters.exchanges.filter(e => e !== ex)
        : [...filters.exchanges, ex],
    });
  };

  const toggleSector = (s) => {
    onFiltersChange({
      ...filters,
      sectors: filters.sectors.includes(s)
        ? filters.sectors.filter(x => x !== s)
        : [...filters.sectors, s],
    });
  };

  return (
    <>
      <style>{STYLE}</style>
      <div className="sidebar">
        {/* Presets */}
        <div className="sidebar-section">
          <div className="sidebar-title">Quick Presets</div>
          <div className="preset-row">
            {Object.keys(PRESETS).map(name => (
              <button key={name} className="preset-btn" onClick={() => onFiltersChange(PRESETS[name])}>
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Exchange */}
        <div className="sidebar-section">
          <div className="sidebar-title">Exchange</div>
          <div className="exchange-row">
            {["TSX", "TSX-V", "NYSE", "NASDAQ"].map(ex => (
              <button
                key={ex}
                className={`ex-btn ${filters.exchanges.includes(ex) ? "active" : ""}`}
                onClick={() => toggleExchange(ex)}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Sectors */}
        <div className="sidebar-section">
          <div className="sidebar-title">Sector</div>
          <div className="sector-row">
            {SECTORS.map(s => (
              <button
                key={s}
                className={`sector-btn ${filters.sectors.includes(s) ? "active" : ""}`}
                onClick={() => toggleSector(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Valuation */}
        <div className="sidebar-section">
          <div className="sidebar-title">Valuation</div>
          <FilterRange label="Price ($)" minKey="minPrice" maxKey="maxPrice" filters={filters} onChange={onFiltersChange} />
          <FilterRange label="P/E Ratio" minKey="minPE" maxKey="maxPE" filters={filters} onChange={onFiltersChange} />
          <FilterRange label="P/B Ratio" minKey="minPB" maxKey="maxPB" filters={filters} onChange={onFiltersChange} />
        </div>

        {/* Growth */}
        <div className="sidebar-section">
          <div className="sidebar-title">Growth</div>
          <FilterSingle label="Min EPS Growth (%)" field="minEPSGrowth" filters={filters} onChange={onFiltersChange} placeholder="e.g. 10" />
          <FilterSingle label="Min Rev Growth (%)" field="minRevGrowth" filters={filters} onChange={onFiltersChange} placeholder="e.g. 5" />
        </div>

        {/* Momentum */}
        <div className="sidebar-section">
          <div className="sidebar-title">Momentum & Size</div>
          <FilterSingle label="Min Vol / Avg Ratio" field="minVolRatio" filters={filters} onChange={onFiltersChange} placeholder="e.g. 1.5" />
          <FilterRange
            label="Mkt Cap ($B)"
            minKey="minMktCap"
            maxKey="maxMktCap"
            filters={filters}
            onChange={onFiltersChange}
          />
        </div>

        {/* Scan */}
        <div className="scan-section">
          <ScanButton loading={loading} activeFilterCount={activeFilterCount} onClick={onRunScan} />
          <button className="reset-btn" onClick={onReset}>↺ RESET ALL FILTERS</button>
        </div>
      </div>
    </>
  );
}
