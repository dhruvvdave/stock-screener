const STYLE = `
  @keyframes sk-pulse { 0%,100%{opacity:0.35} 50%{opacity:0.6} }
  .sk-row td { padding: 12px 16px; border-bottom: 1px solid var(--border); }
  .sk-cell {
    height: 10px;
    border-radius: 2px;
    background: var(--surface-3);
  }
`;

const WIDTHS = ["64%","40%","70%","50%","44%","34%","40%","44%","40%","56%","50%","30%","60%"];

export default function SkeletonRows({ count = 8, columnCount = 12 }) {
  return (
    <>
      <style>{STYLE}</style>
      {Array.from({ length: count }, (_, row) => (
        <tr key={row} className="sk-row">
          {Array.from({ length: columnCount }, (_, col) => (
            <td key={col}>
              <div
                className="sk-cell"
                style={{
                  width: WIDTHS[(row + col) % WIDTHS.length],
                  animation: `sk-pulse 1.6s ease-in-out ${((row * 60 + col * 20) % 400)}ms infinite`,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
