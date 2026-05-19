import SkeletonRows from "./SkeletonRows";
import Sparkline    from "./Sparkline";
import MomentumDots from "./MomentumDots";
import { fmt, fmtLarge, fmtVol, volRatio, momentumScore } from "../data/stocks";

const STYLE = `
  .tbl-wrap { flex: 1; overflow: auto; }

  table { width: 100%; border-collapse: collapse; }
  thead { position: sticky; top: 0; z-index: 10; }

  th {
    background: var(--surface-2);
    color: var(--text-3);
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 600;
    padding: 0 16px;
    height: 34px;
    text-align: left;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    transition: color 0.1s;
  }
  th:hover { color: var(--text-2); }
  th.th-on { color: var(--text-1); }
  th.th-r  { text-align: right; }

  td {
    padding: 0 16px;
    height: 46px;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
    vertical-align: middle;
    font-size: 12px;
  }

  /* Alternating rows — very subtle */
  tbody tr:nth-child(even) td { background: rgba(255,255,255,0.012); }

  tbody tr { cursor: pointer; }
  tbody tr:hover td { background: var(--surface-3) !important; }
  tbody tr:hover .td-accent { box-shadow: inset 3px 0 0 var(--accent); }

  /* Ticker */
  .ticker-wrap { display: flex; flex-direction: column; gap: 1px; }
  .ticker-sym {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
    letter-spacing: 0.03em;
  }
  .ticker-co {
    font-size: 11px;
    color: var(--text-3);
    max-width: 145px;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  /* Chips */
  .chip {
    display: inline-block;
    font-family: var(--font-ui);
    font-size: 10px;
    font-weight: 500;
    padding: 2px 7px;
    border: 1px solid var(--border);
    color: var(--text-3);
    border-radius: var(--radius);
    letter-spacing: 0.02em;
  }

  /* Numbers */
  .n-pos  { color: var(--pos);    font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
  .n-neg  { color: var(--neg);    font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
  .n-base { color: var(--text-1); font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-weight: 500; }
  .n-dim  { color: var(--text-2); font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
  .n-r    { text-align: right; }

  /* Volume */
  .vol-wrap { display: flex; align-items: center; gap: 8px; }
  .vol-num  { font-family: var(--font-mono); font-size: 12px; font-variant-numeric: tabular-nums; min-width: 34px; }
  .vol-bar  { width: 44px; height: 2px; background: rgba(255,255,255,0.06); border-radius: 1px; }
  .vol-fill { height: 100%; background: var(--blue); border-radius: 1px; }

  /* Star */
  .star-btn {
    background: none;
    border: none;
    font-size: 13px;
    cursor: pointer;
    color: var(--text-3);
    padding: 0;
    line-height: 1;
    transition: color 0.1s;
  }
  .star-btn:hover { color: var(--accent); }
  .star-btn.on    { color: var(--accent); }

  /* Empty */
  .empty {
    padding: 80px 32px;
    text-align: center;
  }
  .empty-title { font-size: 14px; font-weight: 500; color: var(--text-2); margin-bottom: 6px; }
  .empty-sub   { font-size: 12px; color: var(--text-3); }
`;

function SortTh({ label, k, right, sortKey, sortDir, onSort }) {
  const on = sortKey === k;
  return (
    <th className={`${on ? "th-on" : ""} ${right ? "th-r" : ""}`} onClick={() => onSort(k)}>
      {label}{on ? (sortDir === -1 ? " ↓" : " ↑") : ""}
    </th>
  );
}

function clr(val, med) {
  if (val == null || med == null) return undefined;
  return val < med ? "var(--pos)" : "var(--neg)";
}

export default function ResultsTable({ rows, loading, sortKey, sortDir, onSort, onRowClick, onStarClick, watchlist, visibleColumns, sectorMedians }) {
  const optCount = [visibleColumns.sparkline, visibleColumns.pb, visibleColumns.epsGrowth, visibleColumns.revGrowth, visibleColumns.momentum].filter(Boolean).length;
  const totalCols = 9 + optCount;
  const sp = { sortKey, sortDir, onSort };

  return (
    <>
      <style>{STYLE}</style>
      <div className="tbl-wrap">
        {rows.length === 0 && !loading ? (
          <div className="empty">
            <div className="empty-title">No results</div>
            <div className="empty-sub">Adjust your filters and run a new scan.</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 36, padding: "0 12px" }} />
                <SortTh label="Ticker"   k="ticker"   {...sp} />
                <SortTh label="Exchange" k="exchange" {...sp} />
                <SortTh label="Sector"   k="sector"   {...sp} />
                {visibleColumns.sparkline  && <th>Trend</th>}
                <SortTh label="Price"    k="price"     right {...sp} />
                <SortTh label="Chg %"    k="change"    right {...sp} />
                <SortTh label="P/E"      k="pe"        right {...sp} />
                {visibleColumns.pb        && <SortTh label="P/B"     k="pb"        right {...sp} />}
                {visibleColumns.epsGrowth && <SortTh label="EPS Gr%" k="epsGrowth" right {...sp} />}
                {visibleColumns.revGrowth && <SortTh label="Rev Gr%" k="revGrowth" right {...sp} />}
                <SortTh label="Vol/Avg"  k="vol"      {...sp} />
                <SortTh label="Mkt Cap"  k="mktCap"   right {...sp} />
                {visibleColumns.momentum  && <th>Mom</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows count={8} columnCount={totalCols} />
              ) : (
                rows.map((s, i) => {
                  const pos  = s.change >= 0;
                  const vr   = volRatio(s);
                  const mom  = momentumScore(s);
                  const star = watchlist.includes(s.ticker);
                  const peC  = clr(s.pe, sectorMedians[s.sector]?.pe);
                  const pbC  = clr(s.pb, sectorMedians[s.sector]?.pb);

                  return (
                    <tr key={s.ticker} onClick={() => onRowClick(s)}>
                      <td className="td-accent" style={{ padding: "0 12px", width: 36 }}>
                        <button className={`star-btn ${star ? "on" : ""}`}
                          onClick={e => { e.stopPropagation(); onStarClick(s.ticker); }}>
                          {star ? "★" : "☆"}
                        </button>
                      </td>
                      <td className="td-accent">
                        <div className="ticker-wrap">
                          <span className="ticker-sym">{s.ticker}</span>
                          <span className="ticker-co">{s.name}</span>
                        </div>
                      </td>
                      <td><span className="chip">{s.exchange}</span></td>
                      <td><span className="chip">{s.sector}</span></td>
                      {visibleColumns.sparkline && (
                        <td style={{ padding: "0 10px" }}>
                          <Sparkline positive={pos} seed={i} />
                        </td>
                      )}
                      <td className="n-base n-r">${fmt(s.price, s.price < 10 ? 3 : 2)}</td>
                      <td className={`${pos ? "n-pos" : "n-neg"} n-r`}>{pos ? "+" : ""}{fmt(s.change)}%</td>
                      <td className="n-r" style={{ color: peC ?? "var(--text-2)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{fmt(s.pe, 1)}</td>
                      {visibleColumns.pb       && <td className="n-r" style={{ color: pbC ?? "var(--text-2)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{fmt(s.pb, 1)}</td>}
                      {visibleColumns.epsGrowth && <td className={`${s.epsGrowth > 0 ? "n-pos" : s.epsGrowth < 0 ? "n-neg" : "n-dim"} n-r`}>{s.epsGrowth != null ? (s.epsGrowth > 0 ? "+" : "") + s.epsGrowth + "%" : "—"}</td>}
                      {visibleColumns.revGrowth && <td className={`${s.revGrowth > 0 ? "n-pos" : "n-neg"} n-r`}>{s.revGrowth > 0 ? "+" : ""}{s.revGrowth}%</td>}
                      <td>
                        <div className="vol-wrap">
                          <span className="vol-num" style={{ color: vr > 1.5 ? "var(--accent)" : "var(--text-2)" }}>{fmt(vr, 1)}×</span>
                          <div className="vol-bar"><div className="vol-fill" style={{ width: `${Math.min(vr / 3, 1) * 100}%` }} /></div>
                        </div>
                      </td>
                      <td className="n-dim n-r">{fmtLarge(s.mktCap)}</td>
                      {visibleColumns.momentum && <td><MomentumDots score={mom} /></td>}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
