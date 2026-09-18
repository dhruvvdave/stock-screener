"""Redis response cache for upstream stock data.

Keys are `cache:{TICKER}:{resource}`. The upstream that happened to answer is
deliberately *not* part of the key: `/api/stock` and `/api/candle` fall back
through several providers, so keying by source means the next request looks
under a different key than the one just written and misses every time. Which
source served a payload travels inside the payload instead.

Market data is read-only from our side, so expiry is the invalidation
strategy; `invalidate()` exists for the cases where a caller knows a value is
wrong before its TTL is up. TTLs are per-resource because a live quote and a
company profile go stale on completely different timescales.
"""

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Any

import redis.asyncio as aioredis

from backend.config import get_settings

log = logging.getLogger(__name__)

# Resource identifiers. Two endpoints that return different shapes for the
# same ticker must not share one, or they overwrite each other.
QUOTE = "quote"                  # /api/stock — single quote, Finnhub shape
LIST_QUOTE = "list-quote"        # /api/quotes — batch quote, Yahoo shape
NEWS = "news"
PROFILE = "profile"
SEARCH = "search"
FUNDAMENTALS = "fundamentals"
STOCK_METRICS = "stock-metrics"
ANALYST = "analyst"
ENRICH = "enrich"


def candle(range_: str) -> str:
    return f"candle:{range_}"


# How long a single-flight leader holds the lock, and how long a follower
# waits for the leader's value before giving up and fetching for itself.
_LOCK_TTL_SECONDS = 15
_FOLLOWER_TIMEOUT_SECONDS = 3.0
_FOLLOWER_POLL_SECONDS = 0.05


class ResponseCache:
    def __init__(self, redis: aioredis.Redis) -> None:
        self._redis = redis
        self._settings = get_settings()

    def key(self, ticker: str, resource: str) -> str:
        return f"cache:{ticker.upper()}:{resource}"

    async def get(self, ticker: str, resource: str) -> Any | None:
        """Return the cached value, or None on a miss. Records a hit/miss."""
        raw = await self._redis.get(self.key(ticker, resource))
        if raw is None:
            await self._redis.incr("metrics:cache:misses")
            return None
        await self._redis.incr("metrics:cache:hits")
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            # A corrupt entry should behave like a miss, not a 500.
            log.warning("Discarding unparseable cache entry %s", self.key(ticker, resource))
            await self._redis.delete(self.key(ticker, resource))
            return None

    async def set(self, ticker: str, resource: str, value: Any) -> None:
        await self._redis.setex(
            self.key(ticker, resource),
            self._settings.ttl_for(resource),
            json.dumps(value, default=str),
        )

    async def invalidate(self, ticker: str, resource: str | None = None) -> int:
        """Drop one resource for a ticker, or everything held for it."""
        if resource is not None:
            return await self._redis.delete(self.key(ticker, resource))
        keys = [k async for k in self._redis.scan_iter(match=f"cache:{ticker.upper()}:*")]
        return await self._redis.delete(*keys) if keys else 0

    async def get_or_set(
        self,
        ticker: str,
        resource: str,
        producer: Callable[[], Awaitable[Any]],
        *,
        should_cache: Callable[[Any], bool] = lambda v: v is not None,
    ) -> Any:
        """Serve from cache, or call *producer* once and cache what it returns.

        Concurrent misses for the same key collapse onto a single producer
        call: without this, a popular ticker expiring sends one upstream
        request per in-flight client and burns the rate-limit budget in a
        burst. Followers wait briefly for the leader's value and fall back to
        producing for themselves rather than failing or blocking forever.
        """
        hit = await self.get(ticker, resource)
        if hit is not None:
            return hit

        async with self._single_flight(ticker, resource) as is_leader:
            if not is_leader:
                filled = await self._wait_for_fill(ticker, resource)
                if filled is not None:
                    return filled

            value = await producer()
            if should_cache(value):
                await self.set(ticker, resource, value)
            return value

    @asynccontextmanager
    async def _single_flight(self, ticker: str, resource: str):
        lock_key = f"lock:{self.key(ticker, resource)}"
        acquired = False
        try:
            acquired = bool(
                await self._redis.set(lock_key, "1", nx=True, ex=_LOCK_TTL_SECONDS)
            )
            yield acquired
        finally:
            if acquired:
                await self._redis.delete(lock_key)

    async def _wait_for_fill(self, ticker: str, resource: str) -> Any | None:
        """Poll for the leader's value. None means it never arrived."""
        deadline = asyncio.get_running_loop().time() + _FOLLOWER_TIMEOUT_SECONDS
        while asyncio.get_running_loop().time() < deadline:
            await asyncio.sleep(_FOLLOWER_POLL_SECONDS)
            raw = await self._redis.get(self.key(ticker, resource))
            if raw is not None:
                try:
                    return json.loads(raw)
                except json.JSONDecodeError:
                    return None
        return None

    async def incr_source(self, source: str) -> None:
        """Count an outbound request to *source* for the /metrics endpoint."""
        await self._redis.incr(f"metrics:source:{source}:requests")

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
