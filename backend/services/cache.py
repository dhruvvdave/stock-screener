"""Redis caching layer for stock data responses."""

import json
from typing import Any

import redis.asyncio as aioredis

from backend.config import get_settings


class ResponseCache:
    def __init__(self, redis: aioredis.Redis) -> None:
        self._redis = redis
        self._settings = get_settings()

    def _key(self, ticker: str, source: str, resolution: str) -> str:
        return f"cache:{ticker.upper()}:{source}:{resolution}"

    async def get(self, ticker: str, source: str, resolution: str) -> Any | None:
        """Return cached value or None on miss. Updates hit/miss counters."""
        raw = await self._redis.get(self._key(ticker, source, resolution))
        if raw is not None:
            await self._redis.incr("metrics:cache:hits")
            return json.loads(raw)
        await self._redis.incr("metrics:cache:misses")
        return None

    async def set(self, ticker: str, source: str, resolution: str, value: Any) -> None:
        ttl = self._settings.ttl_for_resolution(resolution)
        await self._redis.setex(
            self._key(ticker, source, resolution),
            ttl,
            json.dumps(value, default=str),
        )

    async def get_metrics(self) -> dict:
        hits = int(await self._redis.get("metrics:cache:hits") or 0)
        misses = int(await self._redis.get("metrics:cache:misses") or 0)
        total = hits + misses
        return {
            "hits": hits,
            "misses": misses,
            "hit_rate": round(hits / total, 4) if total else 0.0,
            "miss_rate": round(misses / total, 4) if total else 0.0,
        }
