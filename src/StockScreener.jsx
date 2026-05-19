import { useState, useEffect, useCallback } from "react";

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=IBM+Plex+Sans:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0a0a;
    --surface: #111111;
    --surface2: #161616;
    --surface3: #1c1c1c;
    --border: #2a2a2a;
    --border2: #333;
    --text: #e8e8e8;
    --muted: #666;
    --muted2: #444;
    --accent: #f0b429;
    --accent2: #e07b00;
    --green: #22c55e;
    --red: #ef4444;
    --blue: #3b82f6;
    --cyan: #06b6d4;
    --purple: #a855f7;
    --mono: 'IBM Plex Mono', monospace;
    --sans: 'IBM Plex Sans', sans-serif;
  }

  body { background: var(--bg); color: var(--text); font-family: var(--mono); }

  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* HEADER */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .header-left { display: flex; align-items: center; gap: 16px; }
  .logo {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.15em;
    color: var(--accent);
    text-transform: uppercase;
  }
  .logo span { color: var(--muted); font-weight: 300; }
  .header-tag {
    font-size: 10px;
    padding: 2px 8px;
    border: 1px solid var(--border2);
    color: var(--muted);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .header-right { display: flex; align-items: center; gap: 20px; }
  .market-pill {
    display: flex; align-items: center; gap: 6px;
    font-size: 11px; color: var(--muted);
  }
  .market-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .clock { font-size: 11px; color: var(--muted); letter-spacing: 0.05em; }

  /* MAIN LAYOUT */
  .main { display: flex; flex: 1; }

  /* SIDEBAR */
  .sidebar {
    width: 280px;
    min-width: 280px;
    border-right: 1px solid var(--border);
    background: var(--surface);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
  .sidebar-section { border-bottom: 1px solid var(--border); }
  .sidebar-title {
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--muted);
    padding: 12px 16px 8px;
    font-family: var(--sans);
  }

  /* FILTER ROWS */
  .filter-row { padding: 8px 16px; display: flex; flex-direction: column; gap: 4px; }
  .filter-label { font-size: 10px; color: var(--muted); letter-spacing: 0.08em; text-transform: uppercase; }
  .filter-controls { display: flex; gap: 6px; align-items: center; }
  .filter-input {
    flex: 1;
    background: var(--surface3);
    border: 1px solid var(--border);
    color: var(--text);
    font-family: var(--mono);
    font-size: 11px;
    padding: 5px 8px;
    outline: none;
    transition: border-color 0.15s;
  }
  .filter-input:focus { border-color: var(--accent); }
  .filter-input::placeholder { color: var(--muted2); }
  .filter-sep { font-size: 10px; color: var(--muted2); }

  /* EXCHANGE TOGGLE */
  .exchange-row { padding: 8px 16px; display: flex; gap: 6px; flex-wrap: wrap; }
  .ex-btn {
    font-family: var(--mono);
    font-size: 10px;
    padding: 4px 10px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    letter-spacing: 0.08em;
    transition: all 0.15s;
  }
  .ex-btn.active { border-color: var(--accent); color: var(--accent); background: rgba(240,180,41,0.05); }

  /* SECTOR TOGGLE */
  .sector-row { padding: 8px 16px; display: flex; gap: 5px; flex-wrap: wrap; }
  .sector-btn {
    font-family: var(--mono);
    font-size: 9px;
    padding: 3px 8px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    letter-spacing: 0.06em;
    transition: all 0.15s;
  }
  .sector-btn.active { border-color: var(--cyan); color: var(--cyan); background: rgba(6,182,212,0.05); }

  /* SCAN BTN */
  .scan-wrap { padding: 16px; }
  .scan-btn {
    width: 100%;
    background: var(--accent);
    color: #000;
    border: none;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    padding: 10px;
    cursor: pointer;
    transition: background 0.15s;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .scan-btn:hover { background: var(--accent2); }
  .scan-btn:disabled { background: var(--muted2); color: var(--muted); cursor: not-allowed; }

  /* STATS ROW */
  .stats-bar {
    display: flex; gap: 0;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    overflow-x: auto;
  }
  .stat-cell {
    padding: 10px 20px;
    border-right: 1px solid var(--border);
    min-width: 120px;
  }
  .stat-label { font-size: 9px; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 3px; }
  .stat-val { font-size: 16px; font-weight: 500; color: var(--accent); }
  .stat-sub { font-size: 9px; color: var(--muted); margin-top: 1px; }

  /* CONTENT */
  .content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

  /* TOOLBAR */
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--surface2);
    gap: 12px;
  }
  .toolbar-left { display: flex; align-items: center; gap: 12px; }
  .result-count { font-size: 11px; color: var(--muted); }
  .result-count strong { color: var(--accent); }
  .search-box {
    background: var(--surface3);
    border: 1px solid var(--border);
    color: var(--text);
    font-family: var(--mono);
    font-size: 11px;
    padding: 5px 10px;
    width: 180px;
    outline: none;
  }
  .search-box:focus { border-color: var(--accent); }
  .sort-select {
    background: var(--surface3);
    border: 1px solid var(--border);
    color: var(--text);
    font-family: var(--mono);
    font-size: 11px;
    padding: 5px 8px;
    outline: none;
    cursor: pointer;
  }

  /* TABLE */
  .table-wrap { flex: 1; overflow: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead { position: sticky; top: 0; z-index: 10; }
  th {
    background: var(--surface);
    color: var(--muted);
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-weight: 500;
    padding: 9px 12px;
    text-align: left;
    border-bottom: 1px solid var(--border);
    border-right: 1px solid var(--border);
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
  }
  th:hover { color: var(--accent); }
  th.sorted { color: var(--accent); }
  td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    border-right: 1px solid #1a1a1a;
    white-space: nowrap;
    font-family: var(--mono);
  }
  tr:hover td { background: var(--surface2); }
  tr.highlight td { background: rgba(240,180,41,0.03); }

  .ticker-cell { display: flex; flex-direction: column; gap: 2px; }
  .ticker { font-weight: 600; color: var(--accent); font-size: 12px; letter-spacing: 0.05em; }
  .company { font-size: 9px; color: var(--muted); max-width: 130px; overflow: hidden; text-overflow: ellipsis; }

  .price { font-weight: 500; }
  .change-pos { color: var(--green); }
  .change-neg { color: var(--red); }
  .neutral { color: var(--muted); }

  .badge {
    display: inline-block;
    font-size: 9px;
    padding: 2px 7px;
    letter-spacing: 0.06em;
    border-radius: 0;
  }
  .badge-green { background: rgba(34,197,94,0.1); color: var(--green); border: 1px solid rgba(34,197,94,0.2); }
  .badge-red { background: rgba(239,68,68,0.1); color: var(--red); border: 1px solid rgba(239,68,68,0.2); }
  .badge-yellow { background: rgba(240,180,41,0.1); color: var(--accent); border: 1px solid rgba(240,180,41,0.2); }
  .badge-blue { background: rgba(59,130,246,0.1); color: var(--blue); border: 1px solid rgba(59,130,246,0.2); }
  .badge-purple { background: rgba(168,85,247,0.1); color: var(--purple); border: 1px solid rgba(168,85,247,0.2); }
  .badge-cyan { background: rgba(6,182,212,0.1); color: var(--cyan); border: 1px solid rgba(6,182,212,0.2); }

  .vol-bar-wrap { display: flex; align-items: center; gap: 6px; }
  .vol-bar { height: 3px; background: var(--border); flex: 1; max-width: 60px; }
  .vol-bar-fill { height: 100%; background: var(--blue); transition: width 0.3s; }

  .momentum-dots { display: flex; gap: 2px; }
  .m-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--border); }
  .m-dot.on { background: var(--green); }
  .m-dot.neg { background: var(--red); }

  /* LOADING */
  .loading-overlay {
    position: absolute; inset: 0;
    background: rgba(10,10,10,0.85);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 16px; z-index: 50;
  }
  .loading-bar-wrap { width: 200px; height: 2px; background: var(--border); }
  .loading-bar { height: 100%; background: var(--accent); animation: load 1.2s ease-in-out infinite; }
  @keyframes load { 0%{width:0%} 50%{width:70%} 100%{width:100%} }
  .loading-text { font-size: 11px; color: var(--muted); letter-spacing: 0.1em; }

  /* EMPTY */
  .empty-state { padding: 60px; text-align: center; color: var(--muted); font-size: 11px; letter-spacing: 0.05em; }
  .empty-state h3 { font-size: 13px; color: var(--muted); margin-bottom: 8px; font-weight: 400; }

  /* DETAIL PANEL */
  .detail-panel {
    position: fixed; right: 0; top: 0; bottom: 0; width: 340px;
    background: var(--surface);
    border-left: 1px solid var(--border);
    z-index: 200;
    display: flex; flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.25s ease;
    overflow-y: auto;
  }
  .detail-panel.open { transform: translateX(0); }
  .detail-header {
    padding: 16px; border-bottom: 1px solid var(--border);
    display: flex; align-items: flex-start; justify-content: space-between;
  }
  .detail-ticker { font-size: 20px; font-weight: 600; color: var(--accent); }
  .detail-name { font-size: 11px; color: var(--muted); margin-top: 3px; font-family: var(--sans); }
  .close-btn {
    background: none; border: 1px solid var(--border); color: var(--muted);
    cursor: pointer; font-family: var(--mono); font-size: 11px; padding: 4px 10px;
    transition: all 0.15s;
  }
  .close-btn:hover { border-color: var(--red); color: var(--red); }
  .detail-section { padding: 14px 16px; border-bottom: 1px solid var(--border); }
  .detail-section-title { font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
  .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .detail-kv { display: flex; flex-direction: column; gap: 2px; }
  .detail-k { font-size: 9px; color: var(--muted); letter-spacing: 0.08em; text-transform: uppercase; }
  .detail-v { font-size: 13px; color: var(--text); font-weight: 500; }

  /* MINI CHART */
  .mini-chart { padding: 14px 16px; border-bottom: 1px solid var(--border); }
  .chart-canvas { width: 100%; height: 80px; }
  svg.sparkline { width: 100%; height: 80px; }
  .spark-line { fill: none; stroke: var(--accent); stroke-width: 1.5; }
  .spark-area { fill: url(#spark-grad); opacity: 0.3; }

  /* SCROLLBAR */
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border2); }

  /* ANIMATIONS */
  @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
  .row-enter { animation: fadeIn 0.2s ease forwards; }

  .col-right { text-align: right; }
  .col-right td { text-align: right; }
`;

const SECTORS = ["Technology", "Energy", "Finance", "Healthcare", "Materials", "Industrials", "Consumer", "Utilities"];

const STOCKS = [
  { ticker:"SHOP", name:"Shopify Inc.", exchange:"TSX", sector:"Technology", price:92.4, change:3.2, pe:68.2, pb:8.1, epsGrowth:22, revGrowth:24, mktCap:118.2, avgVol:4.2, vol:6.1, beta:1.8 },
  { ticker:"CNQ", name:"Canadian Natural Resources", exchange:"TSX", sector:"Energy", price:46.8, change:-1.1, pe:11.2, pb:2.4, epsGrowth:8, revGrowth:5, mktCap:87.6, avgVol:8.1, vol:7.9, beta:1.2 },
  { ticker:"RY", name:"Royal Bank of Canada", exchange:"TSX", sector:"Finance", price:138.5, change:0.8, pe:12.4, pb:2.1, epsGrowth:9, revGrowth:7, mktCap:196.4, avgVol:5.6, vol:5.2, beta:0.8 },
  { ticker:"TD", name:"Toronto-Dominion Bank", exchange:"TSX", sector:"Finance", price:78.2, change:-0.4, pe:10.8, pb:1.6, epsGrowth:5, revGrowth:4, mktCap:143.1, avgVol:9.2, vol:8.7, beta:0.75 },
  { ticker:"ATD", name:"Alimentation Couche-Tard", exchange:"TSX", sector:"Consumer", price:74.1, change:1.4, pe:18.3, pb:3.9, epsGrowth:14, revGrowth:11, mktCap:65.4, avgVol:3.1, vol:4.2, beta:0.7 },
  { ticker:"SU", name:"Suncor Energy Inc.", exchange:"TSX", sector:"Energy", price:55.3, change:2.1, pe:8.7, pb:1.8, epsGrowth:12, revGrowth:9, mktCap:74.3, avgVol:10.2, vol:12.4, beta:1.3 },
  { ticker:"BCE", name:"BCE Inc.", exchange:"TSX", sector:"Utilities", price:33.4, change:-0.9, pe:14.2, pb:2.8, epsGrowth:-2, revGrowth:1, mktCap:30.5, avgVol:7.8, vol:6.9, beta:0.55 },
  { ticker:"ENB", name:"Enbridge Inc.", exchange:"TSX", sector:"Energy", price:56.1, change:0.6, pe:20.1, pb:2.3, epsGrowth:6, revGrowth:5, mktCap:113.2, avgVol:12.3, vol:11.8, beta:0.6 },
  { ticker:"AAPL", name:"Apple Inc.", exchange:"NASDAQ", sector:"Technology", price:211.4, change:1.8, pe:32.1, pb:48.2, epsGrowth:10, revGrowth:6, mktCap:3180, avgVol:58.4, vol:64.2, beta:1.2 },
  { ticker:"NVDA", name:"NVIDIA Corporation", exchange:"NASDAQ", sector:"Technology", price:136.2, change:4.7, pe:42.8, pb:36.1, epsGrowth:88, revGrowth:122, mktCap:3340, avgVol:310.2, vol:422.8, beta:1.95 },
  { ticker:"MSFT", name:"Microsoft Corporation", exchange:"NASDAQ", sector:"Technology", price:448.2, change:2.1, pe:36.4, pb:12.8, epsGrowth:18, revGrowth:16, mktCap:3330, avgVol:22.1, vol:24.8, beta:0.9 },
  { ticker:"JPM", name:"JPMorgan Chase & Co.", exchange:"NYSE", sector:"Finance", price:248.6, change:1.2, pe:13.2, pb:2.1, epsGrowth:11, revGrowth:9, mktCap:710, avgVol:9.8, vol:10.4, beta:1.1 },
  { ticker:"XOM", name:"Exxon Mobil Corporation", exchange:"NYSE", sector:"Energy", price:114.3, change:-0.8, pe:14.6, pb:2.2, epsGrowth:7, revGrowth:4, mktCap:455, avgVol:18.2, vol:17.6, beta:0.95 },
  { ticker:"META", name:"Meta Platforms Inc.", exchange:"NASDAQ", sector:"Technology", price:612.4, change:3.4, pe:28.6, pb:8.9, epsGrowth:52, revGrowth:22, mktCap:1560, avgVol:15.8, vol:19.2, beta:1.3 },
  { ticker:"AMZN", name:"Amazon.com Inc.", exchange:"NASDAQ", sector:"Technology", price:224.1, change:2.6, pe:45.2, pb:9.4, epsGrowth:94, revGrowth:11, mktCap:2360, avgVol:40.1, vol:46.8, beta:1.4 },
  { ticker:"LLY", name:"Eli Lilly and Company", exchange:"NYSE", sector:"Healthcare", price:872.4, change:5.8, pe:68.4, pb:44.2, epsGrowth:102, revGrowth:45, mktCap:828, avgVol:3.8, vol:5.2, beta:0.5 },
  { ticker:"JNJ", name:"Johnson & Johnson", exchange:"NYSE", sector:"Healthcare", price:162.8, change:-0.3, pe:22.1, pb:5.6, epsGrowth:5, revGrowth:3, mktCap:392, avgVol:7.4, vol:7.1, beta:0.55 },
  { ticker:"NTR", name:"Nutrien Ltd.", exchange:"TSX", sector:"Materials", price:62.4, change:1.8, pe:12.8, pb:1.6, epsGrowth:15, revGrowth:8, mktCap:30.2, avgVol:4.2, vol:5.8, beta:1.1 },
  { ticker:"ABX", name:"Barrick Gold Corporation", exchange:"TSX", sector:"Materials", price:22.8, change:2.4, pe:18.4, pb:1.4, epsGrowth:28, revGrowth:14, mktCap:39.8, avgVol:18.6, vol:24.2, beta:0.6 },
  { ticker:"CAT", name:"Caterpillar Inc.", exchange:"NYSE", sector:"Industrials", price:384.2, change:-1.2, pe:16.8, pb:8.4, epsGrowth:6, revGrowth:3, mktCap:191, avgVol:2.8, vol:2.6, beta:1.0 },
  { ticker:"CP", name:"Canadian Pacific Kansas City", exchange:"TSX", sector:"Industrials", price:108.4, change:0.9, pe:28.4, pb:3.8, epsGrowth:16, revGrowth:12, mktCap:103.2, avgVol:3.2, vol:3.8, beta:0.7 },
  { ticker:"GOOG", name:"Alphabet Inc.", exchange:"NASDAQ", sector:"Technology", price:176.8, change:1.5, pe:24.8, pb:6.8, epsGrowth:28, revGrowth:15, mktCap:2180, avgVol:24.6, vol:26.4, beta:1.05 },
  { ticker:"WMT", name:"Walmart Inc.", exchange:"NYSE", sector:"Consumer", price:98.4, change:0.4, pe:36.2, pb:7.8, epsGrowth:14, revGrowth:6, mktCap:792, avgVol:12.4, vol:13.2, beta:0.5 },
  { ticker:"GSI.V", name:"Gatekeeper Systems Inc.", exchange:"TSX-V", sector:"Technology", price:0.48, change:6.7, pe:null, pb:2.1, epsGrowth:null, revGrowth:32, mktCap:0.048, avgVol:0.8, vol:1.6, beta:1.8 },
  { ticker:"UEC", name:"Uranium Energy Corp.", exchange:"NYSE", sector:"Energy", price:6.84, change:3.2, pe:null, pb:3.8, epsGrowth:null, revGrowth:48, mktCap:2.1, avgVol:4.8, vol:7.2, beta:2.1 },
];

function fmt(n, decimals = 2) {
  if (n == null) return "—";
  return n.toFixed(decimals);
}
function fmtLarge(n) {
  if (n == null) return "—";
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}T`;
  if (n >= 1) return `$${n.toFixed(1)}B`;
  return `$${(n * 1000).toFixed(0)}M`;
}
function fmtVol(n) {
  if (n >= 100) return `${n.toFixed(0)}M`;
  if (n >= 1) return `${n.toFixed(1)}M`;
  return `${(n * 1000).toFixed(0)}K`;
}

function Sparkline({ positive }) {
  const pts = Array.from({ length: 20 }, (_, i) => {
    const trend = positive ? i * 1.5 : -i * 1.2;
    return 20 + trend + (Math.random() - 0.5) * 8;
  });
  const min = Math.min(...pts), max = Math.max(...pts);
  const norm = pts.map(p => (p - min) / (max - min || 1));
  const w = 300, h = 80;
  const coords = norm.map((v, i) => `${(i / (norm.length - 1)) * w},${h - v * h * 0.85 - h * 0.05}`);
  const path = "M" + coords.join(" L");
  const area = path + ` L${w},${h} L0,${h} Z`;
  const color = positive ? "#22c55e" : "#ef4444";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "80px" }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sg)" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function MomentumDots({ score }) {
  return (
    <div className="momentum-dots">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className={`m-dot ${i <= score ? (score >= 3 ? "on" : "neg") : ""}`} />
      ))}
    </div>
  );
}

export default function StockScreener() {
  const [clock, setClock] = useState("");
  const [filters, setFilters] = useState({
    exchanges: ["TSX", "TSX-V", "NYSE", "NASDAQ"],
    sectors: [...SECTORS],
    minPrice: "", maxPrice: "",
    minPE: "", maxPE: "",
    minPB: "", maxPB: "",
    minEPSGrowth: "",
    minRevGrowth: "",
    minVolRatio: "",
    minMktCap: "", maxMktCap: "",
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(STOCKS);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("mktCap");
  const [sortDir, setSortDir] = useState(-1);
  const [selected, setSelected] = useState(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(d.toLocaleTimeString("en-US", { hour12: false }));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const toggleExchange = (ex) => {
    setFilters(f => ({
      ...f,
      exchanges: f.exchanges.includes(ex) ? f.exchanges.filter(e => e !== ex) : [...f.exchanges, ex]
    }));
  };
  const toggleSector = (s) => {
    setFilters(f => ({
      ...f,
      sectors: f.sectors.includes(s) ? f.sectors.filter(x => x !== s) : [...f.sectors, s]
    }));
  };

  const runScan = useCallback(() => {
    setLoading(true);
    setScanned(true);
    setTimeout(() => {
      const f = filters;
      const out = STOCKS.filter(s => {
        if (!f.exchanges.includes(s.exchange)) return false;
        if (!f.sectors.includes(s.sector)) return false;
        if (f.minPrice && s.price < +f.minPrice) return false;
        if (f.maxPrice && s.price > +f.maxPrice) return false;
        if (f.minPE && (s.pe == null || s.pe < +f.minPE)) return false;
        if (f.maxPE && (s.pe == null || s.pe > +f.maxPE)) return false;
        if (f.minPB && s.pb < +f.minPB) return false;
        if (f.maxPB && s.pb > +f.maxPB) return false;
        if (f.minEPSGrowth && (s.epsGrowth == null || s.epsGrowth < +f.minEPSGrowth)) return false;
        if (f.minRevGrowth && s.revGrowth < +f.minRevGrowth) return false;
        if (f.minVolRatio) {
          const ratio = s.vol / s.avgVol;
          if (ratio < +f.minVolRatio) return false;
        }
        if (f.minMktCap && s.mktCap < +f.minMktCap) return false;
        if (f.maxMktCap && s.mktCap > +f.maxMktCap) return false;
        return true;
      });
      setResults(out);
      setLoading(false);
    }, 900);
  }, [filters]);

  const sorted = [...results]
    .filter(s => !search || s.ticker.includes(search.toUpperCase()) || s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey] ?? -Infinity, bv = b[sortKey] ?? -Infinity;
      return (av - bv) * sortDir;
    });

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(-1); }
  };

  const SortTh = ({ label, k, right }) => (
    <th className={`${sortKey === k ? "sorted" : ""} ${right ? "col-right" : ""}`} onClick={() => handleSort(k)}>
      {label}{sortKey === k ? (sortDir === -1 ? " ▼" : " ▲") : ""}
    </th>
  );

  const volRatio = (s) => s.vol / s.avgVol;
  const momentumScore = (s) => {
    let sc = 0;
    if (s.change > 0) sc++;
    if (s.change > 2) sc++;
    if (volRatio(s) > 1.2) sc++;
    if (s.revGrowth > 15) sc++;
    if (s.epsGrowth > 10) sc++;
    return sc;
  };

  const sectorBadgeClass = (sec) => {
    const map = { Technology: "blue", Energy: "yellow", Finance: "green", Healthcare: "cyan", Materials: "purple", Consumer: "red" };
    return map[sec] ? `badge badge-${map[sec]}` : "badge";
  };

  const greenCount = sorted.filter(s => s.change >= 0).length;
  const avgChange = sorted.length ? (sorted.reduce((a, s) => a + s.change, 0) / sorted.length).toFixed(2) : "0";
  const highMom = sorted.filter(s => momentumScore(s) >= 4).length;

  return (
    <>
      <style>{STYLE}</style>
      <div className="app">
        <div className="header">
          <div className="header-left">
            <div className="logo">MKTSCAN<span>/PRO</span></div>
            <div className="header-tag">BETA</div>
          </div>
          <div className="header-right">
            <div className="market-pill"><div className="market-dot" /><span>MARKETS OPEN</span></div>
            <div className="clock">{clock} EST</div>
          </div>
        </div>

        <div className="main">
          <div className="sidebar">
            <div className="sidebar-section">
              <div className="sidebar-title">Exchange</div>
              <div className="exchange-row">
                {["TSX", "TSX-V", "NYSE", "NASDAQ"].map(ex => (
                  <button key={ex} className={`ex-btn ${filters.exchanges.includes(ex) ? "active" : ""}`} onClick={() => toggleExchange(ex)}>{ex}</button>
                ))}
              </div>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-title">Sector</div>
              <div className="sector-row">
                {SECTORS.map(s => (
                  <button key={s} className={`sector-btn ${filters.sectors.includes(s) ? "active" : ""}`} onClick={() => toggleSector(s)}>{s}</button>
                ))}
              </div>
            </div>

            <div className="sidebar-section">
              <div className="filter-row">
                <div className="filter-label">Price ($)</div>
                <div className="filter-controls">
                  <input className="filter-input" placeholder="Min" value={filters.minPrice} onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value }))} />
                  <span className="filter-sep">—</span>
                  <input className="filter-input" placeholder="Max" value={filters.maxPrice} onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))} />
                </div>
              </div>
              <div className="filter-row">
                <div className="filter-label">P/E Ratio</div>
                <div className="filter-controls">
                  <input className="filter-input" placeholder="Min" value={filters.minPE} onChange={e => setFilters(f => ({ ...f, minPE: e.target.value }))} />
                  <span className="filter-sep">—</span>
                  <input className="filter-input" placeholder="Max" value={filters.maxPE} onChange={e => setFilters(f => ({ ...f, maxPE: e.target.value }))} />
                </div>
              </div>
              <div className="filter-row">
                <div className="filter-label">P/B Ratio</div>
                <div className="filter-controls">
                  <input className="filter-input" placeholder="Min" value={filters.minPB} onChange={e => setFilters(f => ({ ...f, minPB: e.target.value }))} />
                  <span className="filter-sep">—</span>
                  <input className="filter-input" placeholder="Max" value={filters.maxPB} onChange={e => setFilters(f => ({ ...f, maxPB: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="sidebar-section">
              <div className="filter-row">
                <div className="filter-label">Min EPS Growth (%)</div>
                <div className="filter-controls">
                  <input className="filter-input" placeholder="e.g. 10" value={filters.minEPSGrowth} onChange={e => setFilters(f => ({ ...f, minEPSGrowth: e.target.value }))} />
                </div>
              </div>
              <div className="filter-row">
                <div className="filter-label">Min Rev Growth (%)</div>
                <div className="filter-controls">
                  <input className="filter-input" placeholder="e.g. 5" value={filters.minRevGrowth} onChange={e => setFilters(f => ({ ...f, minRevGrowth: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="sidebar-section">
              <div className="filter-row">
                <div className="filter-label">Min Vol/Avg Ratio</div>
                <div className="filter-controls">
                  <input className="filter-input" placeholder="e.g. 1.5" value={filters.minVolRatio} onChange={e => setFilters(f => ({ ...f, minVolRatio: e.target.value }))} />
                </div>
              </div>
              <div className="filter-row">
                <div className="filter-label">Mkt Cap ($B)</div>
                <div className="filter-controls">
                  <input className="filter-input" placeholder="Min" value={filters.minMktCap} onChange={e => setFilters(f => ({ ...f, minMktCap: e.target.value }))} />
                  <span className="filter-sep">—</span>
                  <input className="filter-input" placeholder="Max" value={filters.maxMktCap} onChange={e => setFilters(f => ({ ...f, maxMktCap: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="scan-wrap">
              <button className="scan-btn" onClick={runScan} disabled={loading}>
                {loading ? "SCANNING..." : "▶ RUN SCAN"}
              </button>
            </div>
          </div>

          <div className="content" style={{ position: "relative" }}>
            {loading && (
              <div className="loading-overlay">
                <div className="loading-text">SCANNING MARKETS...</div>
                <div className="loading-bar-wrap"><div className="loading-bar" /></div>
                <div className="loading-text" style={{ fontSize: "9px" }}>TSX · TSX-V · NYSE · NASDAQ</div>
              </div>
            )}

            {scanned && (
              <div className="stats-bar">
                <div className="stat-cell">
                  <div className="stat-label">Results</div>
                  <div className="stat-val">{results.length}</div>
                  <div className="stat-sub">of {STOCKS.length} scanned</div>
                </div>
                <div className="stat-cell">
                  <div className="stat-label">Advancing</div>
                  <div className="stat-val" style={{ color: "var(--green)" }}>{greenCount}</div>
                  <div className="stat-sub">{results.length ? ((greenCount / results.length) * 100).toFixed(0) : 0}% of results</div>
                </div>
                <div className="stat-cell">
                  <div className="stat-label">Avg Change</div>
                  <div className="stat-val" style={{ color: +avgChange >= 0 ? "var(--green)" : "var(--red)" }}>
                    {+avgChange >= 0 ? "+" : ""}{avgChange}%
                  </div>
                  <div className="stat-sub">weighted avg</div>
                </div>
                <div className="stat-cell">
                  <div className="stat-label">High Momentum</div>
                  <div className="stat-val" style={{ color: "var(--cyan)" }}>{highMom}</div>
                  <div className="stat-sub">score ≥ 4/5</div>
                </div>
              </div>
            )}

            <div className="toolbar">
              <div className="toolbar-left">
                <span className="result-count">Showing <strong>{sorted.length}</strong> results</span>
                <input className="search-box" placeholder="Search ticker / name..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="sort-select" value={sortKey} onChange={e => { setSortKey(e.target.value); setSortDir(-1); }}>
                <option value="mktCap">Sort: Market Cap</option>
                <option value="change">Sort: % Change</option>
                <option value="pe">Sort: P/E</option>
                <option value="pb">Sort: P/B</option>
                <option value="revGrowth">Sort: Rev Growth</option>
                <option value="epsGrowth">Sort: EPS Growth</option>
                <option value="price">Sort: Price</option>
              </select>
            </div>

            <div className="table-wrap">
              {sorted.length === 0 ? (
                <div className="empty-state">
                  <h3>NO RESULTS FOUND</h3>
                  <p>Adjust your filters and run a new scan.</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <SortTh label="TICKER" k="ticker" />
                      <SortTh label="EXCH" k="exchange" />
                      <SortTh label="SECTOR" k="sector" />
                      <SortTh label="PRICE" k="price" right />
                      <SortTh label="CHG %" k="change" right />
                      <SortTh label="P/E" k="pe" right />
                      <SortTh label="P/B" k="pb" right />
                      <SortTh label="EPS GR%" k="epsGrowth" right />
                      <SortTh label="REV GR%" k="revGrowth" right />
                      <SortTh label="VOL / AVG" k="vol" />
                      <SortTh label="MKT CAP" k="mktCap" right />
                      <th>MOMENTUM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((s, i) => {
                      const chgPos = s.change >= 0;
                      const vr = volRatio(s);
                      const vrPct = Math.min(vr / 3, 1);
                      const mom = momentumScore(s);
                      return (
                        <tr
                          key={s.ticker}
                          className={`row-enter ${i % 2 === 0 ? "highlight" : ""}`}
                          style={{ cursor: "pointer", animationDelay: `${i * 20}ms` }}
                          onClick={() => setSelected(s)}
                        >
                          <td>
                            <div className="ticker-cell">
                              <span className="ticker">{s.ticker}</span>
                              <span className="company">{s.name}</span>
                            </div>
                          </td>
                          <td><span className="badge">{s.exchange}</span></td>
                          <td><span className={sectorBadgeClass(s.sector)}>{s.sector}</span></td>
                          <td style={{ textAlign: "right" }} className="price">${fmt(s.price, s.price < 10 ? 3 : 2)}</td>
                          <td style={{ textAlign: "right" }} className={chgPos ? "change-pos" : "change-neg"}>
                            {chgPos ? "+" : ""}{fmt(s.change)}%
                          </td>
                          <td style={{ textAlign: "right" }} className="neutral">{fmt(s.pe, 1)}</td>
                          <td style={{ textAlign: "right" }} className="neutral">{fmt(s.pb, 1)}</td>
                          <td style={{ textAlign: "right" }} className={s.epsGrowth > 0 ? "change-pos" : s.epsGrowth < 0 ? "change-neg" : "neutral"}>
                            {s.epsGrowth != null ? (s.epsGrowth > 0 ? "+" : "") + s.epsGrowth + "%" : "—"}
                          </td>
                          <td style={{ textAlign: "right" }} className={s.revGrowth > 0 ? "change-pos" : "change-neg"}>
                            {s.revGrowth > 0 ? "+" : ""}{s.revGrowth}%
                          </td>
                          <td>
                            <div className="vol-bar-wrap">
                              <span style={{ fontSize: "10px", color: vr > 1.5 ? "var(--accent)" : "var(--muted)" }}>{fmt(vr, 1)}x</span>
                              <div className="vol-bar"><div className="vol-bar-fill" style={{ width: `${vrPct * 100}%` }} /></div>
                            </div>
                          </td>
                          <td style={{ textAlign: "right" }}>{fmtLarge(s.mktCap)}</td>
                          <td><MomentumDots score={mom} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={`detail-panel ${selected ? "open" : ""}`}>
        {selected && (
          <>
            <div className="detail-header">
              <div>
                <div className="detail-ticker">{selected.ticker}</div>
                <div className="detail-name">{selected.name}</div>
                <div style={{ marginTop: "6px" }}>
                  <span className="badge" style={{ marginRight: "6px" }}>{selected.exchange}</span>
                  <span className={sectorBadgeClass(selected.sector)}>{selected.sector}</span>
                </div>
              </div>
              <button className="close-btn" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div className="mini-chart">
              <div className="detail-section-title">30-DAY PRICE (SIMULATED)</div>
              <Sparkline positive={selected.change >= 0} />
            </div>

            <div className="detail-section">
              <div className="detail-section-title">Price & Performance</div>
              <div className="detail-grid">
                <div className="detail-kv">
                  <span className="detail-k">Price</span>
                  <span className="detail-v" style={{ color: "var(--accent)" }}>
                    ${fmt(selected.price, selected.price < 10 ? 3 : 2)}
                  </span>
                </div>
                <div className="detail-kv">
                  <span className="detail-k">Day Change</span>
                  <span className="detail-v" style={{ color: selected.change >= 0 ? "var(--green)" : "var(--red)" }}>
                    {selected.change >= 0 ? "+" : ""}{fmt(selected.change)}%
                  </span>
                </div>
                <div className="detail-kv">
                  <span className="detail-k">Beta</span>
                  <span className="detail-v">{fmt(selected.beta)}</span>
                </div>
                <div className="detail-kv">
                  <span className="detail-k">Mkt Cap</span>
                  <span className="detail-v">{fmtLarge(selected.mktCap)}</span>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <div className="detail-section-title">Valuation</div>
              <div className="detail-grid">
                <div className="detail-kv">
                  <span className="detail-k">P/E Ratio</span>
                  <span className="detail-v">{selected.pe ? fmt(selected.pe, 1) : "N/A"}</span>
                </div>
                <div className="detail-kv">
                  <span className="detail-k">P/B Ratio</span>
                  <span className="detail-v">{fmt(selected.pb, 1)}</span>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <div className="detail-section-title">Growth</div>
              <div className="detail-grid">
                <div className="detail-kv">
                  <span className="detail-k">EPS Growth</span>
                  <span className="detail-v" style={{ color: selected.epsGrowth > 0 ? "var(--green)" : selected.epsGrowth < 0 ? "var(--red)" : "var(--muted)" }}>
                    {selected.epsGrowth != null ? (selected.epsGrowth > 0 ? "+" : "") + selected.epsGrowth + "%" : "N/A"}
                  </span>
                </div>
                <div className="detail-kv">
                  <span className="detail-k">Rev Growth</span>
                  <span className="detail-v" style={{ color: selected.revGrowth > 0 ? "var(--green)" : "var(--red)" }}>
                    {selected.revGrowth > 0 ? "+" : ""}{selected.revGrowth}%
                  </span>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <div className="detail-section-title">Volume</div>
              <div className="detail-grid">
                <div className="detail-kv">
                  <span className="detail-k">Today's Vol</span>
                  <span className="detail-v">{fmtVol(selected.vol)}</span>
                </div>
                <div className="detail-kv">
                  <span className="detail-k">Avg Vol</span>
                  <span className="detail-v">{fmtVol(selected.avgVol)}</span>
                </div>
                <div className="detail-kv">
                  <span className="detail-k">Vol / Avg</span>
                  <span className="detail-v" style={{ color: volRatio(selected) > 1.5 ? "var(--accent)" : "var(--text)" }}>
                    {fmt(volRatio(selected))}x
                  </span>
                </div>
                <div className="detail-kv">
                  <span className="detail-k">Momentum</span>
                  <span className="detail-v"><MomentumDots score={momentumScore(selected)} /></span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
