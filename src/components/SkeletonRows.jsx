const STYLE = `
  @keyframes skeleton-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .skeleton-row td {
    padding: 10px 12px;
    border-bottom: 1px solid #1e1e1e;
  }
  .skeleton-cell {
    height: 9px;
    border-radius: 2px;
    background: linear-gradient(90deg, #161616 25%, #1c1c1c 50%, #161616 75%);
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.4s ease infinite;
  }
`;

const WIDTHS = ["68%", "42%", "72%", "52%", "46%", "36%", "42%", "46%", "41%", "58%", "52%", "32%", "62%"];

export default function SkeletonRows({ count = 8, columnCount = 12 }) {
  return (
    <>
      <style>{STYLE}</style>
      {Array.from({ length: count }, (_, rowIdx) => (
        <tr key={rowIdx} className="skeleton-row" style={{ animationDelay: `${rowIdx * 55}ms` }}>
          {Array.from({ length: columnCount }, (_, colIdx) => (
            <td key={colIdx}>
              <div
                className="skeleton-cell"
                style={{
                  width: WIDTHS[(rowIdx + colIdx) % WIDTHS.length],
                  animationDelay: `${(rowIdx * 60 + colIdx * 20) % 400}ms`,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
