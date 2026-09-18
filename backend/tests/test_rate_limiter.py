"""Tests for the Redis token bucket limiter."""

import asyncio

import pytest

from backend.services.rate_limiter import TokenBucketLimiter


@pytest.fixture
def limiter(redis, settings):
    return TokenBucketLimiter(redis)


async def test_bucket_starts_full(limiter, settings):
    capacity, _ = settings.rate_params("stooq")
    for _ in range(int(capacity)):
        assert await limiter.consume("stooq") is True
    assert await limiter.consume("stooq") is False


async def test_refill_accrues_over_time(limiter, settings, monkeypatch):
    capacity, rate = settings.rate_params("stooq")
    now = [1_000_000.0]
    monkeypatch.setattr("backend.services.rate_limiter.time.time", lambda: now[0])

    for _ in range(int(capacity)):
        await limiter.consume("stooq")
    assert await limiter.consume("stooq") is False

    now[0] += 3.0 / rate          # exactly three tokens' worth of time
    assert await limiter.consume("stooq") is True
    assert await limiter.consume("stooq") is True
    assert await limiter.consume("stooq") is True
    assert await limiter.consume("stooq") is False


async def _drain(limiter, source, capacity):
    for _ in range(int(capacity)):
        await limiter.consume(source)


async def _budget_over_window(limiter, source, capacity, now, window, polls):
    """Permits a client gets across *window*, making *polls* evenly spaced
    attempts and then taking whatever is left. Counting the leftover keeps the
    result independent of whether an attempt lands a hair before a token
    boundary."""
    await _drain(limiter, source, capacity)
    start = now[0]
    allowed = 0
    for i in range(polls):
        now[0] = start + window * (i + 1) / polls
        if await limiter.consume(source):
            allowed += 1
    while await limiter.consume(source):
        allowed += 1
    return allowed


async def test_polling_while_empty_does_not_discard_refill_progress(limiter, settings, monkeypatch):
    """Regression: a denied call used to reset the refill clock without saving
    the tokens accrued since the last one, so a client that retried could
    starve its own bucket indefinitely."""
    capacity, rate = settings.rate_params("stooq")
    now = [1_000_000.0]
    monkeypatch.setattr("backend.services.rate_limiter.time.time", lambda: now[0])

    # Poll ten times per token's worth of time across a three-token window.
    allowed = await _budget_over_window(limiter, "stooq", capacity, now, 3.0 / rate, 30)
    assert allowed == 3, f"polling client got {allowed} permits, expected 3"


async def test_polling_and_idle_clients_get_the_same_budget(limiter, settings, monkeypatch):
    capacity, rate = settings.rate_params("stooq")
    now = [1_000_000.0]
    monkeypatch.setattr("backend.services.rate_limiter.time.time", lambda: now[0])
    window = 3.0 / rate

    polling = await _budget_over_window(limiter, "stooq", capacity, now, window, 60)
    await limiter._redis.flushall()
    idle = await _budget_over_window(limiter, "stooq", capacity, now, window, 1)

    assert polling == idle == 3, f"polling={polling} idle={idle}"


async def test_tokens_never_exceed_capacity(limiter, settings, monkeypatch):
    capacity, _ = settings.rate_params("stooq")
    now = [1_000_000.0]
    monkeypatch.setattr("backend.services.rate_limiter.time.time", lambda: now[0])

    await limiter.consume("stooq")
    now[0] += 86_400                      # a day of idle refill
    for _ in range(int(capacity)):
        assert await limiter.consume("stooq") is True
    assert await limiter.consume("stooq") is False


async def test_sources_have_independent_buckets(limiter, settings):
    capacity, _ = settings.rate_params("alphavantage")
    for _ in range(int(capacity)):
        await limiter.consume("alphavantage")
    assert await limiter.consume("alphavantage") is False
    assert await limiter.consume("stooq") is True


async def test_concurrent_consumers_never_oversubscribe(limiter, settings):
    """The Lua script must make read-refill-write atomic: N concurrent callers
    on a bucket of capacity C must yield exactly C permits, never more."""
    capacity, _ = settings.rate_params("stooq")
    results = await asyncio.gather(
        *[limiter.consume("stooq") for _ in range(int(capacity) * 3)]
    )
    assert sum(results) == int(capacity)


async def test_clock_skew_backwards_does_not_mint_tokens(limiter, settings, monkeypatch):
    capacity, _ = settings.rate_params("stooq")
    now = [1_000_000.0]
    monkeypatch.setattr("backend.services.rate_limiter.time.time", lambda: now[0])

    for _ in range(int(capacity)):
        await limiter.consume("stooq")
    now[0] -= 3600                        # clock jumps backwards
    assert await limiter.consume("stooq") is False


async def test_denials_are_counted(limiter, redis, settings):
    capacity, _ = settings.rate_params("stooq")
    for _ in range(int(capacity) + 4):
        await limiter.consume("stooq")
    assert int(await redis.get("metrics:source:stooq:rate_limit_hits")) == 4


async def test_bucket_keys_expire_so_idle_sources_do_not_leak(limiter, redis):
    await limiter.consume("stooq")
    for key in ("ratelimit:stooq:tokens", "ratelimit:stooq:last"):
        assert await redis.ttl(key) > 0, f"{key} has no TTL"


async def test_retry_after_reports_when_a_token_is_next_available(limiter, settings, monkeypatch):
    capacity, rate = settings.rate_params("stooq")
    now = [1_000_000.0]
    monkeypatch.setattr("backend.services.rate_limiter.time.time", lambda: now[0])

    for _ in range(int(capacity)):
        await limiter.consume("stooq")

    wait = await limiter.retry_after("stooq")
    assert wait == pytest.approx(1.0 / rate, rel=0.05)

    now[0] += wait
    assert await limiter.consume("stooq") is True
