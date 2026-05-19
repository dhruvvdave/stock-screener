export const SECTORS = ["Technology", "Energy", "Finance", "Healthcare", "Materials", "Industrials", "Consumer", "Utilities"];

export const STOCKS = [
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

export function fmt(n, decimals = 2) {
  if (n == null) return "—";
  return n.toFixed(decimals);
}

export function fmtLarge(n) {
  if (n == null) return "—";
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}T`;
  if (n >= 1) return `$${n.toFixed(1)}B`;
  return `$${(n * 1000).toFixed(0)}M`;
}

export function fmtVol(n) {
  if (n >= 100) return `${n.toFixed(0)}M`;
  if (n >= 1) return `${n.toFixed(1)}M`;
  return `${(n * 1000).toFixed(0)}K`;
}

export function computeSectorMedians(stocks) {
  const result = {};
  SECTORS.forEach(sector => {
    const group = stocks.filter(s => s.sector === sector);
    const pes = group.map(s => s.pe).filter(Boolean).sort((a, b) => a - b);
    const pbs = group.map(s => s.pb).sort((a, b) => a - b);
    const mid = arr => arr.length ? arr[Math.floor(arr.length / 2)] : null;
    result[sector] = { pe: mid(pes), pb: mid(pbs) };
  });
  return result;
}

export function volRatio(s) {
  return s.vol / s.avgVol;
}

export function momentumScore(s) {
  let sc = 0;
  if (s.change > 0) sc++;
  if (s.change > 2) sc++;
  if (volRatio(s) > 1.2) sc++;
  if (s.revGrowth > 15) sc++;
  if (s.epsGrowth > 10) sc++;
  return sc;
}

export const SECTOR_BADGE_COLOR = {
  Technology: "blue",
  Energy: "yellow",
  Finance: "green",
  Healthcare: "cyan",
  Materials: "purple",
  Consumer: "red",
  Industrials: "",
  Utilities: "",
};

export const SECTOR_ICON = {
  Technology: "T", Energy: "E", Finance: "F", Healthcare: "H",
  Materials: "M", Industrials: "I", Consumer: "C", Utilities: "U",
};
