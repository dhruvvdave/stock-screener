import { useMemo } from "react";

export default function AreaChart({ positive, width = 308, height = 120, days = 30 }) {
  const { coords, minPrice, maxPrice } = useMemo(() => {
    const basePrice = 100;
    const pts = Array.from({ length: days }, (_, i) => {
      const trend = positive ? i * 0.8 : -i * 0.6;
      const noise = (Math.sin(i * 1.9) * 4) + (Math.sin(i * 0.7) * 3);
      return basePrice + trend + noise;
    });
    const min = Math.min(...pts), max = Math.max(...pts);
    const padY = 14;
    const chartH = height - padY * 2;
    const padX = 38;
    const chartW = width - padX - 4;
    const norm = pts.map((p, i) => ({
      x: padX + (i / (days - 1)) * chartW,
      y: padY + (1 - (p - min) / (max - min || 1)) * chartH,
    }));
    return { coords: norm, minPrice: min, maxPrice: max };
  }, [positive, width, height, days]);

  const color = positive ? "#22c55e" : "#ef4444";
  const gradId = `ag-${positive ? "pos" : "neg"}`;

  const linePath = "M" + coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" L");
  const areaPath = linePath + ` L${coords[coords.length - 1].x.toFixed(1)},${(height - 14).toFixed(1)} L${coords[0].x.toFixed(1)},${(height - 14).toFixed(1)} Z`;

  const ticks = 4;
  const gridLines = Array.from({ length: ticks }, (_, i) => {
    const frac = i / (ticks - 1);
    const y = 14 + frac * (height - 28);
    const price = maxPrice - frac * (maxPrice - minPrice);
    return { y, label: price.toFixed(0) };
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: "block" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines + Y labels */}
      {gridLines.map(({ y, label }, i) => (
        <g key={i}>
          <line x1="38" y1={y} x2={width - 4} y2={y} stroke="#2a2a2a" strokeWidth="1" />
          <text x="34" y={y + 3.5} textAnchor="end" fontSize="8" fill="#555" fontFamily="IBM Plex Mono, monospace">
            {label}
          </text>
        </g>
      ))}

      {/* Area fill */}
      <path d={areaPath} fill={`url(#${gradId})`} />

      {/* Stroke line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* X-axis labels */}
      <text x={coords[0].x} y={height - 2} fontSize="8" fill="#444" fontFamily="IBM Plex Mono, monospace">D-30</text>
      <text x={coords[coords.length - 1].x} y={height - 2} textAnchor="end" fontSize="8" fill="#444" fontFamily="IBM Plex Mono, monospace">TODAY</text>

      {/* Last-point dot */}
      <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="2.5" fill={color} />
    </svg>
  );
}
