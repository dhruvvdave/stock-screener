# CLAUDE.md

Working notes for Markr — a keyboard-driven stock screener. React 19 + Vite frontend,
FastAPI backend, Redis (cache + rate limiting), PostgreSQL (partitioned OHLCV history).

Read this before changing backend code. It records how things are wired *today*, not
how they ought to be.

## Commands

```bash
# Frontend
npm ci                  # install (must run before test/lint — jest is a devDependency)
npm run dev             # Vite dev server on :5173, proxies /api /metrics /history to :8000
npm run build           # production build to dist/
npm run lint            # eslint . — currently clean, keep it that way
npm test                # jest --config jest.config.cjs — 32 tests, all passing

# Backend + infrastructure
docker-compose up       # Redis :6379, Postgres :5432 (markr/markr/markr), FastAPI :8000
docker-compose down     # stop
docker-compose down -v  # stop and drop the Redis/Postgres volumes

# Backend without Docker
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

`.env` is required for the API container (`cp .env.example .env`). Only `FINNHUB_KEY`
is needed for the app to be useful; the rest degrade to empty panels.

Known breakage: `backend/Dockerfile` does `COPY requirements.txt .`, but docker-compose
builds with `context: .` (repo root), where that file does not exist — it lives at
`backend/requirements.txt`. The image build fails as committed. Fix the COPY paths (or
the build context) before relying on `docker-compose up` for the API service.

There is no `/health` endpoint. Anything that needs one (container health checks, load
balancer target groups) has to add it.

## Architecture

### Two backends, one API contract

The same endpoints are implemented twice:

- `backend/` — FastAPI, the real backend. Used in local dev (Vite proxies to :8000)
  and in docker-compose.
- `api/*.js` — Vercel serverless functions. Used by the Vercel deployment
  (`vercel.json` routes `/api/` to them). A duplicated, independently drifting copy of
  the same fallback logic.

When changing fallback behaviour, decide deliberately whether the JS copy needs the
same change. The Jest suite tests the JS copy, not the Python one.

### Request path

Every external call goes through two layers:

1. **Response cache** (`backend/services/cache.py`) — Redis, keyed
   `cache:{TICKER}:{source}:{resolution}`. TTL is dispatched by resolution string via
   `Settings.ttl_for_resolution` (intraday 60s, hourly 300s, daily+ 3600s). Bumps
   `metrics:cache:hits` / `metrics:cache:misses` on every read.
2. **Token bucket rate limiter** (`backend/services/rate_limiter.py`) — Redis, one
   bucket per source, keys `ratelimit:{source}:tokens` and `ratelimit:{source}:last`
   (no TTL on either). Refill + consume run atomically in the `_LUA` script registered
   in `TokenBucketLimiter.__init__`. Denials bump
   `metrics:source:{source}:rate_limit_hits`.

Both are injected per-request through `backend/deps.py` (`CacheDep`, `LimiterDep`,
`HttpDep`, `RedisDep`). The Redis connection and the shared `httpx.AsyncClient` live on
`app.state`, created in the `startup` hook in `backend/main.py`.

### Providers and the fallback chain

Adapters live in `backend/fetchers/`, one module per source. There is no base class,
no protocol, and no registry — `fetchers/__init__.py` only re-exports. A fetcher is a
plain class taking an `httpx.AsyncClient` in its constructor.

The fallback chain is **not a data structure**. It is hand-written sequential `if`
blocks inside each router. `backend/routers/candle.py` is the canonical four-step
example. Each step follows the same shape:

```python
if <symbol available> and await limiter.consume("source"):
    await cache._redis.incr("metrics:source:source:requests")
    result = await fetcher.method(...)
    if result:
        await cache.set(cache_ticker, "source", resolution, result)
        return result
elif <symbol available>:
    log.warning("source rate-limited on ... for %s", symbol)
```

Chains as they stand:

```
Stock quote:   Finnhub → Yahoo → Twelve Data   → 404
Candle/chart:  Finnhub → Yahoo → Stooq → Twelve Data → {"prices": None}
News:          Yahoo → Finnhub                 → {"news": []}
Profile:       Yahoo + Finnhub (parallel, merged)
Enrich:        FMP + Alpha Vantage (parallel)
```

Two behaviours to keep in mind:

- A rate-limit denial and "the source returned nothing" take the *same* path to the
  next source. The chain degrades silently under exhaustion; only the log line and the
  `/metrics` counter distinguish them.
- The terminal (all-sources-failed) behaviour is inconsistent across routers — 404 vs.
  a null payload vs. an empty list. Match the router you are editing rather than
  normalising it as a side effect of some other change.

### Symbol formats

Each provider wants a different spelling of the same ticker:

| Provider | TSX | TSX-V | Example |
|---|---|---|---|
| Finnhub | `TSX:SHOP` | `TSXV:GSI` | prefix form |
| Yahoo | `SHOP.TO` | `GSI.V` | suffix form |
| Stooq | `shop.ca` | `gsi.ca` | lowercase + country |
| TradingView | `TSX:SHOP` | `TSXV:GSI` | prefix form |

Conversion logic is currently duplicated in at least four places:
`src/data/api.js` (`YAHOO_SYMBOLS`, `FINNHUB_SYMBOLS`, `toYahooSymbol`,
`toFinnhubSymbol`, `toTVSymbol`), `backend/routers/stock.py:_finnhub_to_yahoo`,
`backend/fetchers/finnhub.py:_finnhub_to_yahoo`, `backend/fetchers/stooq.py:_to_stooq_symbol`,
and `api/stock.js:finnhubToYahoo`. The frontend hardcoded maps are the known cause of
TSX-V flakiness.

The frontend passes both spellings to endpoints that need them — `/api/candle` and
`/api/news` take `symbol` (Yahoo) *and* `finnhubSymbol` (Finnhub), and each fallback
step uses whichever it understands.

### Price history and partitioning

`price_history` is declared in `backend/services/db.py` as `PARTITION BY RANGE
(timestamp)` with composite primary key `(id, timestamp)` — Postgres requires the
partition key in the PK. SQLAlchemy's `PriceHistory` model maps the parent table only;
partition DDL is raw SQL in `PARTITION_DDL` plus a loop in `init_db()`.

`init_db()` creates the current month and the next two, and runs once from the
`startup` hook. Partitions past that have to be created by hand.

Writes are fire-and-forget: `fire_and_forget_write()` schedules the insert with
`asyncio.ensure_future` and the request returns without waiting. Combined with the
`try/except` around `init_db()` in `main.py` (which logs a **warning** and continues),
this means a write landing outside every existing partition fails invisibly — the
endpoint still returns 200 and `/history` just returns fewer rows. Treat any change
here as needing a loud failure path.

`backend/services/db.py` uses the deprecated `datetime.utcnow()`; the Dockerfile
targets Python 3.12.

## Conventions

**Errors.** Fetchers never raise. Every method wraps its body in `try/except Exception`
and returns `None`, `[]`, or `{}` on failure, so the router's `if result:` check is the
only control flow. Routers decide the HTTP outcome. If you add a fetcher method, match
this — a raising fetcher will break the chain rather than fall through it.

**Logging.** Module-level `log = logging.getLogger(__name__)`. Rate-limit denials log
at WARNING with the source name and symbol. Background write failures use
`log.exception`. Nothing logs at DEBUG.

**Naming.** Fetcher modules expose a module-level `SOURCE = "name"` constant. That
string is load-bearing in three places and they must agree:
`Settings.rate_{source}` in `backend/config.py`, the `_SOURCES` list in
`backend/routers/app_metrics.py`, and the `metrics:source:{source}:*` Redis keys. Add
a source and you must touch all three.

**Config.** Everything is env-driven through `pydantic-settings` in
`backend/config.py`. Rate limits are encoded as `"capacity,refill_per_second"` strings
parsed by `Settings.rate_params()`. `get_settings()` is `@lru_cache`d — call it inside
functions, not at import time, or tests can't override it.

**Routers.** One file per endpoint in `backend/routers/`, each exporting `router =
APIRouter()`, with the full path declared on the decorator (`@router.get("/api/stock")`)
rather than via a prefix. New routers must be added to *both* the import list and the
`for router_module in [...]` loop in `backend/main.py`.

**Metrics.** Counters are plain Redis `INCR`s read back by `/metrics`. Note that
routers reach through the cache object to get at Redis (`cache._redis.incr(...)`) —
it's a private attribute used publicly throughout. Consistent, but not something to
copy into new code without noticing.

**Frontend.** All API access is funnelled through `src/data/api.js`; components do not
call `fetch` directly. Every wrapper catches its own errors and returns `null` or an
empty collection — the UI has no error boundaries and relies on this.

## Testing

`src/__tests__/fallback.test.js` is the only test file (32 tests). It covers:

1. Symbol helpers — `toYahooSymbol`, `toTVSymbol`, `isCADExchange`, `convertPrice`
2. `calculateTechnicals` — asserts types and ranges (RSI in 0–100, upper > mid > lower),
   not exact indicator values, over a deterministic `Math.sin`-generated series
3. Frontend fetch wrappers with `global.fetch` replaced by a Jest mock
4. The `api/stock.js` **Vercel** handler's fallback chain, driven by
   `mockResolvedValueOnce` sequences

The FastAPI backend has **no tests at all** — no pytest, no test dependency in
`backend/requirements.txt`, no `backend/tests/`. The fallback logic under test is the
JavaScript copy, not the Python one. Backend work that needs test coverage has to stand
up pytest + pytest-asyncio first.

Jest runs `testEnvironment: 'node'` and transforms ESM through `babel-jest`
(`babel.config.cjs` targets the current Node and compiles to CommonJS).
