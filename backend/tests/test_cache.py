"""Tests for the Redis response cache: keying, TTL dispatch, invalidation,
and single-flight behaviour under concurrent misses."""

import asyncio

import pytest

from backend.services import cache as cache_mod
from backend.services.cache import ResponseCache


@pytest.fixture
def cache(redis, settings):
    return ResponseCache(redis)


# ── Keying ─────────────────────────────────────────────────────────────────
# Regression: /api/stock, /api/candle and /api/news used to read under the
# source "any" while writing under whichever provider answered, so every
# request missed. The key must not depend on the source at all.

@pytest.mark.parametrize("resource", ["quote", "candle:1mo", "news"])
async def test_key_is_independent_of_which_source_answered(cache, resource):
    assert cache.key("AAPL", resource) == f"cache:AAPL:{resource}"


@pytest.mark.parametrize("resource", ["quote", "candle:1mo", "news"])
async def test_written_value_is_read_back(cache, resource):
    await cache.set("AAPL", resource, {"served_by": "yahoo"})
    assert await cache.get("AAPL", resource) == {"served_by": "yahoo"}


async def test_distinct_resources_do_not_collide(cache):
    await cache.set("AAPL", "quote", {"kind": "quote"})
    await cache.set("AAPL", "list-quote", {"kind": "list"})
    await cache.set("AAPL", "candle:1mo", {"kind": "candle"})
    assert await cache.get("AAPL", "quote") == {"kind": "quote"}
    assert await cache.get("AAPL", "list-quote") == {"kind": "list"}
    assert await cache.get("AAPL", "candle:1mo") == {"kind": "candle"}


async def test_candle_ranges_do_not_collide(cache):
    await cache.set("AAPL", cache_mod.candle("1mo"), {"r": "1mo"})
    await cache.set("AAPL", cache_mod.candle("2y"), {"r": "2y"})
    assert await cache.get("AAPL", cache_mod.candle("1mo")) == {"r": "1mo"}
    assert await cache.get("AAPL", cache_mod.candle("2y")) == {"r": "2y"}


async def test_distinct_tickers_do_not_collide(cache):
    await cache.set("AAPL", "quote", {"t": "AAPL"})
    await cache.set("MSFT", "quote", {"t": "MSFT"})
    assert await cache.get("AAPL", "quote") == {"t": "AAPL"}
    assert await cache.get("MSFT", "quote") == {"t": "MSFT"}


async def test_ticker_case_is_normalised(cache):
    await cache.set("aapl", "quote", {"v": 1})
    assert await cache.get("AAPL", "quote") == {"v": 1}


async def test_miss_returns_none(cache):
    assert await cache.get("NOPE", "quote") is None


async def test_corrupt_entry_behaves_like_a_miss(cache, redis):
    await redis.set(cache.key("AAPL", "quote"), "{not json")
    assert await cache.get("AAPL", "quote") is None
    assert await redis.get(cache.key("AAPL", "quote")) is None


# ── TTL dispatch ───────────────────────────────────────────────────────────
# Regression: ttl_for_resolution() was fed resource names but only matched
# resolution labels, so every entry silently got the 1-hour bucket, including
# live quotes.

@pytest.mark.parametrize("resource,attr", [
    ("quote", "ttl_quote"),
    ("list-quote", "ttl_list_quote"),
    ("candle:1mo", "ttl_candle"),
    ("candle:2y", "ttl_candle"),
    ("news", "ttl_news"),
    ("search", "ttl_search"),
    ("profile", "ttl_profile"),
    ("fundamentals", "ttl_fundamentals"),
    ("stock-metrics", "ttl_stock_metrics"),
    ("analyst", "ttl_analyst"),
    ("enrich", "ttl_enrich"),
])
async def test_ttl_matches_the_resource(cache, redis, settings, resource, attr):
    await cache.set("AAPL", resource, {"v": 1})
    expected = getattr(settings, attr)
    ttl = await redis.ttl(cache.key("AAPL", resource))
    # TTL counts down from the moment of the write, so allow the one second
    # that can elapse between SETEX and the read-back.
    assert expected - 1 <= ttl <= expected


async def test_quotes_expire_much_faster_than_profiles(settings):
    assert settings.ttl_quote < settings.ttl_profile


async def test_unknown_resource_falls_back_to_the_default(cache, redis, settings):
    await cache.set("AAPL", "something-new", {"v": 1})
    ttl = await redis.ttl(cache.key("AAPL", "something-new"))
    assert settings.ttl_default - 1 <= ttl <= settings.ttl_default


# ── Invalidation ───────────────────────────────────────────────────────────

async def test_invalidate_drops_one_resource(cache):
    await cache.set("AAPL", "quote", {"v": 1})
    await cache.set("AAPL", "news", {"v": 2})
    assert await cache.invalidate("AAPL", "quote") == 1
    assert await cache.get("AAPL", "quote") is None
    assert await cache.get("AAPL", "news") == {"v": 2}


async def test_invalidate_drops_every_resource_for_a_ticker(cache):
    await cache.set("AAPL", "quote", {"v": 1})
    await cache.set("AAPL", "news", {"v": 2})
    await cache.set("MSFT", "quote", {"v": 3})
    assert await cache.invalidate("AAPL") == 2
    assert await cache.get("AAPL", "quote") is None
    assert await cache.get("AAPL", "news") is None
    assert await cache.get("MSFT", "quote") == {"v": 3}


async def test_invalidating_an_absent_key_is_a_no_op(cache):
    assert await cache.invalidate("AAPL", "quote") == 0
    assert await cache.invalidate("AAPL") == 0


async def test_entries_expire(cache, redis):
    await cache.set("AAPL", "quote", {"v": 1})
    assert await cache.get("AAPL", "quote") is not None
    await redis.delete(cache.key("AAPL", "quote"))   # stand-in for TTL elapsing
    assert await cache.get("AAPL", "quote") is None


# ── Counters ───────────────────────────────────────────────────────────────

async def test_counters_track_hits_and_misses(cache):
    await cache.get("AAPL", "quote")                 # miss
    await cache.set("AAPL", "quote", {"v": 1})
    await cache.get("AAPL", "quote")                 # hit
    await cache.get("AAPL", "quote")                 # hit

    metrics = await cache.get_metrics()
    assert metrics["hits"] == 2
    assert metrics["misses"] == 1
    assert metrics["hit_rate"] == pytest.approx(2 / 3, abs=1e-4)
    assert metrics["miss_rate"] == pytest.approx(1 / 3, abs=1e-4)


async def test_metrics_with_no_traffic_do_not_divide_by_zero(cache):
    assert await cache.get_metrics() == {
        "hits": 0, "misses": 0, "hit_rate": 0.0, "miss_rate": 0.0,
    }


async def test_incr_source_counts_outbound_requests(cache, redis):
    await cache.incr_source("finnhub")
    await cache.incr_source("finnhub")
    assert int(await redis.get("metrics:source:finnhub:requests")) == 2


# ── get_or_set and stampede control ────────────────────────────────────────

async def test_get_or_set_produces_on_miss_and_caches(cache):
    calls = []

    async def producer():
        calls.append(1)
        return {"v": "fresh"}

    assert await cache.get_or_set("AAPL", "quote", producer) == {"v": "fresh"}
    assert await cache.get_or_set("AAPL", "quote", producer) == {"v": "fresh"}
    assert len(calls) == 1, "second call should have been served from cache"


async def test_get_or_set_does_not_cache_a_failed_fetch(cache):
    async def failed():
        return None

    assert await cache.get_or_set("AAPL", "quote", failed) is None
    assert await cache.get("AAPL", "quote") is None


async def test_get_or_set_honours_a_custom_cacheability_rule(cache):
    """An empty fallback payload is a real answer but not worth keeping."""
    async def empty():
        return {"prices": None}

    result = await cache.get_or_set(
        "AAPL", "candle:1mo", empty,
        should_cache=lambda v: bool(v and v.get("prices")),
    )
    assert result == {"prices": None}
    assert await cache.get("AAPL", "candle:1mo") is None


async def test_concurrent_misses_collapse_onto_one_upstream_call(cache):
    """Without single-flight, a popular ticker expiring sends one upstream
    request per in-flight client and burns the rate-limit budget in a burst."""
    calls = []

    async def slow_producer():
        calls.append(1)
        await asyncio.sleep(0.1)
        return {"v": "fresh"}

    results = await asyncio.gather(
        *[cache.get_or_set("AAPL", "quote", slow_producer) for _ in range(20)]
    )

    assert len(calls) == 1, f"expected 1 upstream call, got {len(calls)}"
    assert all(r == {"v": "fresh"} for r in results)


async def test_stampede_control_is_per_key(cache):
    calls = []

    async def slow_producer():
        calls.append(1)
        await asyncio.sleep(0.05)
        return {"v": 1}

    await asyncio.gather(
        cache.get_or_set("AAPL", "quote", slow_producer),
        cache.get_or_set("MSFT", "quote", slow_producer),
    )
    assert len(calls) == 2, "different tickers must not block each other"


async def test_a_follower_still_answers_if_the_leader_produces_nothing(cache, monkeypatch):
    """Fail open: a leader that returns an uncacheable value must not leave
    followers hanging or empty-handed."""
    monkeypatch.setattr(cache_mod, "_FOLLOWER_TIMEOUT_SECONDS", 0.2)
    calls = []

    async def producer():
        calls.append(1)
        await asyncio.sleep(0.05)
        return None

    results = await asyncio.gather(
        *[cache.get_or_set("AAPL", "quote", producer) for _ in range(5)]
    )
    assert results == [None] * 5
    assert len(calls) >= 1


async def test_the_lock_is_released_when_a_producer_raises(cache):
    async def boom():
        raise RuntimeError("upstream exploded")

    with pytest.raises(RuntimeError):
        await cache.get_or_set("AAPL", "quote", boom)

    # A stuck lock would make every later request wait out the follower
    # timeout, so prove the next caller becomes leader immediately.
    async def ok():
        return {"v": "recovered"}

    assert await asyncio.wait_for(
        cache.get_or_set("AAPL", "quote", ok), timeout=1.0
    ) == {"v": "recovered"}
