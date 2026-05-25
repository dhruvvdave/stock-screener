# Changelog

## [Unreleased]

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

### Fixed
- TSX-V exchange symbol mapping (.V suffix for Yahoo, TSXV: prefix for Finnhub)
- Yahoo Finance query1/query2 host fallback for quote and chart endpoints

### Known issues
- Hardcoded YAHOO_SYMBOLS map needs replacing with dynamic resolution
- Pre-existing ESLint errors in component files
