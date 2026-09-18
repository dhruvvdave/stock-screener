# Markr

A keyboard-driven stock screener. Type a ticker, hit Enter, get live price
data, charts, analyst consensus, technicals, and news. No account, no friction.

I built this because every screener I found was either too bloated, behind a
paywall, or slow. The terminal aesthetic isn't decoration: `j`/`k` move through
the list, `Enter` opens, `s` stars.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite |
| Backend | FastAPI (Python 3.12) |
| Cache | Redis: response cache and token bucket rate limiter |
| Database | PostgreSQL, month-partitioned OHLCV history |
| Data sources | Finnhub, Yahoo Finance, FMP, Alpha Vantage, Stooq, Twelve Data |
| Deployment | Docker Compose |

## Features

- Ticker search with autofill
- Quotes refreshing every 45 seconds
- Price chart via TradingView embed
- Technicals from price history: RSI(14), MACD, Bollinger Bands, MA50/200
- Analyst consensus: buy/hold/sell breakdown and price targets
- Financial health metrics and key statistics
- Recent news
- Watchlist with price alerts and browser notifications
- Portfolio tracker: shares, avg cost, value, P&L, allocation
- Upcoming earnings dates for watchlisted tickers
- USD/CAD toggle with live exchange rates
- NYSE, NASDAQ, TSX, TSX-V, LSE, ASX, NSE, OTC and XETRA symbols

## Architecture

Every upstream call passes through two layers of Redis.

**Response cache.** Entries are keyed `cache:{TICKER}:{resource}`. The provider
that answered is not part of the key, because `/api/stock` and `/api/candle`
fall through several providers and keying by source means the next request
looks under a different key and misses. Which source served a payload travels
inside the payload.

TTLs are set per resource, since a live quote and a company profile go stale on
different timescales: 30s for quotes, 5min for candles, 15min for news, an hour
for fundamentals and analyst data, a day for profiles.

Concurrent misses for one key collapse onto a single upstream call. One caller
wins a short Redis lock and fetches; the rest wait briefly for its result, then
fetch for themselves rather than blocking. Without this, a popular ticker
expiring sends one request per in-flight client and spends the budget in a
burst.

**Token bucket rate limiter.** Each source gets a bucket holding a token count
and a refill timestamp. A Lua script runs the read-refill-write sequence in one
round trip, so concurrent callers cannot oversubscribe it, whether they are
async tasks in one process or separate uvicorn workers. Both the refilled
balance and the timestamp are written on every call, including denials:
persisting only the timestamp restarts the refill clock while discarding the
tokens it earned, which lets a client that retries starve its own bucket.

When a source is exhausted the request falls through to the next one in the
chain. When they are all exhausted the endpoint returns 429 with a
`Retry-After` computed from the bucket.

**Price history.** After a candle fetch, OHLCV rows are written to Postgres in
the background. The table is range-partitioned by month on `timestamp`, and the
partition for a row's month is created on demand, so a backfill or a long-lived
instance does not run past the end of its partitions. The primary key is
`(ticker, source, timestamp)` and writes upsert onto it, so re-viewing a chart
corrects existing bars instead of appending another copy of the history.

### Fallback chains

```
Stock quote:   Finnhub → Yahoo Finance → Twelve Data
Candle/chart:  Finnhub → Yahoo Finance → Stooq → Twelve Data
News:          Yahoo Finance → Finnhub
Profile:       Yahoo Finance + Finnhub (parallel, merged)
Enrich:        FMP + Alpha Vantage (parallel)
```

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/stock?symbol=` | Single quote |
| GET | `/api/quotes?symbols=` | Batch quotes |
| GET | `/api/candle?symbol=&finnhubSymbol=&range=` | OHLCV chart data |
| GET | `/api/search?q=` | Ticker search |
| GET | `/api/profile?symbol=&finnhubSymbol=` | Company profile |
| GET | `/api/analyst?symbol=` | Analyst recommendations and sentiment |
| GET | `/api/news?symbol=&finnhubSymbol=` | Recent news |
| GET | `/api/fundamentals?symbol=` | Key statistics and ratios |
| GET | `/api/metrics?symbol=` | Per-ticker Finnhub metrics |
| GET | `/api/enrich?symbol=` | FMP and Alpha Vantage enrichment |
| POST | `/api/analyze` | AI analysis, proxied to OpenAI |
| GET | `/metrics` | Cache hit rate and per-source counters |
| GET | `/health` | Liveness, with Redis and Postgres checked separately |
| GET | `/history/{ticker}?start=&end=&limit=&offset=` | Stored OHLCV from Postgres |

`range` accepts `1mo`, `3mo`, `6mo`, `1y` or `2y`. Anything else is a 422.
Symbols are pattern-validated before they reach a cache key or an upstream
query string. An exhausted rate limit is a 429 with `Retry-After`, never an
empty 200.

`/history` returns at most 1000 rows by default and 10000 with an explicit
`limit`, with `hasMore` telling you whether to page.

## Setup

### Start the backend

```bash
docker compose up
```

That brings up Redis on 6379, PostgreSQL on 5432 (user, password and database
all `markr`), and the API on 8000. The partitioned `price_history` table is
created on first startup. The API waits for both dependencies to report
healthy before starting.

This works without any configuration. Yahoo Finance and Stooq need no
credentials, so quotes and charts resolve through them.

### Add API keys

Finnhub is the primary quote source and its free tier is enough:

```bash
cp .env.example .env
```

```env
FINNHUB_KEY=your_key_here

# Optional, for richer data
FMP_KEY=
AV_KEY=
TWELVE_DATA_KEY=

# Optional, for the AI panel. Visitors can supply their own key instead.
OPENAI_KEY=
```

Then `docker compose up --build`.

### Start the frontend

```bash
npm ci
npm run dev
```

Vite proxies `/api`, `/metrics`, `/health` and `/history` to port 8000. Open
<http://localhost:5173>.

## Configuration

Defaults shown. All of these can be set in `.env` or the environment.

```env
# Infrastructure
REDIS_URL=redis://localhost:6379/0
POSTGRES_DSN=postgresql+asyncpg://markr:markr@localhost:5432/markr

# Browser origins allowed to call the API
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Cache TTLs, seconds, one per resource
TTL_QUOTE=30
TTL_LIST_QUOTE=30
TTL_CANDLE=300
TTL_NEWS=900
TTL_SEARCH=3600
TTL_FUNDAMENTALS=3600
TTL_STOCK_METRICS=3600
TTL_ANALYST=3600
TTL_ENRICH=21600
TTL_PROFILE=86400
TTL_DEFAULT=600

# Token bucket per source: "capacity,refill_rate_per_second"
RATE_FINNHUB=30,0.5           # 30 burst, 0.5 req/s sustained
RATE_YAHOO=60,2.0
RATE_ALPHAVANTAGE=5,0.083     # free tier: 5 req/min
RATE_FMP=10,0.167             # free tier: 10 req/min
RATE_STOOQ=30,1.0
RATE_TWELVEDATA=8,0.133       # free tier: 8 req/min
RATE_OPENAI=20,0.2            # guards the server-side OpenAI key

# Result limits and partition window
HISTORY_DEFAULT_LIMIT=1000
HISTORY_MAX_LIMIT=10000
PARTITION_MONTHS_AHEAD=3
```

## Tests

```bash
npm test                              # frontend, node and jsdom projects
pip install -r backend/requirements-dev.txt
pytest                                # backend
ruff check backend/
```

The Postgres tests cover partitioning, upserts and partition pruning, so they
need a real server and skip without one. Point them at a scratch database:

```bash
MARKR_TEST_DSN=postgresql+asyncpg://markr@127.0.0.1:5432/markr_test pytest
```

## Keyboard shortcuts

| Key | Action |
|---|---|
| `j` / `k` | Move down / up |
| `Enter` | Open detail view |
| `Escape` | Close detail view |
| `s` | Star / unstar ticker |
| `/` | Focus search |

## Backend structure

```
backend/
├── main.py              # app factory and lifespan
├── config.py            # pydantic Settings, every env var
├── deps.py              # Redis, HTTP client, cache and limiter providers
├── validation.py        # symbol/range validation and error helpers
├── fetchers/            # one module per upstream API
├── services/
│   ├── cache.py         # response cache, TTLs, single-flight
│   ├── rate_limiter.py  # token bucket via Lua
│   └── db.py            # partitioning, upserts, background writes
├── routers/             # one module per endpoint
└── tests/
```

### AI analysis

The panel sends its prompt to `/api/analyze`, which forwards it to OpenAI.
The key comes from the request body, so a visitor can bring their own, or from
`OPENAI_KEY` on the server. Either way it is used for that one call and never
logged or stored server-side. A visitor-supplied key lives in their
`localStorage` and travels to the backend with each request, so serve the app
over HTTPS if you expose it beyond localhost.

## Known issues

- `api/*.js` duplicates the FastAPI endpoints. It predates the Python backend
  and exists so the app can deploy to Vercel as serverless functions; the two
  implementations have to be kept in sync by hand.
- The hardcoded `YAHOO_SYMBOLS` map in `src/data/api.js` needs dynamic
  exchange-aware resolution.
- TSX-V coverage depends on which source picks the ticker up.
- `fetchAllQuotes` calls `/api/stock` once per ticker while `/api/quotes`
  already batches. The list view spends more Finnhub budget than it needs to.
- Failed requests surface as empty panels. The fetch helpers return `null` on
  error, so the UI cannot tell "this failed" from "there is no data".
