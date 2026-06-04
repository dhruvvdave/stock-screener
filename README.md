# Markr

A keyboard-driven stock screener. Type a ticker, hit Enter, get live price data, charts, analyst consensus, technicals, and news. No account, no friction.

I built this because every screener I found was either too bloated, behind a paywall, or slow. The terminal aesthetic isn't decoration — `j`/`k` to move through the list, `Enter` to open, `s` to star.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite |
| Backend | FastAPI (Python 3.12) |
| Cache | Redis — response cache + token bucket rate limiter |
| Database | PostgreSQL — partitioned OHLCV price history |
| Data sources | Finnhub, Yahoo Finance, FMP, Alpha Vantage, Stooq, Twelve Data |
| Deployment | Docker Compose (local), Vercel (frontend) |

## Features

- Universal ticker search with autofill
- Live quotes refreshing every 45 seconds
- Price chart via TradingView embed
- Technical indicators from price history: RSI(14), MACD, Bollinger Bands, MA50/200
- Analyst consensus: buy/hold/sell breakdown, price targets
- Financial health metrics and key statistics
- Recent news with Yahoo → Finnhub fallback
- Persistent watchlist with price alerts and browser notifications
- Portfolio tracker: shares, avg cost, value, P&L, allocation
- Upcoming earnings dates for watchlisted tickers
- AI analysis via OpenAI (you bring your own key, stored locally)
- USD/CAD currency toggle with live exchange rates
- Multi-exchange support: NYSE, NASDAQ, TSX, TSX-V, LSE, ASX, NSE, OTC, XETRA

## Architecture

The backend is a FastAPI service with two infrastructure layers sitting in front of every external API call:

**Redis caching** — responses are cached keyed by `{ticker}:{source}:{resolution}`. TTLs are configurable per resolution: intraday data (5min, 1h) expires quickly (60–300s), daily data is held longer (3600s). Hit and miss counts are tracked via Redis `INCR` and exposed on the `/metrics` endpoint.

**Token bucket rate limiter** — each data source (Finnhub, Yahoo, Alpha Vantage, etc.) has its own bucket stored in Redis. An atomic Lua script handles refill and consume in a single round-trip, preventing races under concurrent requests or multiple workers. Capacity and refill rate are configurable per source. When a source is exhausted, the request falls through to the next source in the fallback chain. If all sources are exhausted, the endpoint returns a 429 or an empty response depending on context.

**PostgreSQL price history** — after a successful candle fetch, OHLCV rows are written asynchronously (non-blocking) to a `price_history` table range-partitioned by month. The `/history/{ticker}` endpoint reads directly from Postgres with optional `start`/`end` filters.

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
| GET | `/api/analyst?symbol=` | Analyst recommendations + sentiment |
| GET | `/api/news?symbol=&finnhubSymbol=` | Recent news |
| GET | `/api/fundamentals?symbol=` | Key statistics and ratios |
| GET | `/api/metrics?symbol=` | Per-ticker Finnhub metrics |
| GET | `/api/enrich?symbol=` | FMP + Alpha Vantage enrichment |
| GET | `/metrics` | System metrics (cache hit rate, source counters) |
| GET | `/history/{ticker}?start=&end=` | Historical OHLCV from Postgres |

## Setup

### 1. Get a Finnhub API key

Free tier at [finnhub.io](https://finnhub.io). The app works without the optional keys but some panels will be empty.

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your keys:

```env
# Required
FINNHUB_KEY=your_key_here

# Optional — richer data
FMP_KEY=
AV_KEY=
TWELVE_DATA_KEY=
```

### 3. Start the backend + infrastructure

```bash
docker-compose up
```

This starts:
- Redis on `localhost:6379`
- PostgreSQL on `localhost:5432` (user/pass/db: `markr`)
- FastAPI on `localhost:8000`

The database schema (partitioned `price_history` table) is created automatically on first startup.

### 4. Start the frontend

```bash
npm ci
npm run dev
```

Vite proxies `/api`, `/metrics`, and `/history` to `localhost:8000` automatically.

Open [http://localhost:5173](http://localhost:5173).

## Configuration reference

All values can be set via environment variables. Defaults are shown.

```env
# Infrastructure
REDIS_URL=redis://localhost:6379/0
POSTGRES_DSN=postgresql+asyncpg://markr:markr@localhost:5432/markr

# Cache TTLs (seconds)
TTL_5MIN=60       # intraday resolutions (5min, 15min, 30min)
TTL_1H=300        # hourly resolution
TTL_1D=3600       # daily and above

# Token bucket per source: "capacity,refill_rate_per_second"
RATE_FINNHUB=30,0.5           # 30 burst, 0.5 req/s sustained
RATE_YAHOO=60,2.0
RATE_ALPHAVANTAGE=5,0.083     # free tier: 5 req/min
RATE_FMP=10,0.167             # free tier: 10 req/min
RATE_STOOQ=30,1.0
RATE_TWELVEDATA=8,0.133       # free tier: 8 req/min
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
├── main.py              # FastAPI app factory, lifespan hooks
├── config.py            # Pydantic Settings (all env vars)
├── deps.py              # FastAPI dependency providers (Redis, HTTP client)
├── fetchers/
│   ├── finnhub.py       # Quotes, candles, search, analyst, metrics, news
│   ├── yahoo.py         # Quotes (single + batch), candles, profile, news
│   ├── alphavantage.py  # OVERVIEW and TIME_SERIES_DAILY
│   ├── fmp.py           # Key metrics and income statements
│   └── stooq.py         # Free candle fallback, no key required
├── services/
│   ├── cache.py         # Redis response cache with TTL dispatch
│   ├── rate_limiter.py  # Token bucket limiter via atomic Lua script
│   └── db.py            # SQLAlchemy async + partitioned price_history
└── routers/
    ├── stock.py          # /api/stock
    ├── quotes.py         # /api/quotes
    ├── candle.py         # /api/candle
    ├── search.py         # /api/search
    ├── profile.py        # /api/profile
    ├── analyst.py        # /api/analyst
    ├── news.py           # /api/news
    ├── fundamentals.py   # /api/fundamentals
    ├── stock_metrics.py  # /api/metrics (per-ticker)
    ├── enrich.py         # /api/enrich
    ├── app_metrics.py    # /metrics (system)
    └── history.py        # /history/{ticker}
```

## Known issues

- The hardcoded `YAHOO_SYMBOLS` map in `src/data/api.js` needs dynamic exchange-aware resolution
- TSX-V stocks are hit or miss depending on which data source picks them up
- Monthly Postgres partitions beyond the initial three need to be created manually (or via a cron job)
