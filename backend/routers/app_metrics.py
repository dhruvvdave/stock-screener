"""GET /metrics — cache and rate-limit counters, and GET /health."""

from fastapi import APIRouter

from backend.deps import CacheDep, RedisDep

router = APIRouter()

SOURCES = ["finnhub", "yahoo", "alphavantage", "fmp", "stooq", "twelvedata"]


@router.get("/metrics")
async def get_metrics(redis: RedisDep, cache: CacheDep):
    keys = []
    for source in SOURCES:
        keys += [f"metrics:source:{source}:requests", f"metrics:source:{source}:rate_limit_hits"]

    values = await redis.mget(*keys)
    sources = {
        source: {
            "requests": int(values[i * 2] or 0),
            "rate_limit_hits": int(values[i * 2 + 1] or 0),
        }
        for i, source in enumerate(SOURCES)
    }
    return {"cache": await cache.get_metrics(), "sources": sources}
