import { useMemo } from "react";

export default function AreaChart({ positive, prices = null, width = 308, height = 110, days = 30 }) {
  const { coords, isReal } = useMemo(() => {
    const isReal = Array.isArray(prices) && prices.length >= 2;
    const pts = isReal ? prices.slice(-days) : null;
    if (!pts) return { coords: [], isReal: false };
    const min = Math.min(...pts), max = Math.max(...pts);
    const padX = 8, padY = 10;
    const cW = width - padX * 2, cH = height - padY * 2;
    return {
      isReal,
      coords: pts.map((p, i) => ({
        x: padX + (i / (pts.length - 1)) * cW,
        y: padY + (1 - (p - min) / (max - min || 1)) * cH,
      })),
    };
  }, [prices, width, height, days]);

  if (!isReal || coords.length < 2) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: "block" }}>
        <text x={8} y={height / 2} fontSize="10" fill="var(--text-3)" fontFamily="system-ui, sans-serif">
          No live chart data
        </text>
      </svg>
    );
  }

  const color     = positive ? "var(--pos)" : "var(--neg)";
  const colorHex  = positive ? "#30d158"   : "#ff453a";
  const line = "M" + coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" L");
  const area = line + ` L${coords.at(-1).x.toFixed(1)},${height - 10} L${coords[0].x.toFixed(1)},${height - 10} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: "block" }}>
      <path d={area} fill={colorHex} opacity="0.07" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={coords.at(-1).x} cy={coords.at(-1).y} r="2.5" fill={color} />
      <text x={coords[0].x} y={height - 1} fontSize="9" fill="var(--text-3)" fontFamily="system-ui, sans-serif">
        30d ago
      </text>
      <text x={coords.at(-1).x} y={height - 1} textAnchor="end" fontSize="9" fill="var(--text-3)" fontFamily="system-ui, sans-serif">
        Today
      </text>
    </svg>
  );
}
