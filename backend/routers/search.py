"""GET /api/search — ticker search via Finnhub."""

import re

from fastapi import APIRouter, Query

from backend.deps import CacheDep, HttpDep, LimiterDep
from backend.fetchers.finnhub import FinnhubFetcher

router = APIRouter()
_STRIP = re.compile(r"\.(V|TO|L|AX)$", re.IGNORECASE)


@router.get("/api/search")
async def search(
    q: str = Query(..., min_length=1),
    http: HttpDep = None,
    cache: CacheDep = None,
    limiter: LimiterDep = None,
):
    query = _STRIP.sub("", q.strip())
    cached = await cache.get(f"search:{query}", "finnhub", "search")
    if cached is not None:
        return cached

    if not await limiter.consume("finnhub"):
        return {"results": []}

    await cache._redis.incr("metrics:source:finnhub:requests")
    results = await FinnhubFetcher(http).search(query)
    payload = {"results": results}
    await cache.set(f"search:{query}", "finnhub", "search", payload)
    return payload
