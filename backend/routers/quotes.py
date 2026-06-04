"""GET /api/quotes — batch quotes from Yahoo Finance."""

import logging

from fastapi import APIRouter, Query

from backend.deps import CacheDep, HttpDep, LimiterDep
from backend.fetchers.yahoo import YahooFetcher

log = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/quotes")
async def get_quotes(
    symbols: str = Query(..., description="Comma-separated ticker list"),
    http: HttpDep = None,
    cache: CacheDep = None,
    limiter: LimiterDep = None,
):
    symbol_list = [s.strip() for s in symbols.split(",") if s.strip()]
    if not symbol_list:
        return {}

    # Check cache for each symbol individually
    results = {}
    uncached = []
    for sym in symbol_list:
        hit = await cache.get(sym, "yahoo", "quote")
        if hit is not None:
            results[sym] = hit
        else:
            uncached.append(sym)

    if not uncached:
        return results

    if not await limiter.consume("yahoo"):
        log.warning("yahoo rate-limited on batch quotes")
        return results

    await cache._redis.incr("metrics:source:yahoo:requests")
    fetcher = YahooFetcher(http)
    batch = await fetcher.quotes_batch(uncached)
    for sym, data in batch.items():
        results[sym] = data
        await cache.set(sym, "yahoo", "quote", data)

    return results
