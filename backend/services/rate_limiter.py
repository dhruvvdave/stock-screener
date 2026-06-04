"""
Token bucket rate limiter backed by Redis.

Each API source gets its own bucket stored as two Redis keys:
  - ratelimit:{source}:tokens  — current token count (float string)
  - ratelimit:{source}:last    — Unix timestamp of last refill (float string)

The algorithm on every consume() call:
  1. Read current tokens and last-refill time.
  2. Compute elapsed = now - last.
  3. Refill: tokens = min(capacity, tokens + elapsed * refill_rate).
  4. If tokens >= 1: subtract 1, persist, return True (allowed).
  5. Else: persist updated time (so next call refills correctly), return False.

A Lua script executes steps 1-5 atomically, preventing race conditions
under concurrent async requests or multiple FastAPI workers.
"""

import time

import redis.asyncio as aioredis

from backend.config import get_settings

# Atomic Lua script: returns 1 if a token was consumed, 0 if bucket empty.
_LUA = """
local tk  = KEYS[1]
local tl  = KEYS[2]
local cap = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local now  = tonumber(ARGV[3])

local last   = tonumber(redis.call('get', tl) or now)
local tokens = tonumber(redis.call('get', tk) or cap)

local elapsed = now - last
if elapsed < 0 then elapsed = 0 end
tokens = tokens + elapsed * rate
if tokens > cap then tokens = cap end

if tokens >= 1.0 then
    tokens = tokens - 1.0
    redis.call('set', tk, tostring(tokens))
    redis.call('set', tl, tostring(now))
    return 1
else
    redis.call('set', tl, tostring(now))
    return 0
end
"""


class TokenBucketLimiter:
    def __init__(self, redis: aioredis.Redis) -> None:
        self._redis = redis
        self._settings = get_settings()
        self._script = redis.register_script(_LUA)

    async def consume(self, source: str) -> bool:
        """Try to consume one token for *source*. Returns True if allowed."""
        capacity, rate = self._settings.rate_params(source)
        tk = f"ratelimit:{source}:tokens"
        tl = f"ratelimit:{source}:last"
        now = time.time()
        result = await self._script(
            keys=[tk, tl],
            args=[str(capacity), str(rate), str(now)],
        )
        if not result:
            await self._redis.incr(f"metrics:source:{source}:rate_limit_hits")
        return bool(result)
