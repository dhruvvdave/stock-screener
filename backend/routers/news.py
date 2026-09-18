"""GET /api/news — company news with Yahoo → Finnhub fallback."""

from fastapi import APIRouter

from backend.deps import CacheDep, HttpDep, LimiterDep
from backend.fetchers.finnhub import FinnhubFetcher
from backend.fetchers.yahoo import YahooFetcher
from backend.services import cache as cache_res
from backend.validation import OptionalSymbol, not_found, rate_limited

router = APIRouter()


@router.get("/api/news")
async def get_news(
    http: HttpDep,
    cache: CacheDep,
    limiter: LimiterDep,
    symbol: OptionalSymbol = "",
    finnhubSymbol: OptionalSymbol = "",  # noqa: N803 — query name the frontend sends
):
    ticker = (finnhubSymbol or symbol).upper()
    if not ticker:
        raise not_found("Provide symbol or finnhubSymbol")

    exhausted: list[str] = []

    async def fetch():
        if symbol:
            if await limiter.consume("yahoo"):
                await cache.incr_source("yahoo")
                items = await YahooFetcher(http).news(symbol)
                if items:
                    return {"news": items}
            else:
                exhausted.append("yahoo")

        if finnhubSymbol:
            if await limiter.consume("finnhub"):
                await cache.incr_source("finnhub")
                items = await FinnhubFetcher(http).news(finnhubSymbol.upper())
                if items:
                    return {"news": items}
            else:
                exhausted.append("finnhub")

        return None

    result = await cache.get_or_set(ticker, cache_res.NEWS, fetch)
    if result is not None:
        return result

    if exhausted:
        source = exhausted[0]
        raise rate_limited(source, await limiter.retry_after(source))
    # No news is a legitimate answer, not an error.
    return {"news": []}
