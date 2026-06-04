"""GET /api/candle — OHLCV history with Finnhub → Yahoo → Stooq → Twelve Data fallback."""

import logging
from datetime import datetime

from fastapi import APIRouter, Query

from backend.config import get_settings
from backend.deps import CacheDep, HttpDep, LimiterDep
from backend.fetchers.finnhub import FinnhubFetcher
from backend.fetchers.yahoo import YahooFetcher
from backend.fetchers.stooq import StooqFetcher
from backend.services.db import fire_and_forget_write

log = logging.getLogger(__name__)
router = APIRouter()

_VALID_RANGES = {"1mo", "3mo", "6mo", "1y", "2y"}
_RANGE_DAYS = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730}


@router.get("/api/candle")
async def get_candle(
    symbol: str = Query("", description="Yahoo-format symbol (e.g. SHOP.TO)"),
    finnhubSymbol: str = Query("", description="Finnhub-format symbol (e.g. TSX:SHOP)"),
    range: str = Query("1mo"),
    http: HttpDep = None,
    cache: CacheDep = None,
    limiter: LimiterDep = None,
):
    range_ = range if range in _VALID_RANGES else "1mo"
    cache_ticker = (finnhubSymbol or symbol).upper()
    cached = await cache.get(cache_ticker, "any", f"candle:{range_}")
    if cached is not None:
        return cached

    finnhub = FinnhubFetcher(http)
    yahoo = YahooFetcher(http)
    stooq = StooqFetcher(http)
    settings = get_settings()

    # 1. Finnhub
    if finnhubSymbol and await limiter.consume("finnhub"):
        await cache._redis.incr("metrics:source:finnhub:requests")
        result = await finnhub.candle(finnhubSymbol.upper(), range_)
        if result:
            await cache.set(cache_ticker, "finnhub", f"candle:{range_}", result)
            _write_history(cache_ticker, "finnhub", result)
            return result
    elif finnhubSymbol:
        log.warning("finnhub rate-limited on candle for %s", finnhubSymbol)

    # 2. Yahoo Finance
    if symbol and await limiter.consume("yahoo"):
        await cache._redis.incr("metrics:source:yahoo:requests")
        result = await yahoo.candle(symbol, range_)
        if result:
            await cache.set(cache_ticker, "yahoo", f"candle:{range_}", result)
            _write_history(cache_ticker, "yahoo", result)
            return result
    elif symbol:
        log.warning("yahoo rate-limited on candle for %s", symbol)

    # 3. Stooq
    if finnhubSymbol and await limiter.consume("stooq"):
        await cache._redis.incr("metrics:source:stooq:requests")
        result = await stooq.candle(finnhubSymbol.upper(), range_)
        if result:
            rows = result.pop("_rows", [])
            await cache.set(cache_ticker, "stooq", f"candle:{range_}", result)
            fire_and_forget_write(cache_ticker, "stooq", rows)
            return result
    elif finnhubSymbol:
        log.warning("stooq rate-limited on candle for %s", finnhubSymbol)

    # 4. Twelve Data
    if settings.twelve_data_key and finnhubSymbol and await limiter.consume("twelvedata"):
        await cache._redis.incr("metrics:source:twelvedata:requests")
        td_sym = ":".join(reversed(finnhubSymbol.upper().split(":"))) if ":" in finnhubSymbol else finnhubSymbol
        try:
            r = await http.get(
                "https://api.twelvedata.com/time_series",
                params={"symbol": td_sym, "interval": "1day",
                        "outputsize": _RANGE_DAYS.get(range_, 30),
                        "apikey": settings.twelve_data_key},
            )
            if r.is_success:
                values = r.json().get("values", [])
                if len(values) >= 3:
                    prices = [float(v["close"]) for v in reversed(values) if v.get("close")]
                    if prices:
                        result = {"prices": prices, "lastClose": prices[-1], "source": "twelvedata"}
                        await cache.set(cache_ticker, "twelvedata", f"candle:{range_}", result)
                        return result
        except Exception:
            pass

    return {"prices": None}


def _write_history(ticker: str, source: str, result: dict) -> None:
    ohlcv = result.get("ohlcv", [])
    timestamps = result.get("timestamps", [])
    if not ohlcv or not timestamps:
        return
    rows = []
    for i, bar in enumerate(ohlcv):
        if i >= len(timestamps):
            break
        rows.append({
            "timestamp": datetime.utcfromtimestamp(timestamps[i]),
            "open": bar.get("o"),
            "high": bar.get("h"),
            "low": bar.get("l"),
            "close": bar["c"],
            "volume": bar.get("v"),
        })
    fire_and_forget_write(ticker, source, rows)
