"""
Rolling monthly partition maintenance for the price_history table.

price_history is RANGE-partitioned on `timestamp`, one partition per calendar
month. Postgres does not create partitions on demand: an INSERT whose timestamp
falls outside every declared partition fails with "no partition of relation
... found for row". Because history writes are fire-and-forget background tasks
(see services/db.py), that failure never reaches the HTTP response — the request
returns 200 and the rows are simply lost. So partitions have to exist *before*
anything writes to them.

This module keeps a rolling window of partitions ahead of and behind the current
month, and is safe to run repeatedly:

  * `partition_window()` is pure — it turns a date plus a window size into the
    list of partitions that ought to exist. Testable without a database.
  * `ensure_partitions()` creates whatever is missing, one transaction per
    partition, and reports exactly what it did.
  * `PartitionMaintainer` runs `ensure_partitions()` at startup and then on an
    interval, so a process that outlives its forward window does not drift past
    its last partition.

Concurrency: every replica runs the same maintenance pass, and two backends
issuing CREATE TABLE for the same partition at the same moment can collide. A
session-level Postgres advisory lock serialises the pass across replicas; a
replica that cannot take the lock skips the run, because whoever holds it is
creating the identical window.

The window is what this module *creates*. It never drops or detaches anything —
a partition that ages out of the window is left in place, since dropping it
would silently delete price history. Retention is a separate decision.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timezone

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine

log = logging.getLogger(__name__)

# Arbitrary but fixed key identifying this maintenance pass. Every replica must
# use the same value, so it is a literal rather than hash() (which is salted
# per-process and would differ between backends).
ADVISORY_LOCK_KEY = 4_073_119_001

# Postgres SQLSTATE for "relation already exists" — raised when another session
# wins the race between our existence check and our CREATE TABLE.
_DUPLICATE_TABLE = "42P07"


@dataclass(frozen=True)
class Partition:
    """One monthly partition: its name and its half-open [start, end) bounds."""

    name: str
    start: date
    end: date

    @property
    def ddl(self) -> str:
        # Partition bounds cannot be bind parameters, so they are interpolated.
        # Both the name and the dates are derived from integers computed here —
        # no caller-supplied text reaches this string.
        return (
            f"CREATE TABLE IF NOT EXISTS {self.name} PARTITION OF price_history "
            f"FOR VALUES FROM ('{self.start.isoformat()}') TO ('{self.end.isoformat()}')"
        )


@dataclass
class PartitionRunResult:
    """What a single maintenance pass did. Returned so callers can log or assert."""

    window_start: date
    window_end: date
    created: list[str] = field(default_factory=list)
    existing: list[str] = field(default_factory=list)
    failed: dict[str, str] = field(default_factory=dict)
    skipped: bool = False

    @property
    def ok(self) -> bool:
        return not self.failed

    def summary(self) -> str:
        if self.skipped:
            return "skipped (another replica holds the maintenance lock)"
        return (
            f"window {self.window_start}..{self.window_end}: "
            f"{len(self.created)} created, {len(self.existing)} already present, "
            f"{len(self.failed)} failed"
        )


def add_months(d: date, months: int) -> date:
    """Shift *d* by *months*, normalised to the first of the resulting month."""
    total = (d.year * 12 + d.month - 1) + months
    return date(total // 12, total % 12 + 1, 1)


def month_start(d: date) -> date:
    return date(d.year, d.month, 1)


def partition_name(d: date) -> str:
    return f"price_history_{d.year}_{d.month:02d}"


def partition_window(today: date, months_back: int, months_forward: int) -> list[Partition]:
    """
    The partitions that should exist for a window around *today*.

    Includes the current month, so the window is months_back + months_forward + 1
    partitions long. Negative inputs are clamped to zero rather than producing an
    inverted window.
    """
    months_back = max(0, months_back)
    months_forward = max(0, months_forward)
    first = add_months(month_start(today), -months_back)
    return [
        Partition(name=partition_name(start), start=start, end=add_months(start, 1))
        for start in (add_months(first, i) for i in range(months_back + months_forward + 1))
    ]


async def ensure_partitions(
    engine: AsyncEngine,
    *,
    months_back: int,
    months_forward: int,
    today: date | None = None,
) -> PartitionRunResult:
    """
    Create every partition in the current window that does not already exist.

    Idempotent: partitions that are already there are reported as `existing` and
    left untouched. Each partition is created in its own transaction, so one
    failure does not roll back the partitions created before it — a window that
    partially succeeds still moves the app forward.
    """
    today = today or datetime.now(timezone.utc).date()
    window = partition_window(today, months_back, months_forward)
    result = PartitionRunResult(window_start=window[0].start, window_end=window[-1].end)

    async with engine.connect() as conn:
        if not await _acquire_lock(conn):
            result.skipped = True
            log.info("Partition maintenance %s", result.summary())
            return result
        try:
            for part in window:
                await _ensure_one(conn, part, result)
        finally:
            await _release_lock(conn)

    if result.failed:
        # Loud on purpose: this is the failure the fire-and-forget write path
        # cannot surface on its own.
        log.error(
            "Partition maintenance FAILED for %d of %d partitions — writes to "
            "these months will be dropped: %s",
            len(result.failed),
            len(window),
            ", ".join(f"{name} ({err})" for name, err in result.failed.items()),
        )
    else:
        log.info("Partition maintenance %s", result.summary())
    return result


async def _acquire_lock(conn) -> bool:
    """Take the session-level advisory lock, or report that someone else has it."""
    try:
        acquired = await conn.scalar(
            text("SELECT pg_try_advisory_lock(:key)"), {"key": ADVISORY_LOCK_KEY}
        )
        return bool(acquired)
    except SQLAlchemyError:
        log.exception("Could not acquire the partition maintenance advisory lock")
        raise


async def _release_lock(conn) -> None:
    try:
        await conn.execute(
            text("SELECT pg_advisory_unlock(:key)"), {"key": ADVISORY_LOCK_KEY}
        )
        await conn.commit()
    except SQLAlchemyError:
        # The lock is session-scoped, so closing the connection releases it
        # anyway. Worth a line in the log, not worth failing the run.
        log.warning("Failed to release the partition maintenance advisory lock", exc_info=True)


async def _ensure_one(conn, part: Partition, result: PartitionRunResult) -> None:
    try:
        exists = await conn.scalar(text("SELECT to_regclass(:name)"), {"name": part.name})
        if exists is not None:
            result.existing.append(part.name)
            return
        await conn.execute(text(part.ddl))
        await conn.commit()
        result.created.append(part.name)
        log.info("Created partition %s for %s..%s", part.name, part.start, part.end)
    except SQLAlchemyError as exc:
        await conn.rollback()
        if _sqlstate(exc) == _DUPLICATE_TABLE:
            # Another session created it between our check and our CREATE.
            # That is the outcome we wanted, so it is not a failure.
            result.existing.append(part.name)
            return
        result.failed[part.name] = type(exc).__name__
        log.error("Failed to create partition %s", part.name, exc_info=True)


def _sqlstate(exc: BaseException) -> str | None:
    orig = getattr(exc, "orig", None)
    return getattr(orig, "sqlstate", None) or getattr(orig, "pgcode", None)


class PartitionMaintainer:
    """
    Runs `ensure_partitions` at startup and then every `interval_seconds`.

    The loop swallows exceptions *after logging them at ERROR* so that a
    transient database outage does not kill the maintenance task for the life of
    the process — the next tick retries. `status()` exposes the last outcome so
    the failure is visible on /metrics rather than only in the logs.
    """

    def __init__(
        self,
        engine: AsyncEngine,
        *,
        months_back: int,
        months_forward: int,
        interval_seconds: float,
    ) -> None:
        self._engine = engine
        self._months_back = months_back
        self._months_forward = months_forward
        self._interval = interval_seconds
        self._task: asyncio.Task | None = None
        self._last_result: PartitionRunResult | None = None
        self._last_error: str | None = None
        self._last_run_at: datetime | None = None

    async def run_once(self) -> PartitionRunResult:
        """One maintenance pass. Records the outcome; re-raises on failure."""
        self._last_run_at = datetime.now(timezone.utc)
        try:
            result = await ensure_partitions(
                self._engine,
                months_back=self._months_back,
                months_forward=self._months_forward,
            )
        except Exception as exc:
            self._last_error = f"{type(exc).__name__}: {exc}"
            raise
        self._last_result = result
        self._last_error = (
            f"{len(result.failed)} partition(s) failed: {', '.join(result.failed)}"
            if result.failed
            else None
        )
        return result

    def record_startup_failure(self, detail: str = "database initialization failed") -> None:
        """Mark the last run as failed when init_db() raised before run_once()."""
        self._last_run_at = datetime.now(timezone.utc)
        self._last_error = detail

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._loop(), name="partition-maintainer")

    async def stop(self) -> None:
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None

    async def _loop(self) -> None:
        while True:
            try:
                await asyncio.sleep(self._interval)
                await self.run_once()
            except asyncio.CancelledError:
                raise
            except Exception:
                log.error(
                    "Scheduled partition maintenance failed; retrying in %.0fs",
                    self._interval,
                    exc_info=True,
                )

    def status(self) -> dict:
        result = self._last_result
        return {
            "months_back": self._months_back,
            "months_forward": self._months_forward,
            "interval_seconds": self._interval,
            "running": bool(self._task and not self._task.done()),
            "last_run_at": self._last_run_at.isoformat() if self._last_run_at else None,
            "last_error": self._last_error,
            "window": (
                f"{result.window_start}..{result.window_end}" if result else None
            ),
            "created": list(result.created) if result else [],
            "existing_count": len(result.existing) if result else 0,
            "failed": dict(result.failed) if result else {},
        }
