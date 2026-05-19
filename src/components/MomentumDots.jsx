const STYLE = `
  .m-dots { display: flex; gap: 3px; align-items: center; }
  .m-dot  { border-radius: 50%; background: var(--surface-3); }
  .m-dot.on  { background: var(--pos); }
  .m-dot.neg { background: var(--neg); }
`;

export default function MomentumDots({ score, size = 6 }) {
  return (
    <>
      <style>{STYLE}</style>
      <div className="m-dots">
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
