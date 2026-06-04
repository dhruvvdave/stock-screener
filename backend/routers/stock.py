"""GET /api/stock — single quote with Finnhub → Yahoo → Twelve Data fallback."""

import logging

import redis.asyncio as aioredis
from fastapi import APIRouter, HTTPException, Query

from backend.deps import CacheDep, HttpDep, LimiterDep
from backend.fetchers.finnhub import FinnhubFetcher
from backend.fetchers.yahoo import YahooFetcher
from backend.config import get_settings

log = logging.getLogger(__name__)
router = APIRouter()

_RESOLUTION = "quote"


def _finnhub_to_yahoo(symbol: str) -> str:
    for prefix, suffix in [("TSXV:", ".V"), ("TSX:", ".TO"), ("LSE:", ".L"),
                            ("ASX:", ".AX"), ("NSE:", ".NS")]:
        if symbol.startswith(prefix):
            return symbol[len(prefix):] + suffix
    return symbol


@router.get("/api/stock")
async def get_stock(
    symbol: str = Query(..., min_length=1),
    http: HttpDep = None,
    cache: CacheDep = None,
    limiter: LimiterDep = None,
):
    symbol = symbol.strip().upper()
    cached = await cache.get(symbol, "any", _RESOLUTION)
    if cached is not None:
        return cached

    finnhub = FinnhubFetcher(http)
    yahoo = YahooFetcher(http)

    # 1. Finnhub
    if await limiter.consume("finnhub"):
        await _incr_source(cache._redis, "finnhub")
        result = await finnhub.quote(symbol)
        if result:
            await cache.set(symbol, "finnhub", _RESOLUTION, result)
            return result
    else:
        log.warning("finnhub rate-limited for %s", symbol)

    # 2. Yahoo Finance
    if await limiter.consume("yahoo"):
        await _incr_source(cache._redis, "yahoo")
        yahoo_sym = _finnhub_to_yahoo(symbol)
        q = await yahoo.quote(yahoo_sym)
        if q:
            result = {
                "symbol": symbol,
                "price": q["regularMarketPrice"],
                "changePercent": q.get("regularMarketChangePercent"),
                "change": q.get("regularMarketChange"),
                "volume": q.get("regularMarketVolume"),
            }
            await cache.set(symbol, "yahoo", _RESOLUTION, result)
            return result
    else:
        log.warning("yahoo rate-limited for %s", symbol)

    # 3. Twelve Data
    settings = get_settings()
    if settings.twelve_data_key and await limiter.consume("twelvedata"):
        await _incr_source(cache._redis, "twelvedata")
        td_sym = ":".join(reversed(symbol.split(":"))) if ":" in symbol else symbol
        try:
            r = await http.get(
                "https://api.twelvedata.com/price",
                params={"symbol": td_sym, "apikey": settings.twelve_data_key},
            )
            if r.is_success:
                price = float(r.json().get("price", "nan"))
                if price > 0:
                    result = {"symbol": symbol, "price": price,
                              "changePercent": None, "change": None, "volume": None}
                    await cache.set(symbol, "twelvedata", _RESOLUTION, result)
                    return result
        except Exception:
            pass
    else:
        log.warning("twelvedata rate-limited or unconfigured for %s", symbol)

    raise HTTPException(status_code=404, detail=f"No quote found for symbol {symbol}")


async def _incr_source(redis: aioredis.Redis, source: str) -> None:
    await redis.incr(f"metrics:source:{source}:requests")
