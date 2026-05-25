export default function Header({
  clock, watchlistCount, currency, onCurrencyToggle,
  quotesLoading, quotesLive, quotesInitialized,
}) {
  const dotCls = quotesLoading
    ? (quotesInitialized ? " refreshing" : " loading")
    : !quotesLive ? " offline" : "";

  return (
    <header className="hdr">
      <div className="hdr-brand">Markr</div>
      <div className="hdr-spacer" />
      <div className="hdr-currency" title="Click to switch display currency">
        <span
          className={currency === "USD" ? "hdr-ccy-on" : "hdr-ccy-off"}
          onClick={() => currency !== "USD" && onCurrencyToggle("USD")}
          title={currency !== "USD" ? "Switch to USD" : undefined}
        >USD</span>
        <span className="hdr-ccy-sep">·</span>
        <span
          className={currency === "CAD" ? "hdr-ccy-on" : "hdr-ccy-off"}
          onClick={() => currency !== "CAD" && onCurrencyToggle("CAD")}
          title={currency !== "CAD" ? "Switch to CAD" : undefined}
        >CAD</span>
      </div>

      {watchlistCount > 0 && (
        <div className="hdr-wl">
          <span className="hdr-wl-star">★</span>
          <span>{watchlistCount}</span>
        </div>
      )}

      <div className="hdr-status">
        <div className={`hdr-dot${dotCls}`} />
        <span className="hdr-clock">{clock}</span>
      </div>
    </header>
  );
}
