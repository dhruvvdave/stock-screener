"""price_history tests against a real PostgreSQL instance.

Partitioning, ON CONFLICT and partition pruning are all server-side
behaviour, so these need a live database and are skipped without one. Point
MARKR_TEST_DSN at a scratch database to run them:

    MARKR_TEST_DSN=postgresql+asyncpg://markr@127.0.0.1:5432/markr_test pytest
"""

import os
from datetime import datetime

import pytest
import pytest_asyncio
from sqlalchemy import text

TEST_DSN = os.environ.get("MARKR_TEST_DSN")
pytestmark = pytest.mark.skipif(not TEST_DSN, reason="MARKR_TEST_DSN is not set")


def bars(dates, close=100.0):
    return [
        {"timestamp": datetime.fromisoformat(d), "open": 1.0, "high": 2.0,
         "low": 0.5, "close": close, "volume": 10.0}
        for d in dates
    ]


async def partitions(engine) -> list[str]:
    async with engine.connect() as conn:
        rows = await conn.execute(text(
            "SELECT c.relname FROM pg_inherits i "
            "JOIN pg_class c ON c.oid = i.inhrelid "
            "JOIN pg_class p ON p.oid = i.inhparent "
            "WHERE p.relname = 'price_history' ORDER BY c.relname"
        ))
        return [r[0] for r in rows.all()]


async def count(engine, ticker: str) -> int:
    async with engine.connect() as conn:
        return (await conn.execute(
            text("SELECT count(*) FROM price_history WHERE ticker = :t"), {"t": ticker}
        )).scalar()


@pytest_asyncio.fixture
async def db(monkeypatch):
    monkeypatch.setenv("POSTGRES_DSN", TEST_DSN)

    from backend.config import get_settings
    get_settings.cache_clear()

    from backend.services import db as db_mod

    db_mod._engine = None
    db_mod._session_factory = None
    db_mod._known_partitions.clear()

    engine = db_mod.get_engine()
    async with engine.begin() as conn:
        await conn.execute(text("DROP TABLE IF EXISTS price_history CASCADE"))
    await db_mod.init_db()

    yield db_mod

    await engine.dispose()
    db_mod._engine = None
    db_mod._session_factory = None
    get_settings.cache_clear()


async def test_init_db_creates_a_partitioned_table(db):
    """Regression: the DDL used to be one semicolon-joined string, which
    asyncpg rejects outright. The startup handler swallowed the error and
    reported 'Postgres unavailable', so the table was never created."""
    async with db.get_engine().connect() as conn:
        relkind = (await conn.execute(text(
            "SELECT relkind FROM pg_class WHERE relname = 'price_history'"
        ))).scalar()
    if isinstance(relkind, bytes):
        relkind = relkind.decode()
    assert relkind == "p", "price_history is not partitioned"


async def test_init_db_creates_a_rolling_window_of_partitions(db, settings):
    assert len(await partitions(db.get_engine())) == settings.partition_months_ahead


async def test_init_db_is_idempotent(db):
    before = await partitions(db.get_engine())
    await db.init_db()
    assert await partitions(db.get_engine()) == before


async def test_refetching_the_same_bars_does_not_duplicate_rows(db):
    """Regression: every chart view appended another full copy of the
    ticker's history because nothing constrained (ticker, source, timestamp)."""
    rows = bars(["2026-09-01", "2026-09-02", "2026-09-03"])
    for _ in range(3):
        async with db.get_session_factory()() as session:
            await db.write_price_history(session, "AAPL", "yahoo", rows)
    assert await count(db.get_engine(), "AAPL") == 3


async def test_a_revised_bar_updates_in_place(db):
    async with db.get_session_factory()() as session:
        await db.write_price_history(session, "AAPL", "yahoo", bars(["2026-09-02"]))
    async with db.get_session_factory()() as session:
        await db.write_price_history(session, "AAPL", "yahoo", bars(["2026-09-02"], close=999.0))

    async with db.get_engine().connect() as conn:
        close = (await conn.execute(text(
            "SELECT close FROM price_history WHERE ticker='AAPL' AND timestamp='2026-09-02'"
        ))).scalar()
    assert close == 999.0
    assert await count(db.get_engine(), "AAPL") == 1


async def test_the_same_bar_from_two_sources_is_kept_separately(db):
    async with db.get_session_factory()() as session:
        await db.write_price_history(session, "AAPL", "yahoo", bars(["2026-09-02"], close=100.0))
        await db.write_price_history(session, "AAPL", "finnhub", bars(["2026-09-02"], close=101.0))
    assert await count(db.get_engine(), "AAPL") == 2


async def test_a_write_past_the_window_creates_its_own_partition(db):
    """Inserting into a range-partitioned table with no matching partition
    raises, so without this the writes would start failing a few months in."""
    async with db.get_session_factory()() as session:
        await db.write_price_history(session, "MSFT", "stooq", bars(["2027-07-15", "2028-01-02"]))

    names = await partitions(db.get_engine())
    assert "price_history_2027_07" in names
    assert "price_history_2028_01" in names
    assert await count(db.get_engine(), "MSFT") == 2


async def test_a_december_write_rolls_into_the_next_year(db):
    async with db.get_session_factory()() as session:
        await db.write_price_history(session, "NVDA", "yahoo", bars(["2027-12-31"]))
    assert "price_history_2027_12" in await partitions(db.get_engine())
    assert await count(db.get_engine(), "NVDA") == 1


async def test_rows_without_a_close_are_skipped(db):
    rows = bars(["2026-09-01", "2026-09-02"])
    rows[0]["close"] = None
    async with db.get_session_factory()() as session:
        written = await db.write_price_history(session, "AAPL", "yahoo", rows)
    assert written == 1
    assert await count(db.get_engine(), "AAPL") == 1


async def test_an_empty_write_is_a_no_op(db):
    async with db.get_session_factory()() as session:
        assert await db.write_price_history(session, "AAPL", "yahoo", []) == 0


async def test_range_queries_prune_partitions(db):
    async with db.get_session_factory()() as session:
        await db.write_price_history(session, "MSFT", "stooq", bars(["2027-07-15", "2028-01-02"]))

    async with db.get_engine().connect() as conn:
        plan = "\n".join(r[0] for r in (await conn.execute(text(
            "EXPLAIN SELECT * FROM price_history WHERE ticker = 'MSFT' "
            "AND timestamp >= '2027-07-01' AND timestamp < '2027-08-01' ORDER BY timestamp"
        ))).all())

    assert "price_history_2027_07" in plan
    assert "price_history_2028_01" not in plan, "unrelated partitions were scanned"
    assert "Index Scan" in plan, f"the (ticker, timestamp) index went unused:\n{plan}"


async def test_queued_writes_complete(db):
    """Regression: asyncio.ensure_future keeps only a weak reference, so a
    write could be collected before it reached the database."""
    db.queue_price_history_write("TSLA", "yahoo", bars(["2026-09-04", "2026-09-05"]))
    await db.drain_background_writes()
    assert await count(db.get_engine(), "TSLA") == 2


async def test_a_queued_write_failure_does_not_escape(db):
    db.queue_price_history_write("TSLA", "yahoo", [{"timestamp": "not-a-date", "close": 1.0}])
    await db.drain_background_writes()   # must not raise
    assert await count(db.get_engine(), "TSLA") == 0


async def test_rows_can_be_read_back_through_the_orm(db):
    """The /history endpoint selects the mapped model, so every mapped column
    must exist in the table the DDL creates. A column on the model that the
    DDL does not create only fails here, on read."""
    from sqlalchemy import select

    from backend.services.db import PriceHistory

    async with db.get_session_factory()() as session:
        await db.write_price_history(session, "AAPL", "yahoo", bars(["2026-09-01"]))

    async with db.get_session_factory()() as session:
        rows = (await session.execute(
            select(PriceHistory).where(PriceHistory.ticker == "AAPL")
        )).scalars().all()

    assert len(rows) == 1
    assert rows[0].close == 100.0
    assert rows[0].source == "yahoo"


async def test_an_empty_table_reads_back_as_an_empty_list(db):
    from sqlalchemy import select

    from backend.services.db import PriceHistory

    async with db.get_session_factory()() as session:
        rows = (await session.execute(
            select(PriceHistory).where(PriceHistory.ticker == "NOTHING")
        )).scalars().all()
    assert rows == []
