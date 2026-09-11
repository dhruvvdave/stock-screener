"""
Shared fixtures. The database-backed tests need a real PostgreSQL: declarative
partitioning is a Postgres feature, so there is nothing meaningful to assert
against SQLite or a mock. They are skipped unless MARKR_TEST_DSN points at a
throwaway database.

    createdb markr_test
    export MARKR_TEST_DSN=postgresql+asyncpg://markr@127.0.0.1:5432/markr_test
    pytest

docker-compose already runs a suitable server; point the DSN at a *separate*
database on it, because these tests drop and recreate price_history.
"""

import os

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

TEST_DSN = os.environ.get("MARKR_TEST_DSN")

requires_postgres = pytest.mark.skipif(
    not TEST_DSN,
    reason="set MARKR_TEST_DSN to a throwaway Postgres database to run these",
)


@pytest_asyncio.fixture
async def engine():
    """A fresh engine with price_history dropped, so each test starts clean."""
    eng = create_async_engine(TEST_DSN, pool_pre_ping=True)
    async with eng.begin() as conn:
        # DROP on the parent cascades to every partition under it.
        await conn.execute(text("DROP TABLE IF EXISTS price_history CASCADE"))
    try:
        yield eng
    finally:
        async with eng.begin() as conn:
            await conn.execute(text("DROP TABLE IF EXISTS price_history CASCADE"))
        await eng.dispose()


@pytest_asyncio.fixture
async def parent_table(engine):
    """price_history's parent table, with no partitions underneath it yet."""
    from backend.services.db import PARENT_TABLE_DDL

    async with engine.begin() as conn:
        for statement in PARENT_TABLE_DDL:
            await conn.execute(text(statement))
    return engine


async def partition_names(engine) -> list[str]:
    """Every partition currently attached to price_history, in name order."""
    async with engine.connect() as conn:
        rows = await conn.execute(text(
            """
            SELECT c.relname
            FROM pg_inherits i
            JOIN pg_class c  ON c.oid = i.inhrelid
            JOIN pg_class p  ON p.oid = i.inhparent
            WHERE p.relname = 'price_history'
            ORDER BY c.relname
            """
        ))
        return [r[0] for r in rows]


# ── Doubles for the symbol-resolution tests ──────────────────────────────────
#
# These need Redis and Finnhub, neither of which is worth standing up for what
# is really cache bookkeeping and JSON parsing. Postgres got a real server
# because partitioning cannot be faked; these can.


class FakeRedis:
    """The handful of Redis operations SymbolResolver actually uses."""

    def __init__(self, fail: bool = False):
        self.store: dict[str, str] = {}
        self.ttls: dict[str, int] = {}
        self.fail = fail          # simulate Redis being down
        self.get_calls = 0
        self.setex_calls = 0

    async def get(self, key):
        if self.fail:
            raise ConnectionError("redis down")
        self.get_calls += 1
        return self.store.get(key)

    async def setex(self, key, ttl, value):
        if self.fail:
            raise ConnectionError("redis down")
        self.setex_calls += 1
        self.store[key] = value
        self.ttls[key] = ttl

    async def incr(self, key):
        if self.fail:
            raise ConnectionError("redis down")
        self.store[key] = str(int(self.store.get(key, 0)) + 1)


class FakeResponse:
    def __init__(self, payload, ok=True):
        self._payload = payload
        self.is_success = ok

    def json(self):
        return self._payload


class FakeHttp:
    """Stands in for httpx.AsyncClient, recording what was requested."""

    def __init__(self, payload=None, ok=True):
        self.payload = payload if payload is not None else {"result": []}
        self.ok = ok
        self.calls = 0

    async def get(self, url, **kwargs):
        self.calls += 1
        return FakeResponse(self.payload, self.ok)


class FakeLimiter:
    """Token bucket stand-in: allows *allow* calls, then denies."""

    def __init__(self, allow=True):
        self.allow = allow
        self.calls = 0

    async def consume(self, source):
        self.calls += 1
        return self.allow


def finnhub_search_payload(*listings):
    """Build a Finnhub /search body from (symbol, description, displaySymbol)."""
    return {
        "result": [
            {
                "symbol": symbol,
                "displaySymbol": display,
                "description": description,
                "type": "Common Stock",
            }
            for symbol, description, display in listings
        ]
    }


@pytest.fixture(autouse=True)
def finnhub_key(monkeypatch):
    """FinnhubFetcher no-ops without a key; give every test one."""
    from backend.config import get_settings

    monkeypatch.setenv("FINNHUB_KEY", "test-key")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
