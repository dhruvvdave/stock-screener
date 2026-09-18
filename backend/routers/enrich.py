"""GET /api/enrich — optional enrichment from FMP and Alpha Vantage."""

import asyncio

from fastapi import APIRouter

from backend.deps import CacheDep, HttpDep, LimiterDep
from backend.fetchers.alphavantage import AlphaVantageFetcher
from backend.fetchers.fmp import FMPFetcher
from backend.services import cache as cache_res
from backend.validation import Symbol

router = APIRouter()


@router.get("/api/enrich")
async def get_enrich(symbol: Symbol, http: HttpDep, cache: CacheDep, limiter: LimiterDep):
    symbol = symbol.strip().upper()

    async def fetch():
        fmp_ok = await limiter.consume("fmp")
        av_ok = await limiter.consume("alphavantage")
        if fmp_ok:
            await cache.incr_source("fmp")
        if av_ok:
            await cache.incr_source("alphavantage")

        fmp_data, overview = await asyncio.gather(
            FMPFetcher(http).enrich(symbol) if fmp_ok else _none(),
            AlphaVantageFetcher(http).overview(symbol) if av_ok else _none(),
            return_exceptions=True,
        )
        payload = {
            "fmp": fmp_data if not isinstance(fmp_data, BaseException) else None,
            "overview": overview if not isinstance(overview, BaseException) else None,
        }
        # Both sources are optional extras, so an all-empty result is a real
        # answer, just not one worth holding for six hours.
        return payload

    return await cache.get_or_set(
        symbol, cache_res.ENRICH, fetch,
        should_cache=lambda v: bool(v and (v.get("fmp") or v.get("overview"))),
    )


async def _none():
    return None
