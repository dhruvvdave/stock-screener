"""
Exchange conventions — pure, so no database and no network.

The bug these guard against: the old per-ticker map was consulted before the
exchange, so a NYSE listing of a dual-listed ticker still resolved to its
Canadian spelling.
"""

import pytest

from backend.services.exchanges import (
    EXCHANGES,
    PROVIDERS,
    all_provider_symbols,
    currency_for,
    normalise_exchange,
    parse_symbol,
    to_provider_symbol,
)


class TestDualListedTickers:
    """The regression that motivated the rewrite."""

    def test_same_ticker_resolves_differently_per_exchange(self):
        assert to_provider_symbol("SHOP", "TSX", "yahoo") == "SHOP.TO"
        assert to_provider_symbol("SHOP", "NYSE", "yahoo") == "SHOP"

    def test_exchange_decides_every_provider_not_just_yahoo(self):
        tsx = all_provider_symbols("SHOP", "TSX")
        nyse = all_provider_symbols("SHOP", "NYSE")
        assert tsx["finnhub"] == "TSX:SHOP" and nyse["finnhub"] == "SHOP"
        assert tsx["stooq"] == "shop.ca" and nyse["stooq"] == "shop.us"
        assert tsx["tradingview"] == "TSX:SHOP" and nyse["tradingview"] == "NYSE:SHOP"

    @pytest.mark.parametrize("ticker", ["CP", "TD", "RY", "ENB", "CNQ"])
    def test_previously_hardcoded_tickers_follow_their_exchange(self, ticker):
        # Every one of these was pinned to a .TO spelling by the old map,
        # regardless of the exchange it was actually found on.
        assert to_provider_symbol(ticker, "NYSE", "yahoo") == ticker
        assert to_provider_symbol(ticker, "TSX", "yahoo") == f"{ticker}.TO"


class TestTSXVenture:
    def test_venture_uses_its_own_spelling_not_the_tsx_one(self):
        symbols = all_provider_symbols("GSI", "TSX-V")
        assert symbols["yahoo"] == "GSI.V"
        assert symbols["finnhub"] == "TSXV:GSI"
        assert symbols["tradingview"] == "TSXV:GSI"
        assert symbols["twelvedata"] == "GSI:TSXV"

    def test_venture_shares_stooqs_canadian_market(self):
        assert to_provider_symbol("GSI", "TSX-V", "stooq") == "gsi.ca"

    def test_venture_is_priced_in_canadian_dollars(self):
        assert currency_for("TSX-V") == "CAD"
        assert currency_for("NYSE") == "USD"


class TestUncoveredMarkets:
    def test_stooq_returns_none_where_it_has_no_coverage(self):
        # Previously "NSE:INFY" became "nse:infy.us" — a real Stooq query for a
        # different company. None makes the router fall through instead.
        assert to_provider_symbol("INFY", "NSE", "stooq") is None
        assert to_provider_symbol("BHP", "ASX", "stooq") is None

    def test_other_providers_still_address_those_listings(self):
        assert to_provider_symbol("INFY", "NSE", "yahoo") == "INFY.NS"
        assert to_provider_symbol("BHP", "ASX", "finnhub") == "ASX:BHP"

    def test_xetra_and_nse_get_yahoo_suffixes(self):
        # The old frontend converter handled these for Finnhub but not for
        # Yahoo, so a Xetra ticker silently fetched a US company.
        assert to_provider_symbol("SAP", "XETRA", "yahoo") == "SAP.DE"
        assert to_provider_symbol("INFY", "NSE", "yahoo") == "INFY.NS"


class TestUnknownExchange:
    def test_bare_ticker_is_the_only_guess_and_only_where_it_works(self):
        assert to_provider_symbol("AAPL", None, "yahoo") == "AAPL"
        assert to_provider_symbol("AAPL", None, "finnhub") == "AAPL"
        # TradingView needs a venue; Stooq needs a country. Neither can be
        # guessed from a bare ticker.
        assert to_provider_symbol("AAPL", None, "tradingview") is None
        assert to_provider_symbol("AAPL", None, "stooq") is None

    def test_unrecognised_exchange_name_is_treated_as_unknown(self):
        assert normalise_exchange("BOGUS") is None
        assert to_provider_symbol("AAPL", "BOGUS", "tradingview") is None

    def test_empty_ticker_resolves_to_nothing(self):
        assert to_provider_symbol("", "TSX", "yahoo") is None

    def test_unknown_provider_is_a_programming_error(self):
        with pytest.raises(ValueError):
            to_provider_symbol("AAPL", "NYSE", "bloomberg")


class TestNormalisation:
    @pytest.mark.parametrize(
        "reported,expected",
        [
            ("TSXV", "TSX-V"),
            ("tsx-v", "TSX-V"),
            ("TSX.V", "TSX-V"),
            ("Venture", "TSX-V"),
            ("PINK", "OTC"),
            ("NMS", "NASDAQ"),
            ("", "US"),
        ],
    )
    def test_aliases_map_onto_canonical_codes(self, reported, expected):
        assert normalise_exchange(reported) == expected

    def test_none_stays_none(self):
        assert normalise_exchange(None) is None


class TestParseSymbol:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("TSXV:GSI", ("GSI", "TSX-V")),
            ("TSX:SHOP", ("SHOP", "TSX")),
            ("GSI.V", ("GSI", "TSX-V")),
            ("SHOP.TO", ("SHOP", "TSX")),
            ("VOD.L", ("VOD", "LSE")),
            ("AAPL", ("AAPL", None)),
            ("aapl", ("AAPL", None)),
            ("", ("", None)),
        ],
    )
    def test_recognises_both_provider_spellings(self, raw, expected):
        assert parse_symbol(raw) == expected

    def test_a_dot_that_is_part_of_the_ticker_is_left_alone(self):
        # BRK.B is not a Yahoo suffix; stripping it would query the wrong stock.
        assert parse_symbol("BRK.B") == ("BRK.B", None)

    def test_round_trips_through_every_provider_spelling(self):
        for code in EXCHANGES:
            for provider in ("finnhub", "yahoo"):
                spelled = to_provider_symbol("TEST", code, provider)
                ticker, exchange = parse_symbol(spelled)
                assert ticker == "TEST"
                # US-style exchanges share an undecorated spelling, so they
                # cannot round-trip to a specific venue — that is the point of
                # resolution, not a parsing failure.
                if EXCHANGES[code].country != "US":
                    assert exchange == code


class TestTableIntegrity:
    def test_every_exchange_spells_every_provider_or_declares_no_coverage(self):
        for code in EXCHANGES:
            symbols = all_provider_symbols("TEST", code)
            assert set(symbols) == set(PROVIDERS)
            assert symbols["yahoo"] and symbols["finnhub"]

    def test_canadian_exchanges_are_the_cad_ones(self):
        cad = {c for c, ex in EXCHANGES.items() if ex.currency == "CAD"}
        assert cad == {"TSX", "TSX-V"}
