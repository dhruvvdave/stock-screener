export default function MomentumDots({ score, size = 6 }) {
  return (
    <div className="m-dots" role="img" aria-label={`Momentum ${score} of 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className={`m-dot ${i <= score ? (score >= 3 ? "on" : "neg") : ""}`}
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  );
}
