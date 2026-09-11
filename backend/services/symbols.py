"""
Ticker → listing resolution.

A ticker on its own is not an identifier. "SHOP" is Shopify on both the TSX and
the NYSE; "GSI" is a TSX Venture miner and also a US-listed company. Anything
that turns a typed ticker into a provider request has to decide which listing
is meant, and the old code decided by consulting a hardcoded map — which is why
a NYSE search result for SHOP still fetched Canadian prices.

This module makes that decision explicit and gives it three possible outcomes:

  resolved   — exactly one listing matches; every provider spelling is derived
               from backend/services/exchanges.py
  ambiguous  — several listings match; the candidates are returned and the
               caller has to choose. Nothing is picked on the user's behalf.
  not_found  — no listing matches; the caller gets a message saying what was
               tried, rather than an empty chart.

Resolutions are cached in Redis. The mapping from ticker to exchange changes
when a company relists, which is to say almost never, so hits are held for a
week. Misses are held for an hour: long enough that a typo does not burn the
Finnhub quota in a loop, short enough that a newly listed ticker appears the
same day.
"""

import json
import logging
from dataclasses import asdict, dataclass, field

import redis.asyncio as aioredis

from backend.config import get_settings
from backend.fetchers.finnhub import FinnhubFetcher
from backend.services.exchanges import (
    all_provider_symbols,
    currency_for,
    normalise_exchange,
    parse_symbol,
)

log = logging.getLogger(__name__)

CACHE_VERSION = "v1"

RESOLVED = "resolved"
AMBIGUOUS = "ambiguous"
NOT_FOUND = "not_found"


@dataclass(frozen=True)
class Candidate:
    """One listing a ticker might refer to."""

    ticker: str
    exchange: str
    name: str = ""


@dataclass
class Resolution:
    status: str
    query: str
    ticker: str = ""
    exchange: str | None = None
    name: str = ""
    currency: str = "USD"
    symbols: dict[str, str | None] = field(default_factory=dict)
    candidates: list[Candidate] = field(default_factory=list)
    message: str = ""
    cached: bool = False

    @property
    def ok(self) -> bool:
        return self.status == RESOLVED

    def to_dict(self) -> dict:
        d = asdict(self)
        d["candidates"] = [asdict(c) for c in self.candidates]
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "Resolution":
        data = dict(d)
        data["candidates"] = [Candidate(**c) for c in data.get("candidates", [])]
        return cls(**data)


def _resolved(query: str, ticker: str, exchange: str, name: str = "") -> Resolution:
    return Resolution(
        status=RESOLVED,
        query=query,
        ticker=ticker,
        exchange=exchange,
        name=name,
        currency=currency_for(exchange),
        symbols=all_provider_symbols(ticker, exchange),
    )


class SymbolResolver:
    """
    Resolves tickers to listings, backed by Finnhub search and cached in Redis.

    The common path costs nothing: search results and stored watchlist entries
    already carry an exchange, and a ticker with a known exchange is resolved
    from the convention table without any network call at all. Only a bare,
    unknown ticker reaches Finnhub.
    """

    def __init__(self, redis: aioredis.Redis, http=None, limiter=None) -> None:
        self._redis = redis
        self._http = http
        self._limiter = limiter
        self._settings = get_settings()

    # ── cache ────────────────────────────────────────────────────────────────

    def _key(self, ticker: str, exchange: str | None) -> str:
        suffix = f"@{exchange}" if exchange else ""
        return f"symbol:{CACHE_VERSION}:{ticker}{suffix}"

    async def _cache_get(self, key: str) -> Resolution | None:
        try:
            raw = await self._redis.get(key)
        except Exception:
            log.warning("Redis unavailable for symbol cache read", exc_info=True)
            return None
        if raw is None:
            await self._incr("misses")
            return None
        await self._incr("hits")
        try:
            resolution = Resolution.from_dict(json.loads(raw))
        except (ValueError, TypeError):
            # A cache entry written by an older shape of this code. Treat it as
            # a miss rather than failing the request.
            log.warning("Discarding unreadable symbol cache entry %s", key)
            return None
        resolution.cached = True
        return resolution

    async def _cache_set(self, key: str, resolution: Resolution) -> None:
        ttl = (
            self._settings.ttl_symbol_resolution
            if resolution.ok
            else self._settings.ttl_symbol_miss
        )
        try:
            await self._redis.setex(key, ttl, json.dumps(resolution.to_dict()))
        except Exception:
            log.warning("Redis unavailable for symbol cache write", exc_info=True)

    async def _incr(self, field_: str) -> None:
        try:
            await self._redis.incr(f"metrics:resolve:{field_}")
        except Exception:
            pass

    async def metrics(self) -> dict:
        try:
            hits = int(await self._redis.get("metrics:resolve:hits") or 0)
            misses = int(await self._redis.get("metrics:resolve:misses") or 0)
        except Exception:
            return {"hits": 0, "misses": 0, "hit_rate": 0.0}
        total = hits + misses
        return {
            "hits": hits,
            "misses": misses,
            "hit_rate": round(hits / total, 4) if total else 0.0,
        }

    # ── resolution ───────────────────────────────────────────────────────────

    async def resolve(self, query: str, exchange: str | None = None) -> Resolution:
        """
        Resolve *query* to a single listing.

        *query* may be a bare ticker ("GSI"), a Finnhub symbol ("TSXV:GSI") or a
        Yahoo symbol ("GSI.V") — whichever the caller happens to hold. An
        explicit *exchange* hint wins over one embedded in the query.
        """
        raw = (query or "").strip().upper()
        if not raw:
            return Resolution(
                status=NOT_FOUND, query=raw, message="No symbol was provided."
            )

        ticker, embedded_exchange = parse_symbol(raw)
        hint = normalise_exchange(exchange) or embedded_exchange

        key = self._key(ticker, hint)
        cached = await self._cache_get(key)
        if cached is not None:
            return cached

        if hint:
            # The exchange is known, so the listing is known: every provider
            # spelling follows from the convention table. No API call.
            resolution = _resolved(raw, ticker, hint)
        else:
            resolution = await self._search(raw, ticker)

        await self._cache_set(key, resolution)
        return resolution

    async def _search(self, query: str, ticker: str) -> Resolution:
        """Ask Finnhub which listings carry this ticker."""
        if self._http is None:
            return Resolution(
                status=NOT_FOUND,
                query=query,
                ticker=ticker,
                message=(
                    f"Cannot resolve {ticker}: no exchange was supplied and symbol "
                    "search is unavailable."
                ),
            )

        if self._limiter is not None and not await self._limiter.consume("finnhub"):
            log.warning("finnhub rate-limited while resolving %s", ticker)
            return Resolution(
                status=NOT_FOUND,
                query=query,
                ticker=ticker,
                message=(
                    f"Cannot resolve {ticker} right now: the symbol search quota is "
                    "exhausted. Add the ticker with its exchange, or try again shortly."
                ),
            )

        results = await FinnhubFetcher(self._http).search(ticker)

        # Only exact ticker matches are candidates. Finnhub's search is fuzzy and
        # will happily return AAPL34.SA for "AAPL"; a near-match is not a listing
        # of the thing that was asked for.
        matches = [r for r in results if (r.get("symbol") or "").upper() == ticker]

        # Collapse duplicate listings of the same exchange, keeping the first
        # name Finnhub gave us.
        by_exchange: dict[str, Candidate] = {}
        for match in matches:
            code = normalise_exchange(match.get("exchange"))
            if code is None or code in by_exchange:
                continue
            by_exchange[code] = Candidate(
                ticker=ticker, exchange=code, name=match.get("name", "")
            )

        candidates = list(by_exchange.values())

        if not candidates:
            return Resolution(
                status=NOT_FOUND,
                query=query,
                ticker=ticker,
                message=(
                    f"No listing found for {ticker}. Check the ticker, or add it with "
                    "an explicit exchange."
                ),
            )

        if len(candidates) == 1:
            only = candidates[0]
            return _resolved(query, only.ticker, only.exchange, only.name)

        venues = ", ".join(c.exchange for c in candidates)
        return Resolution(
            status=AMBIGUOUS,
            query=query,
            ticker=ticker,
            candidates=candidates,
            message=f"{ticker} is listed on more than one exchange ({venues}). Pick one.",
        )
