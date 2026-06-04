"""PostgreSQL connection and price_history operations via SQLAlchemy async."""

import asyncio
import logging
from datetime import datetime
from typing import Any

from sqlalchemy import Column, DateTime, Float, Index, Integer, String, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from backend.config import get_settings

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


# DDL that creates the parent table with RANGE partitioning and two initial
# monthly partitions (current + next month). Partitions can be added via cron.
PARTITION_DDL = """
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
) PARTITION BY RANGE (timestamp);

CREATE INDEX IF NOT EXISTS idx_ph_ticker_ts ON price_history (ticker, timestamp DESC);
"""

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


async def init_db() -> None:
    """Create the partitioned table if it doesn't exist."""
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.execute(text(PARTITION_DDL))
        # Create partitions for current and next two months
        now = datetime.utcnow()
        for delta in range(3):
            year = now.year + (now.month + delta - 1) // 12
            month = (now.month + delta - 1) % 12 + 1
            next_month = month % 12 + 1
            next_year = year + (1 if month == 12 else 0)
            start = f"{year}-{month:02d}-01"
            end = f"{next_year}-{next_month:02d}-01"
            part_name = f"price_history_{year}_{month:02d}"
            await conn.execute(text(
                f"CREATE TABLE IF NOT EXISTS {part_name} "
                f"PARTITION OF price_history "
                f"FOR VALUES FROM ('{start}') TO ('{end}')"
            ))


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


def fire_and_forget_write(ticker: str, source: str, rows: list[dict[str, Any]]) -> None:
    """Schedule an async write without blocking the caller."""
    if not rows:
        return

    async def _write():
        try:
            factory = get_session_factory()
            async with factory() as session:
                await write_price_history(session, ticker, source, rows)
        except Exception:
            log.exception("Background price_history write failed for %s/%s", ticker, source)

    asyncio.ensure_future(_write())
