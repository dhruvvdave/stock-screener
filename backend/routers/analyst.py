"""GET /api/analyst — analyst recommendations + price targets + sentiment."""

from fastapi import APIRouter, Query

from backend.deps import CacheDep, HttpDep, LimiterDep
from backend.fetchers.finnhub import FinnhubFetcher

router = APIRouter()


@router.get("/api/analyst")
async def get_analyst(
    symbol: str = Query(..., min_length=1),
    http: HttpDep = None,
    cache: CacheDep = None,
    limiter: LimiterDep = None,
):
    symbol = symbol.strip().upper()
    cached = await cache.get(symbol, "finnhub", "analyst")
    if cached is not None:
        return cached

    empty = {"buy": 0, "hold": 0, "sell": 0, "total": 0,
             "meanTarget": None, "highTarget": None, "lowTarget": None,
             "bullish": None, "bearish": None, "articles": 0}

    if not await limiter.consume("finnhub"):
        return empty

    await cache._redis.incr("metrics:source:finnhub:requests")
    result = await FinnhubFetcher(http).analyst(symbol)
    await cache.set(symbol, "finnhub", "analyst", result)
    return result
