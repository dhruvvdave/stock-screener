import { forwardRef } from "react";

const STYLE = `
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-2);
    gap: 12px;
    flex-wrap: wrap;
  }
  .toolbar-left  { display: flex; align-items: center; gap: 12px; }
  .toolbar-right { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

  .result-count {
    font-family: var(--font-ui);
    font-size: 12px;
    color: var(--text-3);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .result-count strong { color: var(--text-1); font-weight: 500; }

  .search-box {
    background: var(--surface-3);
    border: 1px solid var(--border);
    color: var(--text-1);
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 6px 10px;
    width: 200px;
    outline: none;
    transition: border-color 0.1s;
    border-radius: 2px;
  }
  .search-box:focus { border-color: rgba(232,160,32,0.4); }
  .search-box::placeholder { color: var(--text-3); }

  .sort-select {
    background: var(--surface-3);
    border: 1px solid var(--border);
    color: var(--text-2);
    font-family: var(--font-ui);
    font-size: 12px;
    padding: 6px 8px;
    outline: none;
    cursor: pointer;
    border-radius: 2px;
    transition: border-color 0.1s;
  }
  .sort-select:focus { border-color: var(--border-2); }

  .col-toggle {
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 400;
    padding: 4px 8px;
    border: 1px solid var(--border);
    background: transparent;
    cursor: pointer;
    border-radius: 3px;
    transition: color 0.1s, border-color 0.1s, background 0.1s;
    letter-spacing: 0;
  }
  .col-toggle.col-on  { color: var(--text-2); border-color: var(--border); }
  .col-toggle.col-on:hover  { color: var(--text-1); border-color: var(--border-2); }
  .col-toggle.col-off { color: var(--text-3); border-color: transparent; background: transparent; }
  .col-toggle.col-off:hover { color: var(--text-3); border-color: var(--border); }

  .export-btn {
    font-family: var(--font-ui);
    font-size: 12px;
    padding: 5px 12px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-3);
    cursor: pointer;
    border-radius: 3px;
    transition: color 0.1s, border-color 0.1s;
    letter-spacing: 0;
  }
  .export-btn:hover { color: var(--text-1); border-color: var(--border-2); }
`;

const COL_LABELS = {
  sparkline:  "Trend",
  epsGrowth:  "EPS Gr%",
  revGrowth:  "Rev Gr%",
  pb:         "P/B",
  momentum:   "Momentum",
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
            <strong>{resultCount}</strong> result{resultCount !== 1 ? "s" : ""}
          </span>
          <input
            ref={searchRef}
            className="search-box"
            placeholder="Search  /"
            value={searchValue}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>

        <div className="toolbar-right">
          {Object.entries(COL_LABELS).map(([key, label]) => (
            <button
              key={key}
              className={`col-toggle ${visibleColumns[key] ? "col-on" : "col-off"}`}
              onClick={() => onColumnToggle(key)}
            >
              {label}
            </button>
          ))}

          <select
            className="sort-select"
            value={sortKey}
            onChange={e => onSortChange(e.target.value)}
          >
            <option value="mktCap">Market Cap</option>
            <option value="change">% Change</option>
            <option value="pe">P/E</option>
            <option value="pb">P/B</option>
            <option value="revGrowth">Rev Growth</option>
            <option value="epsGrowth">EPS Growth</option>
            <option value="price">Price</option>
          </select>

          <button className="export-btn" onClick={onExport}>Export CSV</button>
        </div>
      </div>
    </>
  );
});

export default Toolbar;
