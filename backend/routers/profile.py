"""GET /api/profile — company profile merged from Yahoo and Finnhub."""

import asyncio

from fastapi import APIRouter

from backend.deps import CacheDep, HttpDep, LimiterDep
from backend.fetchers.finnhub import FinnhubFetcher
from backend.fetchers.yahoo import YahooFetcher
from backend.services import cache as cache_res
from backend.validation import OptionalSymbol, not_found

router = APIRouter()


def _ok(value):
    """Treat a failed leg as absent so one bad source cannot fail the merge."""
    return value if isinstance(value, dict) else {}


@router.get("/api/profile")
async def get_profile(
    http: HttpDep,
    cache: CacheDep,
    limiter: LimiterDep,
    symbol: OptionalSymbol = "",
    finnhubSymbol: OptionalSymbol = "",  # noqa: N803 — query name the frontend sends
):
    ticker = (finnhubSymbol or symbol).upper()
    if not ticker:
        raise not_found("Provide symbol or finnhubSymbol")

    async def fetch():
        yahoo = YahooFetcher(http)
        yahoo_ok = bool(symbol) and await limiter.consume("yahoo")
        finnhub_ok = bool(finnhubSymbol) and await limiter.consume("finnhub")

        if yahoo_ok:
            await cache.incr_source("yahoo")
        if finnhub_ok:
            await cache.incr_source("finnhub")

        summary, quote, finnhub_profile = await asyncio.gather(
            yahoo.quote_summary(symbol, "assetProfile") if yahoo_ok else _empty(),
            yahoo.quote(symbol) if yahoo_ok else _empty(),
            FinnhubFetcher(http).profile(finnhubSymbol.upper()) if finnhub_ok else _empty(),
            return_exceptions=True,
        )

        asset_profile = _ok(_ok(summary).get("assetProfile"))
        quote = _ok(quote)
        finnhub_profile = _ok(finnhub_profile)

        return {
            "companyName": (finnhub_profile.get("name") or quote.get("longName")
                            or quote.get("shortName") or symbol or ticker),
            "sector": asset_profile.get("sector") or finnhub_profile.get("finnhubIndustry"),
            "description": asset_profile.get("longBusinessSummary"),
            "logo": finnhub_profile.get("logo"),
            "website": finnhub_profile.get("weburl") or asset_profile.get("website"),
        }

    return await cache.get_or_set(
        ticker, cache_res.PROFILE, fetch,
        # A profile with nothing but the ticker echoed back is not worth
        # holding for a day.
        should_cache=lambda v: bool(v and (v.get("sector") or v.get("description"))),
    )


async def _empty():
    return {}
