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
  .tb-right { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

  .tb-count {
    font-size: 12px;
    color: var(--text-3);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

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

  .col-tog {
    font-family: var(--font-ui);
    font-size: 11px;
    height: 26px;
    padding: 0 6px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: var(--radius);
    transition: color 0.1s;
    white-space: nowrap;
  }
  .col-tog.tog-on  { color: var(--text-2); }
  .col-tog.tog-off { color: var(--text-3); }
  .col-tog.tog-on:hover  { color: var(--text-1); }
  .col-tog.tog-off:hover { color: var(--text-2); }

  .tb-export {
    font-family: var(--font-ui);
    font-size: 12px;
    height: 30px;
    padding: 0 8px;
    border: none;
    background: transparent;
    color: var(--text-3);
    cursor: pointer;
    transition: color 0.1s;
    white-space: nowrap;
    touch-action: manipulation;
  }
  .tb-export:hover { color: var(--text-2); }

  @media (max-width: 768px) {
    .toolbar { padding: 0 12px; gap: 8px; }
    .tb-left { flex: 1; min-width: 0; }
    .tb-search { width: auto; flex: 1; max-width: none; min-width: 0; }
    .col-tog { display: none; }
    .tb-right { gap: 8px; }
  }
`;

const COLS = { sparkline: "Trend", epsGrowth: "EPS Gr%", revGrowth: "Rev Gr%", pb: "P/B", momentum: "Mom" };

const Toolbar = forwardRef(function Toolbar({
  resultCount, searchValue, onSearchChange,
  visibleColumns, onColumnToggle,
  onExport,
}, ref) {
  return (
    <>
      <style>{STYLE}</style>
      <div className="toolbar">
        <div className="tb-left">
          <span className="tb-count">{resultCount} result{resultCount !== 1 ? "s" : ""}</span>
          <input ref={ref} className="tb-search" placeholder="Search  /" value={searchValue} onChange={e => onSearchChange(e.target.value)} />
        </div>

        <div className="tb-right">
          {Object.entries(COLS).map(([k, lbl]) => (
            <button key={k} className={`col-tog ${visibleColumns[k] ? "tog-on" : "tog-off"}`} onClick={() => onColumnToggle(k)}>{lbl}</button>
          ))}
          <button className="tb-export" onClick={onExport}>Export CSV</button>
        </div>
      </div>
    </>
  );
});

export default Toolbar;
