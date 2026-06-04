"""GET /api/metrics (stock) — per-ticker metrics from Finnhub.

Named stock_metrics.py to avoid collision with the app-level /metrics endpoint.
"""

from fastapi import APIRouter, HTTPException, Query

from backend.deps import CacheDep, HttpDep, LimiterDep
from backend.fetchers.finnhub import FinnhubFetcher

router = APIRouter()


@router.get("/api/metrics")
async def get_stock_metrics(
    symbol: str = Query(..., min_length=1),
    http: HttpDep = None,
    cache: CacheDep = None,
    limiter: LimiterDep = None,
):
    symbol = symbol.strip().upper()
    cached = await cache.get(symbol, "finnhub", "metrics")
    if cached is not None:
        return cached

    if not await limiter.consume("finnhub"):
        raise HTTPException(status_code=429, detail="Finnhub rate limit reached")

    await cache._redis.incr("metrics:source:finnhub:requests")
    result = await FinnhubFetcher(http).metrics(symbol)
    if result is None:
        raise HTTPException(status_code=502, detail="Finnhub metrics unavailable")

    await cache.set(symbol, "finnhub", "metrics", result)
    return result
