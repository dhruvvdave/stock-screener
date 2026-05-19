import { SECTORS } from "./stocks";

export const DEFAULT_FILTERS = {
  exchanges: ["TSX", "TSX-V", "NYSE", "NASDAQ"],
  sectors: [...SECTORS],
  minPrice: "", maxPrice: "",
  minPE: "", maxPE: "",
  minPB: "", maxPB: "",
  minEPSGrowth: "",
  minRevGrowth: "",
  minVolRatio: "",
  minMktCap: "", maxMktCap: "",
};

export const DEFAULT_COLUMNS = {
  sparkline: true,
  epsGrowth: true,
  revGrowth: true,
  pb: true,
  momentum: true,
};

export const PRESETS = {
  Value: {
    ...DEFAULT_FILTERS,
    maxPE: "18",
    maxPB: "3",
    minEPSGrowth: "5",
    minMktCap: "1",
  },
  "High Growth": {
    ...DEFAULT_FILTERS,
    minEPSGrowth: "20",
    minRevGrowth: "15",
  },
  Momentum: {
    ...DEFAULT_FILTERS,
    minRevGrowth: "10",
    minVolRatio: "1.3",
  },
  Speculative: {
    ...DEFAULT_FILTERS,
    exchanges: ["TSX-V", "NYSE"],
    minRevGrowth: "25",
    minVolRatio: "1.5",
    maxMktCap: "5",
    minPrice: "0.1",
    maxPrice: "15",
  },
};

export function computeActiveFilterCount(filters) {
  let count = 0;
  const numericKeys = ["minPrice","maxPrice","minPE","maxPE","minPB","maxPB","minEPSGrowth","minRevGrowth","minVolRatio","minMktCap","maxMktCap"];
  numericKeys.forEach(k => { if (filters[k] !== "") count++; });
  if (filters.exchanges.length < 4) count++;
  if (filters.sectors.length < SECTORS.length) count++;
  return count;
}
