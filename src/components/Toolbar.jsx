import { forwardRef } from "react";

const STYLE = `
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    height: 44px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-2);
    gap: 12px;
    flex-shrink: 0;
    flex-wrap: nowrap;
    overflow-x: auto;
  }
  .tb-left  { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .tb-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

  .tb-count {
    font-size: 12px;
    color: var(--text-2);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .tb-count strong { color: var(--text-1); font-weight: 600; }

  .tb-search {
    background: var(--surface-3);
    border: 1px solid var(--border);
    color: var(--text-1);
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 0 10px;
    height: 30px;
    width: 196px;
    outline: none;
    border-radius: var(--radius);
    transition: border-color 0.12s, background 0.12s;
  }
  .tb-search:focus {
    border-color: rgba(232,160,32,0.4);
    background: var(--surface-4);
  }
  .tb-search::placeholder { color: var(--text-3); }

  .tb-sep { width: 1px; height: 16px; background: var(--border); margin: 0 4px; flex-shrink: 0; }

  .col-tog {
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 500;
    height: 26px;
    padding: 0 8px;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    border-radius: var(--radius);
    transition: color 0.1s, border-color 0.1s, background 0.1s;
    white-space: nowrap;
  }
  .col-tog.tog-on  {
    color: var(--text-2);
    border-color: var(--border);
    background: var(--surface-3);
  }
  .col-tog.tog-on:hover { color: var(--text-1); border-color: var(--border-2); }
  .col-tog.tog-off { color: var(--text-3); }
  .col-tog.tog-off:hover { color: var(--text-2); border-color: var(--border); }

  .tb-sort {
    background: var(--surface-3);
    border: 1px solid var(--border);
    color: var(--text-2);
    font-family: var(--font-ui);
    font-size: 12px;
    height: 30px;
    padding: 0 8px;
    outline: none;
    cursor: pointer;
    border-radius: var(--radius);
    transition: border-color 0.1s;
  }
  .tb-sort:focus { border-color: var(--border-2); }

  .tb-export {
    font-family: var(--font-ui);
    font-size: 12px;
    font-weight: 500;
    height: 30px;
    padding: 0 12px;
    border: 1px solid var(--border);
    background: var(--surface-3);
    color: var(--text-2);
    cursor: pointer;
    border-radius: var(--radius);
    transition: color 0.1s, border-color 0.1s, background 0.1s;
    white-space: nowrap;
  }
  .tb-export:hover { color: var(--text-1); border-color: var(--border-2); background: var(--surface-4); }
`;

const COLS = { sparkline: "Trend", epsGrowth: "EPS Gr%", revGrowth: "Rev Gr%", pb: "P/B", momentum: "Mom" };

const Toolbar = forwardRef(function Toolbar({
  resultCount, searchValue, onSearchChange,
  sortKey, onSortChange,
  visibleColumns, onColumnToggle,
  onExport,
}, ref) {
  return (
    <>
      <style>{STYLE}</style>
      <div className="toolbar">
        <div className="tb-left">
          <span className="tb-count"><strong>{resultCount}</strong> result{resultCount !== 1 ? "s" : ""}</span>
          <input ref={ref} className="tb-search" placeholder="Search  /" value={searchValue} onChange={e => onSearchChange(e.target.value)} />
        </div>

        <div className="tb-right">
          {Object.entries(COLS).map(([k, lbl]) => (
            <button key={k} className={`col-tog ${visibleColumns[k] ? "tog-on" : "tog-off"}`} onClick={() => onColumnToggle(k)}>{lbl}</button>
          ))}
          <div className="tb-sep" />
          <select className="tb-sort" value={sortKey} onChange={e => onSortChange(e.target.value)}>
            <option value="mktCap">Mkt Cap</option>
            <option value="change">% Change</option>
            <option value="pe">P/E</option>
            <option value="pb">P/B</option>
            <option value="revGrowth">Rev Growth</option>
            <option value="epsGrowth">EPS Growth</option>
            <option value="price">Price</option>
          </select>
          <button className="tb-export" onClick={onExport}>Export CSV</button>
        </div>
      </div>
    </>
  );
});

export default Toolbar;
