"""GET /metrics — system-level cache and rate-limit counters from Redis."""

from fastapi import APIRouter, Request

from backend.deps import RedisDep
from backend.services.cache import ResponseCache
from backend.services.db import write_stats

router = APIRouter()

_SOURCES = ["finnhub", "yahoo", "alphavantage", "fmp", "stooq", "twelvedata"]


@router.get("/metrics")
async def get_metrics(request: Request, redis: RedisDep):
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

    # Partition maintenance and background write counters are per-process
    # (in-memory), unlike the Redis-backed counters above. With more than one
    # worker you are reading whichever one served the request.
    maintainer = getattr(request.app.state, "partitions", None)

    return {
        "cache": cache_stats,
        "sources": source_stats,
        "partitions": maintainer.status() if maintainer else None,
        "history_writes": write_stats(),
    }
