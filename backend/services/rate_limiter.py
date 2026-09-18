"""
Token bucket rate limiter backed by Redis.

Each API source gets its own bucket stored as two Redis keys:
  - ratelimit:{source}:tokens  — current token count (float string)
  - ratelimit:{source}:last    — Unix timestamp of the last refill (float)

consume() refills the bucket for the time elapsed since the last call, then
takes a token if one is available. Both the refilled token count and the new
timestamp are written back on every call, whether or not a token was granted:
writing the timestamp alone would restart the refill clock while discarding
the tokens it had earned, so a client that retried while empty would reset
its own progress on each attempt and never recover.

A Lua script runs the whole read-refill-write sequence atomically, so
concurrent callers never oversubscribe the bucket, whether they are async
tasks in one process or separate uvicorn workers.
"""

import time

import redis.asyncio as aioredis

from backend.config import get_settings

# Idle buckets expire so sources that stop being used do not accumulate keys
# forever. The window is generous enough to outlive a full refill from empty.
_IDLE_EXPIRY_SECONDS = 3600

# Returns 1 if a token was consumed, 0 if the bucket was empty.
_CONSUME_LUA = """
local tokens_key = KEYS[1]
local last_key   = KEYS[2]
local capacity   = tonumber(ARGV[1])
local rate       = tonumber(ARGV[2])
local now        = tonumber(ARGV[3])
local ttl        = tonumber(ARGV[4])

local last   = tonumber(redis.call('get', last_key)) or now
local tokens = tonumber(redis.call('get', tokens_key)) or capacity

local elapsed = now - last
if elapsed < 0 then elapsed = 0 end

tokens = tokens + elapsed * rate
if tokens > capacity then tokens = capacity end

local granted = 0
if tokens >= 1.0 then
    tokens = tokens - 1.0
    granted = 1
end

-- Persist the refilled balance on both paths. Storing only the timestamp
-- would throw away the tokens accrued since the previous call.
redis.call('set', tokens_key, tostring(tokens), 'EX', ttl)
redis.call('set', last_key, tostring(now), 'EX', ttl)
return granted
"""

# Seconds until the bucket next holds a whole token; 0 if one is ready now.
_RETRY_AFTER_LUA = """
local tokens_key = KEYS[1]
local last_key   = KEYS[2]
local capacity   = tonumber(ARGV[1])
local rate       = tonumber(ARGV[2])
local now        = tonumber(ARGV[3])

local last   = tonumber(redis.call('get', last_key)) or now
local tokens = tonumber(redis.call('get', tokens_key)) or capacity

local elapsed = now - last
if elapsed < 0 then elapsed = 0 end

tokens = tokens + elapsed * rate
if tokens > capacity then tokens = capacity end
if tokens >= 1.0 then return '0' end
if rate <= 0 then return '-1' end
return tostring((1.0 - tokens) / rate)
"""


class TokenBucketLimiter:
    def __init__(self, redis: aioredis.Redis) -> None:
        self._redis = redis
        self._settings = get_settings()
        self._consume = redis.register_script(_CONSUME_LUA)
        self._retry_after = redis.register_script(_RETRY_AFTER_LUA)

    @staticmethod
    def _keys(source: str) -> list[str]:
        return [f"ratelimit:{source}:tokens", f"ratelimit:{source}:last"]

    async def consume(self, source: str) -> bool:
        """Take one token for *source*. True if the request may proceed."""
        capacity, rate = self._settings.rate_params(source)
        granted = await self._consume(
            keys=self._keys(source),
            args=[str(capacity), str(rate), str(time.time()), str(_IDLE_EXPIRY_SECONDS)],
        )
        if not granted:
            await self._redis.incr(f"metrics:source:{source}:rate_limit_hits")
        return bool(granted)

    async def retry_after(self, source: str) -> float:
        """Seconds until *source* has a token again. 0.0 if one is ready.

        Read-only: it inspects the bucket without consuming or refilling, so
        calling it to build a 429 response does not disturb the bucket.
        """
        capacity, rate = self._settings.rate_params(source)
        seconds = float(await self._retry_after(
            keys=self._keys(source),
            args=[str(capacity), str(rate), str(time.time())],
        ))
        return max(seconds, 0.0)
