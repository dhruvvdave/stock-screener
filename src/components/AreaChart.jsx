import { useMemo } from "react";

export default function AreaChart({ positive, width = 308, height = 110, days = 30 }) {
  const { coords, minP, maxP } = useMemo(() => {
    const pts = Array.from({ length: days }, (_, i) => {
      const trend = positive ? i * 0.8 : -i * 0.6;
      return 100 + trend + Math.sin(i * 1.9) * 4 + Math.sin(i * 0.7) * 3;
    });
    const min = Math.min(...pts), max = Math.max(...pts);
    const padX = 36, padY = 10;
    const cW = width - padX - 4, cH = height - padY * 2;
    return {
      coords: pts.map((p, i) => ({
        x: padX + (i / (days - 1)) * cW,
        y: padY + (1 - (p - min) / (max - min || 1)) * cH,
      })),
      minP: min, maxP: max,
    };
  }, [positive, width, height, days]);

  const color   = positive ? "var(--pos)" : "var(--neg)";
  const colorHex = positive ? "#34c759"   : "#ff3b30";
  const line = "M" + coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" L");
  const area = line + ` L${coords.at(-1).x.toFixed(1)},${height - 10} L${coords[0].x.toFixed(1)},${height - 10} Z`;

  const ticks = 4;
  const gridLines = Array.from({ length: ticks }, (_, i) => {
    const frac = i / (ticks - 1);
    return {
      y: 10 + frac * (height - 20),
      label: (maxP - frac * (maxP - minP)).toFixed(0),
    };
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: "block" }}>
      {gridLines.map(({ y, label }, i) => (
        <g key={i}>
          <line x1={36} y1={y} x2={width - 4} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          <text x={32} y={y + 3.5} textAnchor="end" fontSize="9"
            fill="var(--text-3)" fontFamily="system-ui, sans-serif">
            {label}
          </text>
        </g>
      ))}

      <path d={area} fill={colorHex} opacity="0.07" />
      <path d={line}  fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />

      <circle cx={coords.at(-1).x} cy={coords.at(-1).y} r="2.5" fill={color} />

      <text x={coords[0].x} y={height - 1} fontSize="9" fill="var(--text-3)" fontFamily="system-ui, sans-serif">D-30</text>
      <text x={coords.at(-1).x} y={height - 1} textAnchor="end" fontSize="9" fill="var(--text-3)" fontFamily="system-ui, sans-serif">Today</text>
    </svg>
  );
}
