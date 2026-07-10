function CurrencyButton({ code, currency, onCurrencyToggle }) {
  const active = currency === code;
  return (
    <button
      className={active ? "hdr-ccy-on" : "hdr-ccy-off"}
      onClick={() => !active && onCurrencyToggle(code)}
      aria-pressed={active}
      title={active ? undefined : `Show prices in ${code}`}
    >
      {code}
    </button>
  );
}

export default function Header({
  clock, watchlistCount, currency, onCurrencyToggle,
  quotesLoading, quotesLive, quotesInitialized,
}) {
  const dotCls = quotesLoading
    ? (quotesInitialized ? " refreshing" : " loading")
    : !quotesLive ? " offline" : "";
  const statusLabel = quotesLoading
    ? (quotesInitialized ? "Refreshing quotes" : "Loading quotes")
    : quotesLive ? "Live quotes" : "Quotes offline";

  return (
    <header className="hdr">
      <div className="hdr-brand">Markr</div>
      <div className="hdr-spacer" />
      <div className="hdr-currency" role="group" aria-label="Display currency">
        <CurrencyButton code="USD" currency={currency} onCurrencyToggle={onCurrencyToggle} />
        <span className="hdr-ccy-sep" aria-hidden="true">·</span>
        <CurrencyButton code="CAD" currency={currency} onCurrencyToggle={onCurrencyToggle} />
      </div>

      {watchlistCount > 0 && (
        <div className="hdr-wl" title={`${watchlistCount} starred`}>
          <span className="hdr-wl-star" aria-hidden="true">★</span>
          <span>{watchlistCount}</span>
        </div>
      )}

      <div className="hdr-status">
        <div className={`hdr-dot${dotCls}`} role="img" aria-label={statusLabel} title={statusLabel} />
        <span className="hdr-clock">{clock}</span>
      </div>
    </header>
  );
}
