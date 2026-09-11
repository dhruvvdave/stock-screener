"""
Symbol resolution: the four outcomes that matter, plus the cache path.

Redis and Finnhub are faked here (see conftest). That is a deliberate contrast
with the partition tests, which use a real Postgres: partitioning cannot be
meaningfully faked, whereas this module is cache bookkeeping and JSON shaping.
"""

import json

import pytest

from backend.services.symbols import AMBIGUOUS, NOT_FOUND, RESOLVED, SymbolResolver

from .conftest import FakeHttp, FakeLimiter, FakeRedis, finnhub_search_payload


def resolver(redis=None, payload=None, ok=True, allow=True):
    return SymbolResolver(
        redis or FakeRedis(),
        http=FakeHttp(payload, ok=ok),
        limiter=FakeLimiter(allow=allow),
    )


class TestTSXVentureResolution:
    """TSX-V end to end — the exchange the old code got wrong most often."""

    async def test_venture_ticker_resolves_to_every_provider_spelling(self):
        r = resolver(payload=finnhub_search_payload(
            ("GSI", "Gatos Silver", "TSXV:GSI"),
        ))
        result = await r.resolve("GSI")

        assert result.status == RESOLVED
        assert result.exchange == "TSX-V"
        assert result.currency == "CAD"
        assert result.symbols["yahoo"] == "GSI.V"
        assert result.symbols["finnhub"] == "TSXV:GSI"
        assert result.symbols["tradingview"] == "TSXV:GSI"
        assert result.symbols["stooq"] == "gsi.ca"

    async def test_an_explicit_venture_hint_needs_no_search_at_all(self):
        http = FakeHttp()
        r = SymbolResolver(FakeRedis(), http=http, limiter=FakeLimiter())

        result = await r.resolve("GSI", exchange="TSX-V")

        assert result.status == RESOLVED
        assert result.symbols["yahoo"] == "GSI.V"
        # The exchange was already known, so nothing was asked of Finnhub.
        assert http.calls == 0

    @pytest.mark.parametrize("spelling", ["TSXV:GSI", "GSI.V", "gsi.v"])
    async def test_a_ticker_already_carrying_its_exchange_resolves_offline(self, spelling):
        http = FakeHttp()
        r = SymbolResolver(FakeRedis(), http=http, limiter=FakeLimiter())

        result = await r.resolve(spelling)

        assert result.status == RESOLVED
        assert result.exchange == "TSX-V"
        assert result.ticker == "GSI"
        assert http.calls == 0

    async def test_tsx_and_venture_do_not_collide(self):
        r = resolver()
        tsx = await r.resolve("SHOP", exchange="TSX")
        venture = await r.resolve("GSI", exchange="TSX-V")
        assert tsx.symbols["yahoo"] == "SHOP.TO"
        assert venture.symbols["yahoo"] == "GSI.V"


class TestAmbiguity:
    async def test_a_ticker_on_two_exchanges_is_not_silently_picked(self):
        r = resolver(payload=finnhub_search_payload(
            ("SHOP", "Shopify Inc", "TSX:SHOP"),
            ("SHOP", "Shopify Inc", "SHOP"),
        ))
        result = await r.resolve("SHOP")

        assert result.status == AMBIGUOUS
        assert not result.ok
        # No listing was chosen on the user's behalf.
        assert result.exchange is None
        assert result.symbols == {}

    async def test_candidates_name_every_exchange_found(self):
        r = resolver(payload=finnhub_search_payload(
            ("SHOP", "Shopify Inc", "TSX:SHOP"),
            ("SHOP", "Shopify Inc", "SHOP"),
        ))
        result = await r.resolve("SHOP")

        venues = {c.exchange for c in result.candidates}
        assert venues == {"TSX", "US"}
        assert all(c.ticker == "SHOP" for c in result.candidates)
        assert "more than one exchange" in result.message

    async def test_an_exchange_hint_settles_the_ambiguity(self):
        r = resolver(payload=finnhub_search_payload(
            ("SHOP", "Shopify Inc", "TSX:SHOP"),
            ("SHOP", "Shopify Inc", "SHOP"),
        ))
        result = await r.resolve("SHOP", exchange="NYSE")

        assert result.status == RESOLVED
        assert result.exchange == "NYSE"
        assert result.symbols["yahoo"] == "SHOP"

    async def test_duplicate_listings_on_one_exchange_are_not_ambiguous(self):
        r = resolver(payload=finnhub_search_payload(
            ("RY", "Royal Bank", "TSX:RY"),
            ("RY", "Royal Bank of Canada", "TSX:RY"),
        ))
        result = await r.resolve("RY")

        assert result.status == RESOLVED
        assert result.exchange == "TSX"


class TestUnresolvable:
    async def test_unknown_ticker_returns_a_message_naming_the_ticker(self):
        r = resolver(payload=finnhub_search_payload())
        result = await r.resolve("ZZZZ")

        assert result.status == NOT_FOUND
        assert not result.ok
        assert "ZZZZ" in result.message
        assert result.symbols == {}

    async def test_near_misses_are_not_treated_as_matches(self):
        # Finnhub's search is fuzzy: asking for AAPL returns foreign
        # cross-listings whose symbols are not AAPL. None of them is the
        # listing that was asked for.
        r = resolver(payload=finnhub_search_payload(
            ("AAPL34", "Apple BDR", "AAPL34"),
            ("APC.DE", "Apple Xetra", "XETRA:APC"),
        ))
        result = await r.resolve("AAPL")

        assert result.status == NOT_FOUND
        assert "AAPL" in result.message

    async def test_empty_query_is_rejected_with_a_reason(self):
        result = await resolver().resolve("   ")
        assert result.status == NOT_FOUND
        assert result.message

    async def test_rate_limited_search_explains_itself_and_suggests_a_way_out(self):
        r = resolver(payload=finnhub_search_payload(("GSI", "Gatos", "TSXV:GSI")),
                     allow=False)
        result = await r.resolve("GSI")

        assert result.status == NOT_FOUND
        # Not the same message as "no such ticker" — the distinction matters to
        # anyone reading it.
        assert "quota" in result.message
        assert "exchange" in result.message

    async def test_search_failure_does_not_raise(self):
        r = resolver(payload={}, ok=False)
        result = await r.resolve("GSI")
        assert result.status == NOT_FOUND


class TestCaching:
    async def test_second_lookup_is_served_from_cache_without_searching(self):
        redis = FakeRedis()
        http = FakeHttp(finnhub_search_payload(("GSI", "Gatos Silver", "TSXV:GSI")))
        r = SymbolResolver(redis, http=http, limiter=FakeLimiter())

        first = await r.resolve("GSI")
        second = await r.resolve("GSI")

        assert first.status == second.status == RESOLVED
        assert second.symbols == first.symbols
        assert second.cached is True and first.cached is False
        assert http.calls == 1          # only the first lookup hit Finnhub
        assert redis.setex_calls == 1

    async def test_hits_are_held_far_longer_than_misses(self):
        redis = FakeRedis()
        r = SymbolResolver(redis, http=FakeHttp(finnhub_search_payload(
            ("GSI", "Gatos Silver", "TSXV:GSI"))), limiter=FakeLimiter())
        await r.resolve("GSI")
        hit_ttl = redis.ttls["symbol:v1:GSI"]

        redis2 = FakeRedis()
        r2 = SymbolResolver(redis2, http=FakeHttp(finnhub_search_payload()),
                            limiter=FakeLimiter())
        await r2.resolve("ZZZZ")
        miss_ttl = redis2.ttls["symbol:v1:ZZZZ"]

        assert hit_ttl > miss_ttl
        assert miss_ttl > 0             # a miss is still cached, or a typo loops

    async def test_each_exchange_of_a_ticker_is_cached_separately(self):
        redis = FakeRedis()
        r = resolver(redis)
        await r.resolve("SHOP", exchange="TSX")
        await r.resolve("SHOP", exchange="NYSE")

        assert "symbol:v1:SHOP@TSX" in redis.store
        assert "symbol:v1:SHOP@NYSE" in redis.store

    async def test_cache_records_hit_and_miss_counters(self):
        redis = FakeRedis()
        r = resolver(redis, payload=finnhub_search_payload(("GSI", "G", "TSXV:GSI")))
        await r.resolve("GSI")
        await r.resolve("GSI")

        stats = await r.metrics()
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["hit_rate"] == 0.5

    async def test_an_unreadable_cache_entry_is_treated_as_a_miss(self):
        redis = FakeRedis()
        redis.store["symbol:v1:GSI"] = "{not json"
        r = SymbolResolver(redis, http=FakeHttp(finnhub_search_payload(
            ("GSI", "Gatos Silver", "TSXV:GSI"))), limiter=FakeLimiter())

        result = await r.resolve("GSI")

        assert result.status == RESOLVED
        assert result.symbols["yahoo"] == "GSI.V"

    async def test_resolution_still_works_when_redis_is_down(self):
        r = SymbolResolver(
            FakeRedis(fail=True),
            http=FakeHttp(finnhub_search_payload(("GSI", "Gatos Silver", "TSXV:GSI"))),
            limiter=FakeLimiter(),
        )
        result = await r.resolve("GSI")

        # The cache is an optimisation, not a dependency.
        assert result.status == RESOLVED
        assert result.symbols["yahoo"] == "GSI.V"

    async def test_cached_payload_survives_a_round_trip(self):
        redis = FakeRedis()
        r = resolver(redis, payload=finnhub_search_payload(("GSI", "Gatos", "TSXV:GSI")))
        original = await r.resolve("GSI")

        stored = json.loads(redis.store["symbol:v1:GSI"])
        assert stored["exchange"] == "TSX-V"
        assert stored["symbols"]["yahoo"] == "GSI.V"

        restored = await r.resolve("GSI")
        assert restored.symbols == original.symbols
        assert [c.exchange for c in restored.candidates] == []
