"""GET /api/enrich — optional enrichment from FMP + Alpha Vantage."""

import asyncio

from fastapi import APIRouter, Query

from backend.deps import CacheDep, HttpDep, LimiterDep
from backend.fetchers.fmp import FMPFetcher
from backend.fetchers.alphavantage import AlphaVantageFetcher

router = APIRouter()


@router.get("/api/enrich")
async def get_enrich(
    symbol: str = Query(..., min_length=1),
    http: HttpDep = None,
    cache: CacheDep = None,
    limiter: LimiterDep = None,
):
    symbol = symbol.strip().upper()
    cached = await cache.get(symbol, "any", "enrich")
    if cached is not None:
        return cached

    fmp_ok = await limiter.consume("fmp")
    av_ok = await limiter.consume("alphavantage")

    fmp_task = FMPFetcher(http).enrich(symbol) if fmp_ok else asyncio.sleep(0, result=None)
    av_task = AlphaVantageFetcher(http).overview(symbol) if av_ok else asyncio.sleep(0, result=None)

    if fmp_ok:
        await cache._redis.incr("metrics:source:fmp:requests")
    if av_ok:
        await cache._redis.incr("metrics:source:alphavantage:requests")

    fmp_data, overview = await asyncio.gather(fmp_task, av_task)
    payload = {"fmp": fmp_data, "overview": overview}
    await cache.set(symbol, "any", "enrich", payload)
    return payload
