# Changelog

## [Unreleased]

### Fixed
- Technical indicators section never rendered: `fetchCandleData` stripped the
  API payload down to a bare prices array while consumers expected the full
  `{ prices, lastClose, source }` object. This also broke the chart-close
  price fallback for thinly traded tickers and the chart source label.
- Candles now fetch a 1y window so MA50/MA200 and MACD have enough history
  to compute (a 1mo window tops out around 22 daily closes).
- Detail-view fetches no longer refire on every 45s quote refresh, and a slow
  response for a previously viewed stock can't overwrite the current one.
- Active-row highlight no longer shifts the row height by 2px during j/k
  navigation (inset ring instead of a swapped border).

### Changed
- Keyboard accessibility pass: currency toggle is real buttons, list rows are
  focusable and respond to Enter/Space, search has combobox semantics, toasts
  announce via `role="status"`, and the j/k selection scrolls into view.
- Right rail (watchlist alerts, portfolio, earnings) extracted into
  `TrackerRail`; localStorage keys unified under `markr_*` with a one-time
  migration from the legacy `tickerly_*`/`mktscan_*` names.
- ESLint runs clean: Node globals scoped to `api/`, Jest globals to tests,
  and the real component-level findings (components created during render,
  unkeyed fragments, state resets in effects) fixed.

### Removed
- Dead code from earlier iterations: `Sparkline`, `AreaChart`, `useCountUp`,
  filter presets, sector constants, and unused assets.

### Added
- Multi-source candle data fallback (Finnhub → Yahoo → Stooq → Twelve Data)
- Technical indicators computed from price history: RSI(14), MACD(12/26/9), Bollinger Bands(20), MA50, MA200
- Analyst consensus section with buy/hold/sell bar and price target range
- Financial health metrics (forward P/E, PEG, current ratio, D/E, margins, ROE, ROA)
- Income & valuation section via FMP + Alpha Vantage enrichment
- Recent news with Yahoo Finance → Finnhub fallback
- AI analysis panel (user-supplied OpenAI key, stored in localStorage)
- Persistent portfolio tracker with P&L and allocation columns
- Price alert system with browser notifications on threshold crossing
- Upcoming earnings list for watchlist + portfolio tickers
- USD/CAD live exchange rate toggle via Frankfurter API
- Keyboard navigation: j/k move list, Enter opens detail, s stars ticker, Esc returns
- TradingView embedded chart replacing sparkline-only view

### Known issues
- Hardcoded YAHOO_SYMBOLS map needs replacing with dynamic resolution
