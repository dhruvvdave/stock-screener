"""End-to-end router tests over the real app, with upstream fetchers stubbed.

These are what catch the original defect: the cache unit tests all passed
while /api/stock, /api/candle and /api/news never hit the cache, because the
mismatch lived at the call sites rather than inside ResponseCache.
"""

import httpx
import pytest
import pytest_asyncio

from backend.deps import get_cache, get_http, get_limiter, get_redis
from backend.main import create_app
from backend.services.cache import ResponseCache
from backend.services.rate_limiter import TokenBucketLimiter


@pytest_asyncio.fixture
async def client(redis, settings, monkeypatch):
    """The real app, wired to in-memory Redis, with no outbound HTTP."""
    monkeypatch.setattr("backend.services.db.init_db", _noop)
    app = create_app()

    app.dependency_overrides[get_redis] = lambda: redis
    app.dependency_overrides[get_cache] = lambda: ResponseCache(redis)
    app.dependency_overrides[get_limiter] = lambda: TokenBucketLimiter(redis)
    app.dependency_overrides[get_http] = lambda: None

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _noop(*args, **kwargs):
    return None


class Counter:
    """Records how many times a stubbed upstream was called."""

    def __init__(self, value):
        self.value = value
        self.calls = 0

    async def __call__(self, *args, **kwargs):
        self.calls += 1
        return self.value


# ── The cache actually caches ──────────────────────────────────────────────
# Each of these endpoints falls through several providers. The provider that
# answers must not change where the result is stored, or the next request
# looks elsewhere and misses.

async def test_stock_serves_the_second_request_from_cache(client, monkeypatch):
    quote = Counter({"symbol": "AAPL", "price": 195.0, "source": "finnhub"})
    monkeypatch.setattr("backend.fetchers.finnhub.FinnhubFetcher.quote", quote)

    first = await client.get("/api/stock", params={"symbol": "AAPL"})
    second = await client.get("/api/stock", params={"symbol": "AAPL"})

    assert first.status_code == 200
    assert first.json() == second.json()
    assert quote.calls == 1, f"upstream called {quote.calls}x — cache is not being hit"


async def test_stock_caches_a_fallback_answer_under_the_same_key(client, monkeypatch):
    """Finnhub fails, Yahoo answers. The next request must still hit."""
    finnhub = Counter(None)
    yahoo = Counter({"regularMarketPrice": 195.0, "regularMarketChangePercent": 1.2})
    monkeypatch.setattr("backend.fetchers.finnhub.FinnhubFetcher.quote", finnhub)
    monkeypatch.setattr("backend.fetchers.yahoo.YahooFetcher.quote", yahoo)

    first = await client.get("/api/stock", params={"symbol": "AAPL"})
    second = await client.get("/api/stock", params={"symbol": "AAPL"})

    assert first.status_code == 200
    assert first.json()["price"] == 195.0
    assert second.json() == first.json()
    assert yahoo.calls == 1, "fallback result was not served from cache"
    assert finnhub.calls == 1, "cached request still re-tried the primary source"


async def test_candle_serves_the_second_request_from_cache(client, monkeypatch):
    payload = {"prices": [1.0, 2.0, 3.0], "lastClose": 3.0,
               "ohlcv": [], "timestamps": [], "source": "yahoo"}
    candle = Counter(payload)
    monkeypatch.setattr("backend.fetchers.yahoo.YahooFetcher.candle", candle)

    params = {"symbol": "AAPL", "range": "1mo"}
    first = await client.get("/api/candle", params=params)
    second = await client.get("/api/candle", params=params)

    assert first.status_code == 200
    assert first.json()["prices"] == [1.0, 2.0, 3.0]
    assert second.json() == first.json()
    assert candle.calls == 1, f"upstream called {candle.calls}x — cache is not being hit"


async def test_candle_ranges_are_cached_separately(client, monkeypatch):
    candle = Counter({"prices": [1.0, 2.0, 3.0], "lastClose": 3.0,
                      "ohlcv": [], "timestamps": [], "source": "yahoo"})
    monkeypatch.setattr("backend.fetchers.yahoo.YahooFetcher.candle", candle)

    await client.get("/api/candle", params={"symbol": "AAPL", "range": "1mo"})
    await client.get("/api/candle", params={"symbol": "AAPL", "range": "1y"})
    assert candle.calls == 2, "different ranges must not share a cache entry"


async def test_news_serves_the_second_request_from_cache(client, monkeypatch):
    news = Counter([{"title": "headline", "publisher": "wire", "link": "u", "publishedAt": 1}])
    monkeypatch.setattr("backend.fetchers.yahoo.YahooFetcher.news", news)

    first = await client.get("/api/news", params={"symbol": "AAPL"})
    second = await client.get("/api/news", params={"symbol": "AAPL"})

    assert first.status_code == 200
    assert second.json() == first.json()
    assert news.calls == 1, f"upstream called {news.calls}x — cache is not being hit"


async def test_stock_and_quotes_do_not_overwrite_each_other(client, monkeypatch):
    """Both hold a 'quote' for a ticker but in different shapes."""
    monkeypatch.setattr(
        "backend.fetchers.finnhub.FinnhubFetcher.quote",
        Counter({"symbol": "AAPL", "price": 195.0, "high": 196.0}),
    )
    monkeypatch.setattr(
        "backend.fetchers.yahoo.YahooFetcher.quotes_batch",
        Counter({"AAPL": {"price": 195.0, "change": 1.2, "mktCap": 3000.0}}),
    )

    single = (await client.get("/api/stock", params={"symbol": "AAPL"})).json()
    batch = (await client.get("/api/quotes", params={"symbols": "AAPL"})).json()
    single_again = (await client.get("/api/stock", params={"symbol": "AAPL"})).json()

    assert batch["AAPL"]["mktCap"] == 3000.0
    assert single_again == single, "the batch endpoint clobbered the single-quote entry"


async def test_cache_metrics_report_real_hits(client, monkeypatch):
    monkeypatch.setattr(
        "backend.fetchers.finnhub.FinnhubFetcher.quote",
        Counter({"symbol": "AAPL", "price": 195.0}),
    )
    for _ in range(4):
        await client.get("/api/stock", params={"symbol": "AAPL"})

    metrics = (await client.get("/metrics")).json()
    assert metrics["cache"]["hits"] >= 3
    assert metrics["cache"]["hit_rate"] > 0.5


# ── Input validation ───────────────────────────────────────────────────────

@pytest.mark.parametrize("symbol", [
    "", " ", "A" * 25, "AAPL;DROP", "../etc/passwd", "AA PL", "<script>",
])
async def test_bad_symbols_are_rejected_with_422(client, symbol):
    r = await client.get("/api/stock", params={"symbol": symbol})
    assert r.status_code == 422


@pytest.mark.parametrize("symbol", ["AAPL", "BRK.B", "SHOP.TO", "GSI.V", "TSX:SHOP", "^GSPC"])
async def test_real_symbols_are_accepted(client, monkeypatch, symbol):
    monkeypatch.setattr(
        "backend.fetchers.finnhub.FinnhubFetcher.quote",
        Counter({"symbol": symbol, "price": 1.0}),
    )
    assert (await client.get("/api/stock", params={"symbol": symbol})).status_code == 200


async def test_missing_symbol_is_rejected(client):
    assert (await client.get("/api/stock")).status_code == 422


@pytest.mark.parametrize("window", ["5mo", "10y", "1d", "'; DROP TABLE"])
async def test_invalid_candle_range_is_rejected(client, window):
    """It used to be silently coerced to 1mo, so a typo returned the wrong
    window with a 200 and no hint anything was wrong."""
    r = await client.get("/api/candle", params={"symbol": "AAPL", "range": window})
    assert r.status_code == 422


async def test_quotes_rejects_an_empty_list(client):
    assert (await client.get("/api/quotes", params={"symbols": ""})).status_code == 422


async def test_quotes_caps_the_batch_size(client, monkeypatch):
    from backend.routers.quotes import MAX_SYMBOLS

    seen = []

    async def record(self, symbols):
        seen.append(symbols)
        return {}

    monkeypatch.setattr("backend.fetchers.yahoo.YahooFetcher.quotes_batch", record)
    symbols = ",".join(f"SYM{i}" for i in range(MAX_SYMBOLS + 50))

    r = await client.get("/api/quotes", params={"symbols": symbols})
    assert r.status_code == 200
    assert len(seen[0]) == MAX_SYMBOLS, f"forwarded {len(seen[0])} symbols upstream"


async def test_quotes_deduplicates_symbols(client, monkeypatch):
    seen = []

    async def record(self, symbols):
        seen.append(symbols)
        return {}

    monkeypatch.setattr("backend.fetchers.yahoo.YahooFetcher.quotes_batch", record)
    await client.get("/api/quotes", params={"symbols": "AAPL,aapl,MSFT,AAPL"})
    assert seen[0] == ["AAPL", "MSFT"]


# ── Rate limiting ──────────────────────────────────────────────────────────

async def test_exhausted_budget_returns_429_with_retry_after(client, redis, settings, monkeypatch):
    """It used to answer 200 with an empty body, so callers cached a blank
    as though it were data."""
    monkeypatch.setattr(
        "backend.fetchers.finnhub.FinnhubFetcher.quote",
        Counter({"symbol": "AAPL", "price": 1.0}),
    )
    limiter = TokenBucketLimiter(redis)
    for source in ("finnhub", "yahoo", "twelvedata"):
        capacity, _ = settings.rate_params(source)
        for _ in range(int(capacity)):
            await limiter.consume(source)

    r = await client.get("/api/stock", params={"symbol": "ZZZZ"})
    assert r.status_code == 429
    assert int(r.headers["Retry-After"]) >= 1


async def test_a_symbol_with_no_quote_is_404_not_429(client, monkeypatch):
    """A budget problem and a nonexistent ticker need different answers."""
    monkeypatch.setattr("backend.fetchers.finnhub.FinnhubFetcher.quote", Counter(None))
    monkeypatch.setattr("backend.fetchers.yahoo.YahooFetcher.quote", Counter(None))

    r = await client.get("/api/stock", params={"symbol": "NOTREAL"})
    assert r.status_code == 404


async def test_a_failed_fetch_is_not_cached(client, monkeypatch):
    quote = Counter(None)
    monkeypatch.setattr("backend.fetchers.finnhub.FinnhubFetcher.quote", quote)
    monkeypatch.setattr("backend.fetchers.yahoo.YahooFetcher.quote", Counter(None))

    await client.get("/api/stock", params={"symbol": "AAPL"})
    await client.get("/api/stock", params={"symbol": "AAPL"})
    assert quote.calls == 2, "a failure was cached and served as though it were data"


# ── Health ─────────────────────────────────────────────────────────────────

async def test_health_reports_redis_up_and_postgres_down(client):
    r = await client.get("/health")
    assert r.status_code == 503          # no Postgres in the test environment
    body = r.json()
    assert body["checks"]["redis"] is True
    assert body["checks"]["postgres"] is False
    assert body["status"] == "degraded"
