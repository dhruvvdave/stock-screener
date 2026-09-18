# Changelog

## [Unreleased]

### Fixed
- `/api/stock`, `/api/candle` and `/api/news` never hit the cache. They read
  under the source `any` but wrote under whichever provider answered, so the
  read and write keys never matched. The source is out of the key now: it
  describes the payload, not the resource.
- Cache TTLs were dead code. `ttl_for_resolution()` matched resolution labels
  while every call site passed a resource name, so everything landed in the
  1-hour bucket, live quotes included. TTLs are per-resource now.
- The token bucket punished clients for retrying. A denied call reset the
  refill clock without saving the tokens accrued since the last one, so a
  polling client could starve its own bucket: 0 permits over a window where an
  idle client got 3.
- The frontend polled continuously instead of every 45 seconds. `refreshQuotes`
  depended on `stocks` and replaced it on every run, so each refresh
  invalidated the interval effect keyed on it and immediately started another.
- `price_history` was never created. The DDL was one semicolon-joined string,
  which asyncpg rejects, and the startup handler reported it as "Postgres
  unavailable". Every history write had been failing silently.
- Re-viewing a chart appended another full copy of the ticker's history.
  `(ticker, source, timestamp)` is the primary key now and writes upsert onto
  it.
- Partitions ran out. Only three months were created, at startup, with no
  scheduler. The partition for a row's month is now created on demand.
- Background history writes used `asyncio.ensure_future`, which holds only a
  weak reference, so a write could be collected before reaching the database.
- The image could not build: the Dockerfile copied `requirements.txt` from the
  context root, where it does not exist.
- `docker compose up` refused to start without a `.env`.

### Changed
- An exhausted rate limit returns 429 with `Retry-After` everywhere. Four
  endpoints used to return an empty 200, which callers stored as though it
  were data.
- Symbols and candle ranges are validated before reaching a cache key or an
  upstream query string. An unknown range is a 422 instead of being silently
  treated as `1mo`.
- `/history` paginates, with `limit`, `offset` and `hasMore`. It was unbounded.
- CORS origins are configurable instead of `*`.
- `lifespan` replaces the deprecated `on_event` handlers, and the deprecated
  `utcnow` / `utcfromtimestamp` / `date.today` calls are gone.
- The API container runs as a non-root user.

### Added
- Single-flight on cache misses: concurrent requests for one key collapse onto
  a single upstream call instead of one per in-flight client.
- `/health`, reporting Redis and Postgres separately, with compose healthchecks
  and `depends_on` conditions gating on it.
- `ResponseCache.invalidate()` for dropping one resource or everything held
  for a ticker.
- Backend test suite: 97 tests over cache keying, TTLs, invalidation, stampede
  control, limiter refill and atomicity, router behaviour, and a PostgreSQL
  group covering partitioning, upserts and partition pruning.
- Frontend cadence tests against the real component with fake timers.
- `.dockerignore`, and `.env` added to `.gitignore`.

### Known issues
- The AI panel calls `/api/analyze`, which only exists as a Vercel function.
  The FastAPI backend does not implement it.
- `api/*.js` duplicates the FastAPI endpoints and has to be kept in sync by
  hand.
- Hardcoded `YAHOO_SYMBOLS` map needs replacing with dynamic resolution.
- `fetchAllQuotes` calls `/api/stock` per ticker while `/api/quotes` batches.
- Fetch helpers return `null` on error, so the UI cannot distinguish a failed
  request from missing data.

## [Earlier]

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
