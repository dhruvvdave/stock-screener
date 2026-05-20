export const SECTORS = ["Technology", "Energy", "Finance", "Healthcare", "Materials", "Industrials", "Consumer", "Utilities"];

export const STOCKS = [];

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
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
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
  if (typeof s?.vol !== "number" || typeof s?.avgVol !== "number" || s.avgVol === 0) return null;
  return s.vol / s.avgVol;
}

export function momentumScore(s) {
  let sc = 0;
  const vr = volRatio(s);
  if (typeof s.change === "number" && s.change > 0) sc++;
  if (typeof s.change === "number" && s.change > 2) sc++;
  if (vr !== null && vr !== undefined && vr > 1.2) sc++;
  if (typeof s.revGrowth === "number" && s.revGrowth > 15) sc++;
  if (typeof s.epsGrowth === "number" && s.epsGrowth > 10) sc++;
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
