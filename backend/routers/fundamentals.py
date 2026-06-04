"""GET /api/fundamentals — key statistics and financial ratios from Yahoo Finance."""

from fastapi import APIRouter, Query

from backend.deps import CacheDep, HttpDep, LimiterDep
from backend.fetchers.yahoo import YahooFetcher

router = APIRouter()


@router.get("/api/fundamentals")
async def get_fundamentals(
    symbol: str = Query(..., min_length=1),
    http: HttpDep = None,
    cache: CacheDep = None,
    limiter: LimiterDep = None,
):
    symbol = symbol.strip()
    cached = await cache.get(symbol, "yahoo", "fundamentals")
    if cached is not None:
        return cached

    if not await limiter.consume("yahoo"):
        return {}

    await cache._redis.incr("metrics:source:yahoo:requests")
    data = await YahooFetcher(http).quote_summary(symbol, "defaultKeyStatistics,financialData")

    ks = data.get("defaultKeyStatistics", {})
    fd = data.get("financialData", {})

    def raw(d, key):
        v = d.get(key)
        if isinstance(v, dict):
            return v.get("raw")
        return v

    payload = {
        "forwardPE": raw(ks, "forwardPE"),
        "pegRatio": raw(ks, "pegRatio"),
        "shortRatio": raw(ks, "shortRatio"),
        "shortPctFloat": raw(ks, "shortPercentOfFloat"),
        "currentRatio": raw(fd, "currentRatio"),
        "debtToEquity": raw(fd, "debtToEquity"),
        "freeCashFlow": raw(fd, "freeCashflow"),
        "operatingMargins": raw(fd, "operatingMargins"),
        "profitMargins": raw(fd, "profitMargins"),
        "returnOnEquity": raw(fd, "returnOnEquity"),
        "returnOnAssets": raw(fd, "returnOnAssets"),
    }
    await cache.set(symbol, "yahoo", "fundamentals", payload)
    return payload
