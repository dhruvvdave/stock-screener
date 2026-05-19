import { useMemo } from "react";

function generateSimulated(positive, days) {
  return Array.from({ length: days }, (_, i) => {
    const trend = positive ? i * 0.8 : -i * 0.6;
    return 100 + trend + Math.sin(i * 1.9) * 4 + Math.sin(i * 0.7) * 3;
  });
}

export default function AreaChart({ positive, prices = null, width = 308, height = 110, days = 30 }) {
  const { coords } = useMemo(() => {
    const pts = (Array.isArray(prices) && prices.length >= 2)
      ? prices.slice(-days)
      : generateSimulated(positive, days);
    const min = Math.min(...pts), max = Math.max(...pts);
    const padX = 8, padY = 10;
    const cW = width - padX * 2, cH = height - padY * 2;
    return {
      coords: pts.map((p, i) => ({
        x: padX + (i / (pts.length - 1)) * cW,
        y: padY + (1 - (p - min) / (max - min || 1)) * cH,
      })),
    };
  }, [positive, prices, width, height, days]);

  const isReal    = Array.isArray(prices) && prices.length >= 2;
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
        {isReal ? "30d ago" : "D-30"}
      </text>
      <text x={coords.at(-1).x} y={height - 1} textAnchor="end" fontSize="9" fill="var(--text-3)" fontFamily="system-ui, sans-serif">
        Today
      </text>
    </svg>
  );
}
