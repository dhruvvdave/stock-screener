"""GET /api/candle — OHLCV history with Finnhub → Yahoo → Stooq → Twelve Data fallback."""

import logging
from datetime import UTC, datetime

from fastapi import APIRouter

from backend.config import get_settings
from backend.deps import CacheDep, HttpDep, LimiterDep
from backend.fetchers.finnhub import FinnhubFetcher
from backend.fetchers.stooq import StooqFetcher
from backend.fetchers.yahoo import YahooFetcher
from backend.services import cache as cache_res
from backend.services.db import queue_price_history_write
from backend.validation import CandleRange, OptionalSymbol, not_found, rate_limited

log = logging.getLogger(__name__)
router = APIRouter()

_RANGE_DAYS = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730}


@router.get("/api/candle")
async def get_candle(
    http: HttpDep,
    cache: CacheDep,
    limiter: LimiterDep,
    symbol: OptionalSymbol = "",
    finnhubSymbol: OptionalSymbol = "",  # noqa: N803 — query name the frontend sends
    range: CandleRange = "1mo",  # noqa: A002 — query name the frontend sends
):
    window = range
    ticker = (finnhubSymbol or symbol).upper()
    if not ticker:
        raise not_found("Provide symbol or finnhubSymbol")

    exhausted: list[str] = []

    async def fetch():
        settings = get_settings()

        if finnhubSymbol:
            if await limiter.consume("finnhub"):
                await cache.incr_source("finnhub")
                result = await FinnhubFetcher(http).candle(finnhubSymbol.upper(), window)
                if result:
                    _queue_history(ticker, "finnhub", result)
                    return result
            else:
                exhausted.append("finnhub")

        if symbol:
            if await limiter.consume("yahoo"):
                await cache.incr_source("yahoo")
                result = await YahooFetcher(http).candle(symbol, window)
                if result:
                    _queue_history(ticker, "yahoo", result)
                    return result
            else:
                exhausted.append("yahoo")

        if finnhubSymbol:
            if await limiter.consume("stooq"):
                await cache.incr_source("stooq")
                result = await StooqFetcher(http).candle(finnhubSymbol.upper(), window)
                if result:
                    # Stooq already parsed rows for us; they travel out of
                    # band so they never reach the cached payload.
                    queue_price_history_write(ticker, "stooq", result.pop("_rows", []))
                    return result
            else:
                exhausted.append("stooq")

        if settings.twelve_data_key and finnhubSymbol:
            if await limiter.consume("twelvedata"):
                await cache.incr_source("twelvedata")
                result = await _twelve_data_candle(
                    http, finnhubSymbol, window, settings.twelve_data_key
                )
                if result:
                    return result
            else:
                exhausted.append("twelvedata")

        return None

    result = await cache.get_or_set(ticker, cache_res.candle(window), fetch)
    if result is not None:
        return result

    if exhausted:
        source = exhausted[0]
        raise rate_limited(source, await limiter.retry_after(source))
    raise not_found(f"No price history found for {ticker}")


async def _twelve_data_candle(http, finnhub_symbol: str, window: str, api_key: str):
    td_symbol = (
        ":".join(reversed(finnhub_symbol.upper().split(":")))
        if ":" in finnhub_symbol else finnhub_symbol
    )
    try:
        r = await http.get(
            "https://api.twelvedata.com/time_series",
            params={"symbol": td_symbol, "interval": "1day",
                    "outputsize": _RANGE_DAYS.get(window, 30), "apikey": api_key},
        )
        if not r.is_success:
            return None
        values = r.json().get("values", [])
        if len(values) < 3:
            return None
        prices = [float(v["close"]) for v in reversed(values) if v.get("close")]
        if not prices:
            return None
        return {"prices": prices, "lastClose": prices[-1], "source": "twelvedata"}
    except (ValueError, TypeError, KeyError):
        return None
    except Exception:
        log.exception("twelvedata candle lookup failed for %s", finnhub_symbol)
        return None


def _queue_history(ticker: str, source: str, result: dict) -> None:
    """Turn a candle payload into price_history rows and hand them off."""
    ohlcv = result.get("ohlcv") or []
    timestamps = result.get("timestamps") or []
    rows = [
        {
            "timestamp": datetime.fromtimestamp(ts, tz=UTC).replace(tzinfo=None),
            "open": bar.get("o"),
            "high": bar.get("h"),
            "low": bar.get("l"),
            "close": bar["c"],
            "volume": bar.get("v"),
        }
        for bar, ts in zip(ohlcv, timestamps, strict=False)
        if bar.get("c") is not None
    ]
    queue_price_history_write(ticker, source, rows)
