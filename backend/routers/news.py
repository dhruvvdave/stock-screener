"""GET /api/news — company news with Yahoo → Finnhub fallback."""

from fastapi import APIRouter, Query

from backend.deps import CacheDep, HttpDep, LimiterDep
from backend.fetchers.finnhub import FinnhubFetcher
from backend.fetchers.yahoo import YahooFetcher

router = APIRouter()


@router.get("/api/news")
async def get_news(
    symbol: str = Query(""),
    finnhubSymbol: str = Query(""),
    http: HttpDep = None,
    cache: CacheDep = None,
    limiter: LimiterDep = None,
):
    ticker = (finnhubSymbol or symbol).upper()
    cached = await cache.get(ticker, "any", "news")
    if cached is not None:
        return cached

    yahoo = YahooFetcher(http)
    finnhub = FinnhubFetcher(http)

    if symbol and await limiter.consume("yahoo"):
        await cache._redis.incr("metrics:source:yahoo:requests")
        items = await yahoo.news(symbol)
        if items:
            payload = {"news": items}
            await cache.set(ticker, "yahoo", "news", payload)
            return payload

    if finnhubSymbol and await limiter.consume("finnhub"):
        await cache._redis.incr("metrics:source:finnhub:requests")
        items = await finnhub.news(finnhubSymbol.upper())
        if items:
            payload = {"news": items}
            await cache.set(ticker, "finnhub", "news", payload)
            return payload

    return {"news": []}
