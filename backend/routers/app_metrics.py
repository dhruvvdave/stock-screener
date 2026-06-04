"""GET /metrics — system-level cache and rate-limit counters from Redis."""

from fastapi import APIRouter

from backend.deps import RedisDep
from backend.services.cache import ResponseCache

router = APIRouter()

_SOURCES = ["finnhub", "yahoo", "alphavantage", "fmp", "stooq", "twelvedata"]


@router.get("/metrics")
async def get_metrics(redis: RedisDep):
    cache = ResponseCache(redis)
    cache_stats = await cache.get_metrics()

    source_stats = {}
    keys = []
    for src in _SOURCES:
        keys.append(f"metrics:source:{src}:requests")
        keys.append(f"metrics:source:{src}:rate_limit_hits")

    values = await redis.mget(*keys)
    for i, src in enumerate(_SOURCES):
        reqs = int(values[i * 2] or 0)
        rl_hits = int(values[i * 2 + 1] or 0)
        source_stats[src] = {"requests": reqs, "rate_limit_hits": rl_hits}

    return {
        "cache": cache_stats,
        "sources": source_stats,
    }
