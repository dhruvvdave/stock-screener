"""PostgreSQL price_history storage: partitioning, upserts, background writes."""

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    Column, DateTime, Float, Integer, PrimaryKeyConstraint, String, text,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from backend.config import get_settings

log = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


class PriceHistory(Base):
    """OHLCV bars, range-partitioned by month on `timestamp`.

    The table itself is created by PARTITION_DDL below because SQLAlchemy
    cannot express PARTITION BY; this model exists so queries and inserts are
    typed. A partition key must appear in every unique constraint, hence
    (ticker, source, timestamp) rather than a bare surrogate id.
    """

    __tablename__ = "price_history"
    __table_args__ = (
        PrimaryKeyConstraint("ticker", "source", "timestamp", name="pk_price_history"),
    )

    ticker = Column(String(20), nullable=False)
    source = Column(String(32), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float, nullable=False)
    volume = Column(Float)
    id = Column(Integer)  # informational only; uniqueness comes from the PK


# Re-fetching a chart re-sends bars we already hold, so the primary key is the
# natural key and writes upsert onto it. Without that, every chart view
# appended another full copy of the ticker's history.
# asyncpg sends statements through the extended query protocol, which takes
# exactly one command per call, so these stay separate rather than living in
# one semicolon-joined blob. Joined, the CREATE TABLE raised every time and
# the startup handler logged it as "Postgres unavailable" — the table was
# never created and every history write failed silently.
PARTITION_DDL = (
    """
    CREATE TABLE IF NOT EXISTS price_history (
        ticker    VARCHAR(20)      NOT NULL,
        source    VARCHAR(32)      NOT NULL,
        timestamp TIMESTAMP        NOT NULL,
        open      DOUBLE PRECISION,
        high      DOUBLE PRECISION,
        low       DOUBLE PRECISION,
        close     DOUBLE PRECISION NOT NULL,
        volume    DOUBLE PRECISION,
        PRIMARY KEY (ticker, source, timestamp)
    ) PARTITION BY RANGE (timestamp)
    """,
    "CREATE INDEX IF NOT EXISTS idx_ph_ticker_ts ON price_history (ticker, timestamp DESC)",
)

_engine = None
_session_factory: async_sessionmaker | None = None

# asyncio.ensure_future only holds a weak reference, so a task nobody keeps
# can be collected mid-write. Keeping the set is what makes these writes
# actually reach Postgres.
_background_tasks: set[asyncio.Task] = set()

# Partitions already ensured this process, so a hot ticker does not issue a
# CREATE TABLE IF NOT EXISTS on every single write.
_known_partitions: set[str] = set()


def get_engine():
    global _engine
    if _engine is None:
        _engine = create_async_engine(get_settings().postgres_dsn, pool_pre_ping=True)
    return _engine


def get_session_factory() -> async_sessionmaker:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _session_factory


def _partition_bounds(moment: datetime) -> tuple[str, str, str]:
    """(name, inclusive start, exclusive end) for the month containing *moment*."""
    year, month = moment.year, moment.month
    next_year, next_month = (year + 1, 1) if month == 12 else (year, month + 1)
    return (
        f"price_history_{year}_{month:02d}",
        f"{year}-{month:02d}-01",
        f"{next_year}-{next_month:02d}-01",
    )


def _months_from(start: datetime, count: int) -> list[datetime]:
    months = []
    year, month = start.year, start.month
    for _ in range(count):
        months.append(datetime(year, month, 1))  # noqa: DTZ001 — naive, matches the column
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return months


async def _create_partition(conn, moment: datetime) -> None:
    name, start, end = _partition_bounds(moment)
    if name in _known_partitions:
        return
    # Identifiers here are built from integers we computed, never from input.
    await conn.execute(text(
        f"CREATE TABLE IF NOT EXISTS {name} PARTITION OF price_history "
        f"FOR VALUES FROM ('{start}') TO ('{end}')"
    ))
    _known_partitions.add(name)


async def init_db() -> None:
    """Create the partitioned table and a rolling window of partitions."""
    settings = get_settings()
    async with get_engine().begin() as conn:
        for statement in PARTITION_DDL:
            await conn.execute(text(statement))
        for moment in _months_from(datetime.now(UTC), settings.partition_months_ahead):
            await _create_partition(conn, moment)


async def ensure_partitions_for(conn, timestamps: list[datetime]) -> None:
    """Make sure every month covered by *timestamps* has a partition.

    Inserting into a range-partitioned table with no matching partition raises
    outright, so a backfill that reaches past the pre-created window — or an
    instance left running longer than that window — would otherwise start
    failing. Creating on demand keeps this self-contained: no cron, no
    external scheduler.
    """
    for moment in {datetime(ts.year, ts.month, 1) for ts in timestamps}:  # noqa: DTZ001
        await _create_partition(conn, moment)


async def write_price_history(
    session: AsyncSession,
    ticker: str,
    source: str,
    rows: list[dict[str, Any]],
) -> int:
    """Upsert OHLCV rows. Returns the number submitted."""
    if not rows:
        return 0

    payload = [
        {
            "ticker": ticker.upper(),
            "source": source,
            "timestamp": row["timestamp"],
            "open": row.get("open"),
            "high": row.get("high"),
            "low": row.get("low"),
            "close": row["close"],
            "volume": row.get("volume"),
        }
        for row in rows
        if row.get("timestamp") is not None and row.get("close") is not None
    ]
    if not payload:
        return 0

    await ensure_partitions_for(session, [r["timestamp"] for r in payload])

    # A later fetch of the same bar should correct it, not duplicate it.
    statement = pg_insert(PriceHistory).values(payload)
    await session.execute(statement.on_conflict_do_update(
        index_elements=["ticker", "source", "timestamp"],
        set_={
            "open": statement.excluded.open,
            "high": statement.excluded.high,
            "low": statement.excluded.low,
            "close": statement.excluded.close,
            "volume": statement.excluded.volume,
        },
    ))
    await session.commit()
    return len(payload)


def queue_price_history_write(ticker: str, source: str, rows: list[dict[str, Any]]) -> None:
    """Persist rows in the background without delaying the response."""
    if not rows:
        return

    async def _write():
        try:
            async with get_session_factory()() as session:
                await write_price_history(session, ticker, source, rows)
        except Exception:
            log.exception("price_history write failed for %s/%s", ticker, source)

    try:
        task = asyncio.get_running_loop().create_task(_write())
    except RuntimeError:
        log.debug("No running loop; dropping price_history write for %s", ticker)
        return
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


async def drain_background_writes(timeout: float = 5.0) -> None:
    """Let in-flight writes finish during shutdown."""
    if not _background_tasks:
        return
    done, pending = await asyncio.wait(set(_background_tasks), timeout=timeout)
    if pending:
        log.warning("Abandoned %d price_history write(s) at shutdown", len(pending))
