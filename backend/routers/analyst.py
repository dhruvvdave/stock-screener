"""GET /api/analyst — analyst recommendations, price targets and sentiment."""

from fastapi import APIRouter

from backend.deps import CacheDep, HttpDep, LimiterDep
from backend.fetchers.finnhub import FinnhubFetcher
from backend.services import cache as cache_res
from backend.validation import Symbol, rate_limited

router = APIRouter()


@router.get("/api/analyst")
async def get_analyst(symbol: Symbol, http: HttpDep, cache: CacheDep, limiter: LimiterDep):
    symbol = symbol.strip().upper()
    limited = False

    async def fetch():
        nonlocal limited
        if not await limiter.consume("finnhub"):
            limited = True
            return None
        await cache.incr_source("finnhub")
        return await FinnhubFetcher(http).analyst(symbol)

    result = await cache.get_or_set(symbol, cache_res.ANALYST, fetch)
    if result is not None:
        return result
    raise rate_limited("finnhub", await limiter.retry_after("finnhub"))
