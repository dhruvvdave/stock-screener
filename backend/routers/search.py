"""GET /api/search — ticker search via Finnhub."""

import re
from typing import Annotated

from fastapi import APIRouter, Query

from backend.deps import CacheDep, HttpDep, LimiterDep
from backend.fetchers.finnhub import FinnhubFetcher
from backend.services import cache as cache_res
from backend.validation import rate_limited

router = APIRouter()

# Finnhub's search does not understand venue suffixes, so drop them.
_VENUE_SUFFIX = re.compile(r"\.(V|TO|L|AX)$", re.IGNORECASE)

SearchQuery = Annotated[str, Query(min_length=1, max_length=64, description="Search text")]


@router.get("/api/search")
async def search(q: SearchQuery, http: HttpDep, cache: CacheDep, limiter: LimiterDep):
    query = _VENUE_SUFFIX.sub("", q.strip())
    if not query:
        return {"results": []}

    limited = False

    async def fetch():
        nonlocal limited
        if not await limiter.consume("finnhub"):
            limited = True
            return None
        await cache.incr_source("finnhub")
        return {"results": await FinnhubFetcher(http).search(query)}

    # Searches are keyed by text rather than by ticker; the prefix keeps them
    # out of the per-ticker namespace.
    result = await cache.get_or_set(f"search:{query.upper()}", cache_res.SEARCH, fetch)
    if result is not None:
        return result
    if limited:
        raise rate_limited("finnhub", await limiter.retry_after("finnhub"))
    return {"results": []}
