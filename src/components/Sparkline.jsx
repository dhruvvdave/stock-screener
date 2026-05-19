import { useMemo } from "react";

export default function Sparkline({ positive, width = 60, height = 28, points = 10, seed = 0 }) {
  const coords = useMemo(() => {
    const pts = Array.from({ length: points }, (_, i) => {
      const trend = positive ? i * 1.8 : -i * 1.4;
      // deterministic-ish noise seeded by index + seed
      const noise = ((Math.sin(i * 2.4 + seed * 1.7) + 1) / 2) * 6 - 3;
      return 10 + trend + noise;
    });
    const min = Math.min(...pts), max = Math.max(...pts);
    const norm = pts.map(p => (p - min) / (max - min || 1));
    return norm.map((v, i) => ({
      x: (i / (points - 1)) * width,
      y: height - v * height * 0.82 - height * 0.06,
    }));
  }, [positive, width, height, points, seed]);

  const d = "M" + coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" L");
  const color = positive ? "#22c55e" : "#ef4444";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: "block" }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
