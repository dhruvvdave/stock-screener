"""FastAPI dependency providers for shared resources."""

from typing import Annotated

import httpx
import redis.asyncio as aioredis
from fastapi import Depends, Request

from backend.services.cache import ResponseCache
from backend.services.rate_limiter import TokenBucketLimiter


def get_redis(request: Request) -> aioredis.Redis:
    return request.app.state.redis


def get_http(request: Request) -> httpx.AsyncClient:
    return request.app.state.http


def get_cache(redis: Annotated[aioredis.Redis, Depends(get_redis)]) -> ResponseCache:
    return ResponseCache(redis)


def get_limiter(redis: Annotated[aioredis.Redis, Depends(get_redis)]) -> TokenBucketLimiter:
    return TokenBucketLimiter(redis)


RedisDep = Annotated[aioredis.Redis, Depends(get_redis)]
HttpDep = Annotated[httpx.AsyncClient, Depends(get_http)]
CacheDep = Annotated[ResponseCache, Depends(get_cache)]
LimiterDep = Annotated[TokenBucketLimiter, Depends(get_limiter)]
