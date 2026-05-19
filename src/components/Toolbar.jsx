import { forwardRef } from "react";

const STYLE = `
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 14px;
    border-bottom: 1px solid #2a2a2a;
    background: #161616;
    gap: 10px;
    flex-wrap: wrap;
  }
  .toolbar-left  { display: flex; align-items: center; gap: 10px; }
  .toolbar-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

  .result-count { font-size: 11px; color: #555; white-space: nowrap; }
  .result-count strong { color: #f0b429; }

  .search-box {
    background: #1c1c1c;
    border: 1px solid #2a2a2a;
    color: #e8e8e8;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    padding: 5px 10px;
    width: 190px;
    outline: none;
    transition: border-color 0.15s;
  }
  .search-box:focus { border-color: #f0b429; }
  .search-box::placeholder { color: #333; }

  .sort-select {
    background: #1c1c1c;
    border: 1px solid #2a2a2a;
    color: #e8e8e8;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    padding: 5px 8px;
    outline: none;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .sort-select:focus { border-color: #f0b429; }

  .col-toggle-pill {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    padding: 3px 9px;
    border: 1px solid #2a2a2a;
    background: transparent;
    color: #444;
    cursor: pointer;
    border-radius: 999px;
    letter-spacing: 0.06em;
    transition: all 0.15s;
  }
  .col-toggle-pill.col-on { border-color: #333; color: #666; }
  .col-toggle-pill.col-on:hover { border-color: #555; color: #888; }
  .col-toggle-pill.col-off { border-color: #1e1e1e; color: #2a2a2a; }
  .col-toggle-pill.col-off:hover { border-color: #333; color: #444; }

  .export-btn {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    padding: 4px 11px;
    border: 1px solid #2a2a2a;
    background: transparent;
    color: #555;
    cursor: pointer;
    letter-spacing: 0.08em;
    transition: all 0.15s;
  }
  .export-btn:hover { border-color: #22c55e; color: #22c55e; }

  .kbd-hint { font-size: 9px; color: #333; letter-spacing: 0.04em; }
  .kbd {
    display: inline-block;
    border: 1px solid #2a2a2a;
    border-radius: 2px;
    padding: 1px 4px;
    font-size: 9px;
    color: #3a3a3a;
    margin: 0 1px;
  }
`;

const COL_LABELS = {
  sparkline: "SPARK",
  epsGrowth: "EPS GR%",
  revGrowth: "REV GR%",
  pb: "P/B",
  momentum: "MOM",
};

const Toolbar = forwardRef(function Toolbar({
  resultCount,
  searchValue,
  onSearchChange,
  sortKey,
  onSortChange,
  visibleColumns,
  onColumnToggle,
  onExport,
}, searchRef) {
  return (
    <>
      <style>{STYLE}</style>
      <div className="toolbar">
        <div className="toolbar-left">
          <span className="result-count">
            <strong>{resultCount}</strong> results
          </span>
          <input
            ref={searchRef}
            className="search-box"
            placeholder="/ search ticker or name"
            value={searchValue}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>

        <div className="toolbar-right">
          {/* Column toggles */}
          {Object.entries(COL_LABELS).map(([key, label]) => (
            <button
              key={key}
              className={`col-toggle-pill ${visibleColumns[key] ? "col-on" : "col-off"}`}
              onClick={() => onColumnToggle(key)}
              title={`${visibleColumns[key] ? "Hide" : "Show"} ${label}`}
            >
              {label}
            </button>
          ))}

          <select
            className="sort-select"
            value={sortKey}
            onChange={e => onSortChange(e.target.value)}
          >
            <option value="mktCap">Mkt Cap</option>
            <option value="change">% Change</option>
            <option value="pe">P/E</option>
            <option value="pb">P/B</option>
            <option value="revGrowth">Rev Growth</option>
            <option value="epsGrowth">EPS Growth</option>
            <option value="price">Price</option>
          </select>

          <button className="export-btn" onClick={onExport} title="Export CSV">
            ↓ CSV
          </button>
        </div>
      </div>
    </>
  );
});

export default Toolbar;
