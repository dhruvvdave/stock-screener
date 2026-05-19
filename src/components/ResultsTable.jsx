import SkeletonRows from "./SkeletonRows";
import Sparkline from "./Sparkline";
import MomentumDots from "./MomentumDots";
import { fmt, fmtLarge, fmtVol, volRatio, momentumScore, SECTOR_BADGE_COLOR, SECTOR_ICON } from "../data/stocks";

const STYLE = `
  .table-wrap { flex: 1; overflow: auto; position: relative; }

  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead { position: sticky; top: 0; z-index: 10; }
  th {
    background: #111;
    color: #444;
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-weight: 500;
    padding: 9px 12px;
    text-align: left;
    border-bottom: 1px solid #222;
    border-right: 1px solid #1a1a1a;
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
    transition: color 0.15s;
  }
  th:hover { color: #f0b429; }
  th.th-sorted { color: #f0b429; }
  th.th-right { text-align: right; }

  td {
    padding: 8px 12px;
    border-bottom: 1px solid #1a1a1a;
    border-right: 1px solid #161616;
    white-space: nowrap;
    vertical-align: middle;
  }
  tbody tr { cursor: pointer; transition: background 0.1s; }
  tbody tr:hover td { background: #161616; }
  tbody tr:hover td:first-child { box-shadow: inset 3px 0 0 #f0b429; }

  .ticker-cell { display: flex; flex-direction: column; gap: 2px; }
  .ticker-sym  { font-weight: 600; color: #f0b429; font-size: 12px; letter-spacing: 0.04em; }
  .ticker-name { font-size: 9px; color: #444; max-width: 130px; overflow: hidden; text-overflow: ellipsis; }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 9px;
    padding: 2px 8px;
    letter-spacing: 0.05em;
    border-radius: 999px;
    border: 1px solid #2a2a2a;
    color: #555;
  }
  .badge-icon { font-size: 8px; font-weight: 700; opacity: 0.6; }
  .badge-blue   { background: rgba(59,130,246,0.08);  color: #3b82f6; border-color: rgba(59,130,246,0.2); }
  .badge-yellow { background: rgba(240,180,41,0.08);  color: #f0b429; border-color: rgba(240,180,41,0.2); }
  .badge-green  { background: rgba(34,197,94,0.08);   color: #22c55e; border-color: rgba(34,197,94,0.2); }
  .badge-cyan   { background: rgba(6,182,212,0.08);   color: #06b6d4; border-color: rgba(6,182,212,0.2); }
  .badge-purple { background: rgba(168,85,247,0.08);  color: #a855f7; border-color: rgba(168,85,247,0.2); }
  .badge-red    { background: rgba(239,68,68,0.08);   color: #ef4444; border-color: rgba(239,68,68,0.2); }

  .chg-pos { color: #22c55e; }
  .chg-neg { color: #ef4444; }
  .neutral { color: #555; }
  .col-r { text-align: right; }

  .vol-bar-wrap { display: flex; align-items: center; gap: 6px; }
  .vol-bar { height: 2px; background: #222; width: 52px; flex-shrink: 0; }
  .vol-bar-fill { height: 100%; background: #3b82f6; transition: width 0.4s; }

  .star-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 12px;
    padding: 0 2px;
    line-height: 1;
    transition: transform 0.15s;
    color: #2a2a2a;
  }
  .star-btn.starred { color: #f0b429; }
  .star-btn:hover { transform: scale(1.2); }

  .empty-state {
    padding: 80px;
    text-align: center;
    color: #444;
    font-size: 11px;
    letter-spacing: 0.05em;
  }
  .empty-state h3 { font-size: 14px; color: #333; margin-bottom: 8px; font-weight: 400; }

  @keyframes row-in { from { opacity:0; transform:translateY(3px); } to { opacity:1; transform:translateY(0); } }
  .row-in { animation: row-in 0.18s ease forwards; }
`;

function sectorBadge(sector) {
  const color = SECTOR_BADGE_COLOR[sector];
  return color ? `badge badge-${color}` : "badge";
}

function peColor(pe, median) {
  if (pe == null || median == null) return "#555";
  return pe < median ? "#22c55e" : "#ef4444";
}

function SortTh({ label, k, right, sortKey, sortDir, onSort }) {
  const sorted = sortKey === k;
  return (
    <th
      className={`${sorted ? "th-sorted" : ""} ${right ? "th-right" : ""}`}
      onClick={() => onSort(k)}
    >
      {label}{sorted ? (sortDir === -1 ? " ▼" : " ▲") : ""}
    </th>
  );
}

export default function ResultsTable({
  rows,
  loading,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
  onStarClick,
  watchlist,
  visibleColumns,
  sectorMedians,
}) {
  // count visible columns for skeleton
  const baseColCount = 8; // ticker, exch, sector, price, chg, pe, vol/avg, mktcap
  const optionalCount = [
    visibleColumns.sparkline,
    visibleColumns.pb,
    visibleColumns.epsGrowth,
    visibleColumns.revGrowth,
    visibleColumns.momentum,
  ].filter(Boolean).length;
  const starCol = 1;
  const totalCols = baseColCount + optionalCount + starCol;

  const thProps = { sortKey, sortDir, onSort };

  return (
    <>
      <style>{STYLE}</style>
      <div className="table-wrap">
        {rows.length === 0 && !loading ? (
          <div className="empty-state">
            <h3>NO RESULTS FOUND</h3>
            <p>Adjust filters and run a new scan.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 28, padding: "9px 8px" }} />
                <SortTh label="TICKER" k="ticker" {...thProps} />
                <SortTh label="EXCH"   k="exchange" {...thProps} />
                <SortTh label="SECTOR" k="sector" {...thProps} />
                {visibleColumns.sparkline && <th>TREND</th>}
                <SortTh label="PRICE"  k="price" right {...thProps} />
                <SortTh label="CHG %"  k="change" right {...thProps} />
                <SortTh label="P/E"    k="pe" right {...thProps} />
                {visibleColumns.pb      && <SortTh label="P/B"    k="pb" right {...thProps} />}
                {visibleColumns.epsGrowth && <SortTh label="EPS GR%" k="epsGrowth" right {...thProps} />}
                {visibleColumns.revGrowth && <SortTh label="REV GR%" k="revGrowth" right {...thProps} />}
                <SortTh label="VOL/AVG" k="vol" {...thProps} />
                <SortTh label="MKT CAP" k="mktCap" right {...thProps} />
                {visibleColumns.momentum && <th>MOM</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows count={8} columnCount={totalCols} />
              ) : (
                rows.map((s, i) => {
                  const chgPos = s.change >= 0;
                  const vr = volRatio(s);
                  const vrPct = Math.min(vr / 3, 1);
                  const mom = momentumScore(s);
                  const isStarred = watchlist.includes(s.ticker);
                  const peClr = peColor(s.pe, sectorMedians[s.sector]?.pe);
                  const pbClr = peColor(s.pb, sectorMedians[s.sector]?.pb);

                  return (
                    <tr
                      key={s.ticker}
                      className="row-in"
                      style={{ animationDelay: `${Math.min(i * 18, 300)}ms` }}
                      onClick={() => onRowClick(s)}
                    >
                      <td style={{ padding: "8px 8px", width: 28 }}>
                        <button
                          className={`star-btn ${isStarred ? "starred" : ""}`}
                          onClick={e => { e.stopPropagation(); onStarClick(s.ticker); }}
                          title={isStarred ? "Remove from watchlist" : "Add to watchlist"}
                        >
                          {isStarred ? "★" : "☆"}
                        </button>
                      </td>
                      <td>
                        <div className="ticker-cell">
                          <span className="ticker-sym">{s.ticker}</span>
                          <span className="ticker-name">{s.name}</span>
                        </div>
                      </td>
                      <td><span className="badge">{s.exchange}</span></td>
                      <td>
                        <span className={sectorBadge(s.sector)}>
                          <span className="badge-icon">{SECTOR_ICON[s.sector]}</span>
                          {s.sector}
                        </span>
                      </td>
                      {visibleColumns.sparkline && (
                        <td style={{ padding: "4px 10px" }}>
                          <Sparkline positive={chgPos} seed={i} />
                        </td>
                      )}
                      <td className="col-r" style={{ fontWeight: 500 }}>
                        ${fmt(s.price, s.price < 10 ? 3 : 2)}
                      </td>
                      <td className={`col-r ${chgPos ? "chg-pos" : "chg-neg"}`}>
                        {chgPos ? "+" : ""}{fmt(s.change)}%
                      </td>
                      <td className="col-r" style={{ color: peClr }}>
                        {fmt(s.pe, 1)}
                      </td>
                      {visibleColumns.pb && (
                        <td className="col-r" style={{ color: pbClr }}>
                          {fmt(s.pb, 1)}
                        </td>
                      )}
                      {visibleColumns.epsGrowth && (
                        <td className={`col-r ${s.epsGrowth > 0 ? "chg-pos" : s.epsGrowth < 0 ? "chg-neg" : "neutral"}`}>
                          {s.epsGrowth != null ? (s.epsGrowth > 0 ? "+" : "") + s.epsGrowth + "%" : "—"}
                        </td>
                      )}
                      {visibleColumns.revGrowth && (
                        <td className={`col-r ${s.revGrowth > 0 ? "chg-pos" : "chg-neg"}`}>
                          {s.revGrowth > 0 ? "+" : ""}{s.revGrowth}%
                        </td>
                      )}
                      <td>
                        <div className="vol-bar-wrap">
                          <span style={{ fontSize: "10px", color: vr > 1.5 ? "#f0b429" : "#444", minWidth: 30 }}>
                            {fmt(vr, 1)}x
                          </span>
                          <div className="vol-bar">
                            <div className="vol-bar-fill" style={{ width: `${vrPct * 100}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="col-r">{fmtLarge(s.mktCap)}</td>
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
