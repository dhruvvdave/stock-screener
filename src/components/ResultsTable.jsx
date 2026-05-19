import SkeletonRows from "./SkeletonRows";
import Sparkline from "./Sparkline";
import MomentumDots from "./MomentumDots";
import { fmt, fmtLarge, fmtVol, volRatio, momentumScore } from "../data/stocks";

const STYLE = `
  .table-wrap { flex: 1; overflow: auto; }

  table { width: 100%; border-collapse: collapse; }
  thead { position: sticky; top: 0; z-index: 10; }

  th {
    background: var(--surface-2);
    color: var(--text-3);
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 500;
    padding: 8px 16px;
    text-align: left;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
    letter-spacing: 0.03em;
    transition: color 0.1s;
  }
  th:hover { color: var(--text-2); }
  th.th-active { color: var(--text-1); }
  th.th-r { text-align: right; }

  td {
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
    vertical-align: middle;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  tbody tr {
    cursor: pointer;
    transition: background 0.08s;
  }
  tbody tr:hover td { background: var(--surface-3); }
  tbody tr:hover td.td-first { box-shadow: inset 3px 0 0 var(--accent); }

  .ticker-cell { display: flex; flex-direction: column; gap: 2px; }
  .ticker-sym  {
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 13px;
    color: var(--accent);
    letter-spacing: 0.02em;
  }
  .ticker-co {
    font-family: var(--font-ui);
    font-size: 11px;
    color: var(--text-3);
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chip {
    display: inline-block;
    font-family: var(--font-ui);
    font-size: 11px;
    padding: 2px 7px;
    border: 1px solid var(--border);
    color: var(--text-3);
    border-radius: 3px;
  }

  .pos { color: var(--pos); font-family: var(--font-mono); }
  .neg { color: var(--neg); font-family: var(--font-mono); }
  .muted { color: var(--text-3); font-family: var(--font-mono); }
  .num  { font-family: var(--font-mono); color: var(--text-2); }

  .vol-wrap { display: flex; align-items: center; gap: 8px; }
  .vol-ratio { font-family: var(--font-mono); font-size: 12px; min-width: 32px; }
  .vol-bar   { width: 48px; height: 2px; background: var(--surface-3); flex-shrink: 0; }
  .vol-fill  { height: 100%; background: var(--blue); }

  .star-btn {
    background: none;
    border: none;
    font-size: 13px;
    cursor: pointer;
    color: var(--text-3);
    padding: 0;
    line-height: 1;
    transition: color 0.1s;
    display: flex;
    align-items: center;
  }
  .star-btn:hover  { color: var(--accent); }
  .star-btn.active { color: var(--accent); }

  .empty {
    padding: 80px 40px;
    text-align: center;
  }
  .empty-title {
    font-family: var(--font-ui);
    font-size: 14px;
    font-weight: 500;
    color: var(--text-3);
    margin-bottom: 8px;
  }
  .empty-sub {
    font-family: var(--font-ui);
    font-size: 12px;
    color: var(--text-3);
  }
`;

function SortTh({ label, k, right, sortKey, sortDir, onSort }) {
  const active = sortKey === k;
  return (
    <th
      className={`${active ? "th-active" : ""} ${right ? "th-r" : ""}`}
      onClick={() => onSort(k)}
    >
      {label}{active ? (sortDir === -1 ? " ↓" : " ↑") : ""}
    </th>
  );
}

function peColor(val, median) {
  if (val == null || median == null) return undefined;
  return val < median ? "var(--pos)" : "var(--neg)";
}

export default function ResultsTable({
  rows, loading, sortKey, sortDir, onSort,
  onRowClick, onStarClick, watchlist,
  visibleColumns, sectorMedians,
}) {
  const optCols = [
    visibleColumns.sparkline,
    visibleColumns.pb,
    visibleColumns.epsGrowth,
    visibleColumns.revGrowth,
    visibleColumns.momentum,
  ].filter(Boolean).length;
  const totalCols = 9 + optCols; // star + ticker + exch + sector + price + chg + pe + vol + mktcap

  const sp = { sortKey, sortDir, onSort };

  return (
    <>
      <style>{STYLE}</style>
      <div className="table-wrap">
        {rows.length === 0 && !loading ? (
          <div className="empty">
            <div className="empty-title">No results</div>
            <div className="empty-sub">Adjust your filters and run a new scan.</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 32, padding: "8px 12px" }} />
                <SortTh label="Ticker"   k="ticker"   {...sp} />
                <SortTh label="Exchange" k="exchange" {...sp} />
                <SortTh label="Sector"   k="sector"   {...sp} />
                {visibleColumns.sparkline && <th>Trend</th>}
                <SortTh label="Price"   k="price"    right {...sp} />
                <SortTh label="Chg %"   k="change"   right {...sp} />
                <SortTh label="P/E"     k="pe"       right {...sp} />
                {visibleColumns.pb       && <SortTh label="P/B"    k="pb"        right {...sp} />}
                {visibleColumns.epsGrowth && <SortTh label="EPS Gr%" k="epsGrowth" right {...sp} />}
                {visibleColumns.revGrowth && <SortTh label="Rev Gr%" k="revGrowth" right {...sp} />}
                <SortTh label="Vol/Avg" k="vol"      {...sp} />
                <SortTh label="Mkt Cap" k="mktCap"   right {...sp} />
                {visibleColumns.momentum && <th>Momentum</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows count={8} columnCount={totalCols} />
              ) : (
                rows.map((s, i) => {
                  const chgPos  = s.change >= 0;
                  const vr      = volRatio(s);
                  const vrPct   = Math.min(vr / 3, 1);
                  const mom     = momentumScore(s);
                  const starred = watchlist.includes(s.ticker);
                  const peClr   = peColor(s.pe, sectorMedians[s.sector]?.pe);
                  const pbClr   = peColor(s.pb, sectorMedians[s.sector]?.pb);

                  return (
                    <tr key={s.ticker} onClick={() => onRowClick(s)}>
                      <td className="td-first" style={{ padding: "10px 12px", width: 32 }}>
                        <button
                          className={`star-btn ${starred ? "active" : ""}`}
                          onClick={e => { e.stopPropagation(); onStarClick(s.ticker); }}
                        >
                          {starred ? "★" : "☆"}
                        </button>
                      </td>
                      <td className="td-first">
                        <div className="ticker-cell">
                          <span className="ticker-sym">{s.ticker}</span>
                          <span className="ticker-co">{s.name}</span>
                        </div>
                      </td>
                      <td><span className="chip">{s.exchange}</span></td>
                      <td><span className="chip">{s.sector}</span></td>
                      {visibleColumns.sparkline && (
                        <td style={{ padding: "6px 12px" }}>
                          <Sparkline positive={chgPos} seed={i} />
                        </td>
                      )}
                      <td className="th-r" style={{ fontWeight: 500, color: "var(--text-1)", textAlign: "right" }}>
                        ${fmt(s.price, s.price < 10 ? 3 : 2)}
                      </td>
                      <td style={{ textAlign: "right" }} className={chgPos ? "pos" : "neg"}>
                        {chgPos ? "+" : ""}{fmt(s.change)}%
                      </td>
                      <td style={{ textAlign: "right", color: peClr ?? "var(--text-2)" }} className="num">
                        {fmt(s.pe, 1)}
                      </td>
                      {visibleColumns.pb && (
                        <td style={{ textAlign: "right", color: pbClr ?? "var(--text-2)" }} className="num">
                          {fmt(s.pb, 1)}
                        </td>
                      )}
                      {visibleColumns.epsGrowth && (
                        <td style={{ textAlign: "right" }} className={s.epsGrowth > 0 ? "pos" : s.epsGrowth < 0 ? "neg" : "muted"}>
                          {s.epsGrowth != null ? (s.epsGrowth > 0 ? "+" : "") + s.epsGrowth + "%" : "—"}
                        </td>
                      )}
                      {visibleColumns.revGrowth && (
                        <td style={{ textAlign: "right" }} className={s.revGrowth > 0 ? "pos" : "neg"}>
                          {s.revGrowth > 0 ? "+" : ""}{s.revGrowth}%
                        </td>
                      )}
                      <td>
                        <div className="vol-wrap">
                          <span className="vol-ratio" style={{ color: vr > 1.5 ? "var(--accent)" : "var(--text-2)" }}>
                            {fmt(vr, 1)}×
                          </span>
                          <div className="vol-bar">
                            <div className="vol-fill" style={{ width: `${vrPct * 100}%` }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }} className="num">{fmtLarge(s.mktCap)}</td>
                      {visibleColumns.momentum && (
                        <td><MomentumDots score={mom} /></td>
                      )}
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
