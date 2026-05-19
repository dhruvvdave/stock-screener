const STYLE = `
  .momentum-dots { display: flex; gap: 3px; align-items: center; }
  .m-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #2a2a2a;
    transition: background 0.2s;
  }
  .m-dot.on  { background: #22c55e; box-shadow: 0 0 4px rgba(34,197,94,0.5); }
  .m-dot.neg { background: #ef4444; box-shadow: 0 0 4px rgba(239,68,68,0.5); }
`;

export default function MomentumDots({ score, size = 6 }) {
  return (
    <>
      <style>{STYLE}</style>
      <div className="momentum-dots">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className={`m-dot ${i <= score ? (score >= 3 ? "on" : "neg") : ""}`}
            style={{ width: size, height: size }}
          />
        ))}
      </div>
    </>
  );
}
