"""PostgreSQL connection and price_history operations via SQLAlchemy async."""

import asyncio
import logging
from typing import Any

from sqlalchemy import Column, DateTime, Float, Integer, String, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from backend.config import get_settings
from backend.services.partitions import PartitionRunResult, ensure_partitions

log = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


class PriceHistory(Base):
    """
    Monthly-partitioned table for OHLCV price data.

    PostgreSQL range partitioning on `timestamp` is declared in the
    migration SQL below — SQLAlchemy only manages the parent table here.
    """

    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True)
    ticker = Column(String(20), nullable=False, index=True)
    source = Column(String(32), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float, nullable=False)
    volume = Column(Float)


# DDL for the parent table only. The monthly partitions underneath it are
# managed by services/partitions.py, which keeps a rolling window of them
# created ahead of need.
#
# One statement per entry, deliberately: asyncpg sends statements through the
# extended query protocol, which refuses more than one command per prepared
# statement ("cannot insert multiple commands into a prepared statement"). A
# single string holding both the CREATE TABLE and the CREATE INDEX therefore
# fails at runtime rather than at import, which is how the previous version of
# this file went unnoticed — the exception was caught at startup and logged as
# "Postgres unavailable".
PARENT_TABLE_DDL: tuple[str, ...] = (
    """
    CREATE TABLE IF NOT EXISTS price_history (
        id        SERIAL,
        ticker    VARCHAR(20)  NOT NULL,
        source    VARCHAR(32)  NOT NULL,
        timestamp TIMESTAMP    NOT NULL,
        open      DOUBLE PRECISION,
        high      DOUBLE PRECISION,
        low       DOUBLE PRECISION,
        close     DOUBLE PRECISION NOT NULL,
        volume    DOUBLE PRECISION,
        PRIMARY KEY (id, timestamp)
    ) PARTITION BY RANGE (timestamp)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_ph_ticker_ts
    ON price_history (ticker, timestamp DESC)
    """,
)

_engine = None
_session_factory: async_sessionmaker | None = None


def get_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(settings.postgres_dsn, pool_pre_ping=True)
    return _engine


def get_session_factory() -> async_sessionmaker:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _session_factory


async def create_parent_table() -> None:
    """Create the partitioned parent table and its index. Raises on failure."""
    engine = get_engine()
    async with engine.begin() as conn:
        for statement in PARENT_TABLE_DDL:
            await conn.execute(text(statement))


async def init_db() -> None:
    """
    Create the parent table and the current partition window.

    Raises on failure — the caller decides whether a database that cannot be
    initialised should stop the app from booting. The app itself does this in
    two steps (see main.py) so that the startup pass is recorded by the
    PartitionMaintainer and therefore visible on /metrics.
    """
    await create_parent_table()
    await ensure_partition_window()


async def ensure_partition_window() -> PartitionRunResult:
    """Run one partition maintenance pass against the configured window."""
    settings = get_settings()
    return await ensure_partitions(
        get_engine(),
        months_back=settings.partition_months_back,
        months_forward=settings.partition_months_forward,
    )


async def write_price_history(
    session: AsyncSession,
    ticker: str,
    source: str,
    rows: list[dict[str, Any]],
) -> None:
    """Insert OHLCV rows. Each row: {timestamp, open, high, low, close, volume}."""
    for row in rows:
        session.add(PriceHistory(
            ticker=ticker.upper(),
            source=source,
            timestamp=row["timestamp"],
            open=row.get("open"),
            high=row.get("high"),
            low=row.get("low"),
            close=row["close"],
            volume=row.get("volume"),
        ))
    await session.commit()


# Background writes cannot report failure to the HTTP caller — the response has
# already gone out. Counting them here is what makes a missing partition (or any
# other write error) visible on /metrics instead of only in the log.
_write_failures = 0
_writes_ok = 0


def write_stats() -> dict[str, int]:
    return {"ok": _writes_ok, "failed": _write_failures}


def fire_and_forget_write(ticker: str, source: str, rows: list[dict[str, Any]]) -> None:
    """Schedule an async write without blocking the caller."""
    if not rows:
        return

    async def _write():
        global _write_failures, _writes_ok
        try:
            factory = get_session_factory()
            async with factory() as session:
                await write_price_history(session, ticker, source, rows)
            _writes_ok += 1
        except Exception:
            _write_failures += 1
            log.exception("Background price_history write failed for %s/%s", ticker, source)

    asyncio.ensure_future(_write())
