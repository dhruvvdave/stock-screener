"""GET /api/stock — single quote with Finnhub → Yahoo → Twelve Data fallback."""

import logging

from fastapi import APIRouter

from backend.config import get_settings
from backend.deps import CacheDep, HttpDep, LimiterDep
from backend.fetchers.finnhub import FinnhubFetcher
from backend.fetchers.yahoo import YahooFetcher
from backend.services import cache as cache_res
from backend.validation import Symbol, not_found, rate_limited

log = logging.getLogger(__name__)
router = APIRouter()

_SUFFIXES = [("TSXV:", ".V"), ("TSX:", ".TO"), ("LSE:", ".L"),
             ("ASX:", ".AX"), ("NSE:", ".NS")]


def _finnhub_to_yahoo(symbol: str) -> str:
    for prefix, suffix in _SUFFIXES:
        if symbol.startswith(prefix):
            return symbol[len(prefix):] + suffix
    return symbol


@router.get("/api/stock")
async def get_stock(symbol: Symbol, http: HttpDep, cache: CacheDep, limiter: LimiterDep):
    symbol = symbol.strip().upper()
    exhausted: list[str] = []

    async def fetch():
        settings = get_settings()

        if await limiter.consume("finnhub"):
            await cache.incr_source("finnhub")
            result = await FinnhubFetcher(http).quote(symbol)
            if result:
                return result
        else:
            exhausted.append("finnhub")
            log.warning("finnhub rate-limited for %s", symbol)

        if await limiter.consume("yahoo"):
            await cache.incr_source("yahoo")
            quote = await YahooFetcher(http).quote(_finnhub_to_yahoo(symbol))
            if quote:
                return {
                    "symbol": symbol,
                    "price": quote["regularMarketPrice"],
                    "changePercent": quote.get("regularMarketChangePercent"),
                    "change": quote.get("regularMarketChange"),
                    "volume": quote.get("regularMarketVolume"),
                    "source": "yahoo",
                }
        else:
            exhausted.append("yahoo")
            log.warning("yahoo rate-limited for %s", symbol)

        if settings.twelve_data_key:
            if await limiter.consume("twelvedata"):
                await cache.incr_source("twelvedata")
                price = await _twelve_data_price(http, symbol, settings.twelve_data_key)
                if price is not None:
                    return {"symbol": symbol, "price": price, "changePercent": None,
                            "change": None, "volume": None, "source": "twelvedata"}
            else:
                exhausted.append("twelvedata")

        return None

    result = await cache.get_or_set(symbol, cache_res.QUOTE, fetch)
    if result is not None:
        return result

    # Nothing answered. Distinguish "we were not allowed to ask" from "we
    # asked and this symbol has no quote": only the first is worth retrying.
    if exhausted:
        source = exhausted[0]
        raise rate_limited(source, await limiter.retry_after(source))
    raise not_found(f"No quote found for symbol {symbol}")


async def _twelve_data_price(http, symbol: str, api_key: str) -> float | None:
    td_symbol = ":".join(reversed(symbol.split(":"))) if ":" in symbol else symbol
    try:
        r = await http.get(
            "https://api.twelvedata.com/price",
            params={"symbol": td_symbol, "apikey": api_key},
        )
        if not r.is_success:
            return None
        price = float(r.json().get("price", "nan"))
        return price if price > 0 else None
    except (ValueError, TypeError, KeyError):
        return None
    except Exception:
        log.exception("twelvedata price lookup failed for %s", symbol)
        return None
