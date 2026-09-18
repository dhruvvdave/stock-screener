"""GET /api/quotes — batch quotes from Yahoo Finance."""

import logging
from typing import Annotated

from fastapi import APIRouter, Query

from backend.deps import CacheDep, HttpDep, LimiterDep
from backend.fetchers.yahoo import YahooFetcher
from backend.services import cache as cache_res
from backend.validation import rate_limited

log = logging.getLogger(__name__)
router = APIRouter()

# One upstream call covers the whole batch, so the cap is about bounding the
# work per request rather than the rate limit.
MAX_SYMBOLS = 100

SymbolList = Annotated[
    str, Query(min_length=1, max_length=2000, description="Comma-separated ticker list")
]


@router.get("/api/quotes")
async def get_quotes(symbols: SymbolList, http: HttpDep, cache: CacheDep, limiter: LimiterDep):
    requested = _parse(symbols)
    if not requested:
        return {}

    results = {}
    missing = []
    for symbol in requested:
        hit = await cache.get(symbol, cache_res.LIST_QUOTE)
        if hit is not None:
            results[symbol] = hit
        else:
            missing.append(symbol)

    if not missing:
        return results

    if not await limiter.consume("yahoo"):
        # Partial data beats none, but an empty batch means the client should
        # back off rather than retry immediately.
        if results:
            log.warning("yahoo rate-limited; serving %d cached of %d", len(results), len(requested))
            return results
        raise rate_limited("yahoo", await limiter.retry_after("yahoo"))

    await cache.incr_source("yahoo")
    batch = await YahooFetcher(http).quotes_batch(missing)
    for symbol, data in batch.items():
        results[symbol] = data
        await cache.set(symbol, cache_res.LIST_QUOTE, data)

    return results


def _parse(symbols: str) -> list[str]:
    seen, out = set(), []
    for raw in symbols.split(","):
        symbol = raw.strip().upper()
        if symbol and symbol not in seen:
            seen.add(symbol)
            out.append(symbol)
        if len(out) >= MAX_SYMBOLS:
            break
    return out
