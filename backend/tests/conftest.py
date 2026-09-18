import os

import pytest
import pytest_asyncio

# Settings are read at import time via lru_cache, so pin the test environment
# before anything under backend/ is imported.
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")
os.environ.setdefault("FINNHUB_KEY", "test-key")


@pytest_asyncio.fixture
async def redis():
    """An isolated in-memory Redis, including Lua script support."""
    import fakeredis.aioredis

    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    await client.flushall()
    yield client
    await client.aclose()


@pytest.fixture
def settings():
    from backend.config import get_settings

    get_settings.cache_clear()
    yield get_settings()
    get_settings.cache_clear()
