"""GET /api/metrics (per ticker) — key metrics from Finnhub.

Named stock_metrics.py so it does not collide with the app-level /metrics.
"""

from fastapi import APIRouter

from backend.deps import CacheDep, HttpDep, LimiterDep
from backend.fetchers.finnhub import FinnhubFetcher
from backend.services import cache as cache_res
from backend.validation import Symbol, rate_limited, upstream_unavailable

router = APIRouter()


@router.get("/api/metrics")
async def get_stock_metrics(symbol: Symbol, http: HttpDep, cache: CacheDep, limiter: LimiterDep):
    symbol = symbol.strip().upper()
    limited = False

    async def fetch():
        nonlocal limited
        if not await limiter.consume("finnhub"):
            limited = True
            return None
        await cache.incr_source("finnhub")
        return await FinnhubFetcher(http).metrics(symbol)

    result = await cache.get_or_set(symbol, cache_res.STOCK_METRICS, fetch)
    if result is not None:
        return result
    if limited:
        raise rate_limited("finnhub", await limiter.retry_after("finnhub"))
    raise upstream_unavailable(f"Finnhub returned no metrics for {symbol}")
