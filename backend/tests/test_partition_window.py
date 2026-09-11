"""
Window arithmetic for price_history partitions.

These tests need no database: partition_window() is pure, which is the point of
keeping the date maths separate from the DDL.
"""

from datetime import date

import pytest

from backend.services.partitions import (
    add_months,
    partition_name,
    partition_window,
)


def names(today, back, forward):
    return [p.name for p in partition_window(today, back, forward)]


class TestAddMonths:
    def test_moves_forward_within_a_year(self):
        assert add_months(date(2026, 3, 14), 2) == date(2026, 5, 1)

    def test_rolls_over_into_the_next_year(self):
        assert add_months(date(2026, 11, 1), 3) == date(2027, 2, 1)

    def test_rolls_back_into_the_previous_year(self):
        assert add_months(date(2026, 2, 1), -3) == date(2025, 11, 1)

    def test_normalises_to_the_first_of_the_month(self):
        assert add_months(date(2026, 6, 30), 0) == date(2026, 6, 1)


class TestPartitionWindow:
    def test_includes_current_month_plus_both_directions(self):
        window = partition_window(date(2026, 6, 15), months_back=2, months_forward=3)
        assert len(window) == 6
        assert [p.name for p in window] == [
            "price_history_2026_04",
            "price_history_2026_05",
            "price_history_2026_06",
            "price_history_2026_07",
            "price_history_2026_08",
            "price_history_2026_09",
        ]

    def test_bounds_are_contiguous_and_half_open(self):
        window = partition_window(date(2026, 1, 5), months_back=1, months_forward=2)
        assert len(window) == 4
        for earlier, later in zip(window, window[1:]):
            # No gap and no overlap: one partition ends exactly where the next
            # begins, which is what stops a row falling between two partitions.
            assert earlier.end == later.start
        assert window[0].start == date(2025, 12, 1)
        assert window[-1].end == date(2026, 4, 1)

    def test_spans_a_year_boundary_without_a_month_13(self):
        assert names(date(2026, 12, 20), 1, 2) == [
            "price_history_2026_11",
            "price_history_2026_12",
            "price_history_2027_01",
            "price_history_2027_02",
        ]

    def test_window_is_stable_for_any_day_within_a_month(self):
        first = names(date(2026, 7, 1), 3, 3)
        last = names(date(2026, 7, 31), 3, 3)
        assert first == last

    def test_zero_window_is_just_the_current_month(self):
        window = partition_window(date(2026, 7, 9), months_back=0, months_forward=0)
        assert [p.name for p in window] == ["price_history_2026_07"]

    def test_negative_input_is_clamped_rather_than_inverting_the_window(self):
        window = partition_window(date(2026, 7, 9), months_back=-5, months_forward=-5)
        assert [p.name for p in window] == ["price_history_2026_07"]

    @pytest.mark.parametrize(
        "day,expected",
        [
            (date(2026, 1, 1), "price_history_2026_01"),
            (date(2026, 9, 30), "price_history_2026_09"),
            (date(2027, 12, 31), "price_history_2027_12"),
        ],
    )
    def test_partition_names_zero_pad_the_month(self, day, expected):
        assert partition_name(day) == expected


class TestPartitionDDL:
    def test_ddl_is_idempotent_and_uses_half_open_bounds(self):
        part = partition_window(date(2026, 6, 1), 0, 0)[0]
        assert part.ddl == (
            "CREATE TABLE IF NOT EXISTS price_history_2026_06 PARTITION OF price_history "
            "FOR VALUES FROM ('2026-06-01') TO ('2026-07-01')"
        )
