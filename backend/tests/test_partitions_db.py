"""
Partition maintenance against a real PostgreSQL.

Covers the three cases that matter:
  1. a fresh window creates every partition it should
  2. re-running with partitions already present is a no-op, not an error
  3. a row whose timestamp lands in a newly created partition is actually
     stored, and lands in the *right* partition

plus the boundary that motivates the whole exercise: a row outside the window
is rejected by Postgres, which is what used to happen silently in production.
"""

from datetime import date, datetime

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from backend.services.partitions import (
    ADVISORY_LOCK_KEY,
    PartitionMaintainer,
    ensure_partitions,
    partition_window,
)

from .conftest import partition_names, requires_postgres

pytestmark = requires_postgres


class TestFreshWindow:
    async def test_creates_every_partition_in_the_window(self, parent_table):
        engine = parent_table
        assert await partition_names(engine) == []

        result = await ensure_partitions(
            engine, months_back=2, months_forward=3, today=date(2026, 6, 15)
        )

        expected = [p.name for p in partition_window(date(2026, 6, 15), 2, 3)]
        assert result.created == expected
        assert result.existing == []
        assert result.failed == {}
        assert result.ok
        assert await partition_names(engine) == sorted(expected)

    async def test_reported_window_matches_the_partitions_created(self, parent_table):
        result = await ensure_partitions(
            parent_table, months_back=1, months_forward=1, today=date(2026, 6, 15)
        )
        assert result.window_start == date(2026, 5, 1)
        assert result.window_end == date(2026, 8, 1)


class TestRerunIsIdempotent:
    async def test_second_run_creates_nothing_and_does_not_error(self, parent_table):
        engine = parent_table
        first = await ensure_partitions(
            engine, months_back=1, months_forward=2, today=date(2026, 6, 15)
        )
        after_first = await partition_names(engine)

        second = await ensure_partitions(
            engine, months_back=1, months_forward=2, today=date(2026, 6, 15)
        )

        assert second.created == []
        assert second.existing == first.created
        assert second.failed == {}
        assert await partition_names(engine) == after_first

    async def test_advancing_the_window_adds_only_the_new_months(self, parent_table):
        engine = parent_table
        await ensure_partitions(
            engine, months_back=1, months_forward=1, today=date(2026, 6, 15)
        )

        # Two months later: the window slides, and only the months it has not
        # seen before should be created.
        result = await ensure_partitions(
            engine, months_back=1, months_forward=1, today=date(2026, 8, 15)
        )

        assert result.created == ["price_history_2026_08", "price_history_2026_09"]
        assert result.existing == ["price_history_2026_07"]
        # Partitions that aged out of the window are left alone — dropping them
        # would delete price history.
        assert "price_history_2026_05" in await partition_names(engine)

    async def test_partitions_created_by_the_old_three_month_loop_are_adopted(
        self, parent_table
    ):
        """A database set up by the previous init_db() must not trip the new code."""
        engine = parent_table
        async with engine.begin() as conn:
            await conn.execute(text(
                "CREATE TABLE price_history_2026_06 PARTITION OF price_history "
                "FOR VALUES FROM ('2026-06-01') TO ('2026-07-01')"
            ))

        result = await ensure_partitions(
            engine, months_back=1, months_forward=1, today=date(2026, 6, 15)
        )

        assert result.existing == ["price_history_2026_06"]
        assert result.created == ["price_history_2026_05", "price_history_2026_07"]
        assert result.ok


class TestWritesLandInNewPartitions:
    async def test_row_in_a_newly_created_month_is_stored_in_that_partition(
        self, parent_table
    ):
        engine = parent_table
        # A window whose forward months did not exist a moment ago.
        await ensure_partitions(
            engine, months_back=0, months_forward=2, today=date(2026, 6, 15)
        )

        # August is two months out — under the old three-month bootstrap this is
        # exactly the kind of row that had nowhere to go.
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "INSERT INTO price_history (ticker, source, timestamp, close) "
                    "VALUES (:t, :s, :ts, :c)"
                ),
                {"t": "GSI.V", "s": "stooq", "ts": datetime(2026, 8, 14, 20, 0), "c": 1.23},
            )

        async with engine.connect() as conn:
            row = (await conn.execute(text(
                "SELECT tableoid::regclass::text, ticker, close "
                "FROM price_history WHERE ticker = 'GSI.V'"
            ))).one()

        assert row[0] == "price_history_2026_08"
        assert row[1] == "GSI.V"
        assert row[2] == pytest.approx(1.23)

    async def test_a_two_year_backfill_lands_across_many_partitions(self, parent_table):
        """
        /api/candle?range=2y writes every bar it fetched, so a single request can
        insert rows up to 24 months old. That is why months_back defaults to 24.
        """
        engine = parent_table
        await ensure_partitions(
            engine, months_back=24, months_forward=3, today=date(2026, 6, 15)
        )

        bars = [
            datetime(2024, 7, 1, 20, 0),   # ~23 months back
            datetime(2025, 6, 2, 20, 0),
            datetime(2026, 6, 12, 20, 0),
        ]
        async with engine.begin() as conn:
            for ts in bars:
                await conn.execute(
                    text(
                        "INSERT INTO price_history (ticker, source, timestamp, close) "
                        "VALUES ('SHOP', 'yahoo', :ts, 100.0)"
                    ),
                    {"ts": ts},
                )

        async with engine.connect() as conn:
            rows = (await conn.execute(text(
                "SELECT tableoid::regclass::text FROM price_history "
                "WHERE ticker = 'SHOP' ORDER BY timestamp"
            ))).scalars().all()

        assert rows == [
            "price_history_2024_07",
            "price_history_2025_06",
            "price_history_2026_06",
        ]

    async def test_row_outside_the_window_is_rejected_not_silently_dropped(
        self, parent_table
    ):
        """
        The failure mode this whole module exists to prevent. Postgres refuses
        the row; the old code let that exception die inside a fire-and-forget
        task while the request returned 200.
        """
        engine = parent_table
        await ensure_partitions(
            engine, months_back=0, months_forward=1, today=date(2026, 6, 15)
        )

        with pytest.raises(DBAPIError) as exc:
            async with engine.begin() as conn:
                await conn.execute(
                    text(
                        "INSERT INTO price_history (ticker, source, timestamp, close) "
                        "VALUES ('AAPL', 'yahoo', :ts, 200.0)"
                    ),
                    {"ts": datetime(2030, 1, 1, 20, 0)},
                )
        assert "no partition of relation" in str(exc.value)


class TestConcurrencyGuard:
    async def test_run_is_skipped_while_another_session_holds_the_lock(
        self, parent_table
    ):
        engine = parent_table
        holder = await engine.connect()
        try:
            got = await holder.scalar(
                text("SELECT pg_try_advisory_lock(:k)"), {"k": ADVISORY_LOCK_KEY}
            )
            assert got is True

            result = await ensure_partitions(
                engine, months_back=1, months_forward=1, today=date(2026, 6, 15)
            )

            # The replica holding the lock is creating the same window, so
            # skipping is correct — and must not look like a failure.
            assert result.skipped is True
            assert result.ok
            assert await partition_names(engine) == []
        finally:
            await holder.execute(
                text("SELECT pg_advisory_unlock(:k)"), {"k": ADVISORY_LOCK_KEY}
            )
            await holder.close()

    async def test_lock_is_released_so_the_next_run_proceeds(self, parent_table):
        engine = parent_table
        await ensure_partitions(
            engine, months_back=0, months_forward=0, today=date(2026, 6, 15)
        )
        # If the previous run leaked its advisory lock, this one would skip.
        result = await ensure_partitions(
            engine, months_back=0, months_forward=1, today=date(2026, 6, 15)
        )
        assert result.skipped is False
        assert result.created == ["price_history_2026_07"]


class TestMaintainerStatus:
    async def test_status_reports_the_window_after_a_successful_run(self, parent_table):
        maintainer = PartitionMaintainer(
            parent_table, months_back=1, months_forward=1, interval_seconds=3600
        )
        await maintainer.run_once()

        status = maintainer.status()
        assert status["last_error"] is None
        assert status["last_run_at"] is not None
        assert len(status["created"]) == 3
        assert status["months_back"] == 1

    async def test_failure_is_recorded_rather_than_swallowed(self, engine):
        """No parent table, so every CREATE ... PARTITION OF fails."""
        maintainer = PartitionMaintainer(
            engine, months_back=1, months_forward=1, interval_seconds=3600
        )

        result = await maintainer.run_once()

        assert not result.ok
        assert len(result.failed) == 3
        status = maintainer.status()
        assert status["last_error"] is not None
        assert "failed" in status["last_error"]

    async def test_failures_are_logged_at_error(self, engine, caplog):
        maintainer = PartitionMaintainer(
            engine, months_back=0, months_forward=0, interval_seconds=3600
        )
        with caplog.at_level("ERROR"):
            await maintainer.run_once()

        assert any(
            "Partition maintenance FAILED" in r.message or "Failed to create partition" in r.message
            for r in caplog.records
        )
