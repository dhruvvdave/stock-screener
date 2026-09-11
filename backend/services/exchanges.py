"""
Exchange conventions — the single place that knows how each provider spells a
listing.

The thing this replaces was a per-ticker map: {"SHOP": "SHOP.TO", "CNQ":
"CNQ.TO", ...}, maintained by hand, one entry per stock anyone ever looked at.
That does not scale and it is wrong for dual-listed tickers, because a ticker
alone cannot tell you which exchange is meant.

What lives here instead is per-*exchange* convention: TSX listings take a .TO
suffix on Yahoo and a TSX: prefix on Finnhub. That is a dozen rows that change
approximately never, and the ticker is not part of it. Given a ticker and its
exchange, every provider's spelling is derived rather than looked up.

Adding an exchange means one row here. Nothing else in the codebase should
contain a suffix or prefix literal.
"""

from dataclasses import dataclass

# Providers whose symbol format we derive. Keep in step with the fetchers.
PROVIDERS = ("finnhub", "yahoo", "stooq", "tradingview", "twelvedata")


@dataclass(frozen=True)
class Exchange:
    """How one exchange is addressed by each provider.

    `stooq_suffix` is None where Stooq has no coverage. That is deliberate: the
    previous converter defaulted every unrecognised exchange to Stooq's US
    suffix, so an NSE listing became "nse:infy.us" — a query for a *different*
    company on a different continent, returned as if it were the right answer.
    Absent coverage has to be absent, not approximated.
    """

    code: str
    name: str
    country: str
    currency: str
    yahoo_suffix: str
    finnhub_prefix: str
    tv_prefix: str
    stooq_suffix: str | None


# Canonical exchange codes are the ones produced by
# backend/fetchers/finnhub.py:_resolve_exchange, which normalises whatever
# Finnhub reports into this vocabulary.
EXCHANGES: dict[str, Exchange] = {
    "NYSE": Exchange(
        code="NYSE", name="New York Stock Exchange", country="US", currency="USD",
        yahoo_suffix="", finnhub_prefix="", tv_prefix="NYSE:", stooq_suffix=".us",
    ),
    "NASDAQ": Exchange(
        code="NASDAQ", name="Nasdaq", country="US", currency="USD",
        yahoo_suffix="", finnhub_prefix="", tv_prefix="NASDAQ:", stooq_suffix=".us",
    ),
    "AMEX": Exchange(
        code="AMEX", name="NYSE American", country="US", currency="USD",
        yahoo_suffix="", finnhub_prefix="", tv_prefix="AMEX:", stooq_suffix=".us",
    ),
    "OTC": Exchange(
        code="OTC", name="OTC Markets", country="US", currency="USD",
        yahoo_suffix="", finnhub_prefix="", tv_prefix="OTC:", stooq_suffix=".us",
    ),
    # "US" is what the app records when it knows the listing is American but not
    # which venue. US symbols need no decoration, so this resolves correctly for
    # every provider except TradingView, which wants a real venue.
    "US": Exchange(
        code="US", name="United States", country="US", currency="USD",
        yahoo_suffix="", finnhub_prefix="", tv_prefix="", stooq_suffix=".us",
    ),
    "TSX": Exchange(
        code="TSX", name="Toronto Stock Exchange", country="CA", currency="CAD",
        yahoo_suffix=".TO", finnhub_prefix="TSX:", tv_prefix="TSX:", stooq_suffix=".ca",
    ),
    "TSX-V": Exchange(
        code="TSX-V", name="TSX Venture Exchange", country="CA", currency="CAD",
        yahoo_suffix=".V", finnhub_prefix="TSXV:", tv_prefix="TSXV:", stooq_suffix=".ca",
    ),
    "LSE": Exchange(
        code="LSE", name="London Stock Exchange", country="GB", currency="GBP",
        yahoo_suffix=".L", finnhub_prefix="LSE:", tv_prefix="LSE:", stooq_suffix=".uk",
    ),
    "ASX": Exchange(
        code="ASX", name="Australian Securities Exchange", country="AU", currency="AUD",
        yahoo_suffix=".AX", finnhub_prefix="ASX:", tv_prefix="ASX:", stooq_suffix=None,
    ),
    "XETRA": Exchange(
        code="XETRA", name="Xetra", country="DE", currency="EUR",
        yahoo_suffix=".DE", finnhub_prefix="XETRA:", tv_prefix="XETRA:", stooq_suffix=".de",
    ),
    "NSE": Exchange(
        code="NSE", name="National Stock Exchange of India", country="IN", currency="INR",
        yahoo_suffix=".NS", finnhub_prefix="NSE:", tv_prefix="NSE:", stooq_suffix=None,
    ),
}

# Spellings seen in the wild that mean one of the codes above.
_ALIASES = {
    "TSXV": "TSX-V",
    "TSX.V": "TSX-V",
    "TSX VENTURE": "TSX-V",
    "VENTURE": "TSX-V",
    "TORONTO": "TSX",
    "NYSE AMERICAN": "AMEX",
    "NYSE MKT": "AMEX",
    "PINK": "OTC",
    "OTCMARKETS": "OTC",
    "NMS": "NASDAQ",
    "NYQ": "NYSE",
    "": "US",
}

CAD_EXCHANGES = frozenset(
    code for code, ex in EXCHANGES.items() if ex.currency == "CAD"
)


def normalise_exchange(exchange: str | None) -> str | None:
    """Map a reported exchange name onto a canonical code, or None if unknown."""
    if exchange is None:
        return None
    key = exchange.strip().upper()
    key = _ALIASES.get(key, key)
    return key if key in EXCHANGES else None


def get_exchange(exchange: str | None) -> Exchange | None:
    code = normalise_exchange(exchange)
    return EXCHANGES[code] if code else None


def parse_symbol(raw: str) -> tuple[str, str | None]:
    """
    Split a decorated symbol into (ticker, exchange code).

    Accepts what the app actually passes around — a Finnhub prefix ("TSXV:GSI"),
    a Yahoo suffix ("GSI.V", "SHOP.TO"), or a bare ticker. Returns a None
    exchange when the input carries no exchange information, which is the
    signal that the ticker has to be resolved rather than decorated.
    """
    symbol = (raw or "").strip().upper()
    if not symbol:
        return "", None

    if ":" in symbol:
        prefix, _, ticker = symbol.partition(":")
        for ex in EXCHANGES.values():
            if ex.finnhub_prefix and ex.finnhub_prefix.rstrip(":") == prefix:
                return ticker, ex.code
        # An unrecognised prefix is still an exchange claim we cannot honour;
        # keep the ticker and report the exchange as unknown.
        return ticker, None

    if "." in symbol:
        ticker, _, suffix = symbol.rpartition(".")
        for ex in EXCHANGES.values():
            if ex.yahoo_suffix and ex.yahoo_suffix.lstrip(".") == suffix:
                return ticker, ex.code
        # Tickers legitimately contain dots (BRK.B), so fall through rather
        # than stripping something that is part of the name.
        return symbol, None

    return symbol, None


def to_provider_symbol(ticker: str, exchange: str | None, provider: str) -> str | None:
    """
    Spell *ticker* the way *provider* expects it, or None if that provider
    cannot address this listing.

    None is a real answer — Stooq has no Australian coverage, and returning a
    plausible-looking symbol for a market a provider does not carry is how you
    end up charting the wrong company.
    """
    ticker = (ticker or "").strip().upper()
    if not ticker:
        return None
    if provider not in PROVIDERS:
        raise ValueError(f"unknown provider: {provider}")

    ex = get_exchange(exchange)
    if ex is None:
        # No exchange, no decoration: the bare ticker is the only honest guess,
        # and only US-style providers will accept it.
        return ticker if provider in ("finnhub", "yahoo", "twelvedata") else None

    if provider == "finnhub":
        return f"{ex.finnhub_prefix}{ticker}"
    if provider == "yahoo":
        return f"{ticker}{ex.yahoo_suffix}"
    if provider == "tradingview":
        return f"{ex.tv_prefix}{ticker}" if ex.tv_prefix else ticker
    if provider == "stooq":
        if ex.stooq_suffix is None:
            return None
        return f"{ticker.lower()}{ex.stooq_suffix}"
    if provider == "twelvedata":
        # Twelve Data takes SYMBOL:EXCHANGE, the mirror of Finnhub's prefix
        # form. US listings are addressed bare.
        venue = ex.finnhub_prefix.rstrip(":")
        return f"{ticker}:{venue}" if venue else ticker
    return None


def all_provider_symbols(ticker: str, exchange: str | None) -> dict[str, str | None]:
    """Every provider spelling for one listing, keyed by provider name."""
    return {p: to_provider_symbol(ticker, exchange, p) for p in PROVIDERS}


def currency_for(exchange: str | None) -> str:
    ex = get_exchange(exchange)
    return ex.currency if ex else "USD"
