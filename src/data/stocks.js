export function fmt(n, decimals = 2) {
  if (n == null) return "—";
  return n.toFixed(decimals);
}

// Market caps arrive from the API in billions
export function fmtLarge(n) {
  if (n == null) return "—";
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}T`;
  if (n >= 1) return `$${n.toFixed(1)}B`;
  return `$${(n * 1000).toFixed(0)}M`;
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
