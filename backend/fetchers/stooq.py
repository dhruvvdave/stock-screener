"""Stooq fetcher — free chart fallback, no API key required."""

from datetime import datetime, timedelta

import httpx

from backend.services.exchanges import parse_symbol, to_provider_symbol

SOURCE = "stooq"
_RANGE_DAYS = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730}


def _to_stooq_symbol(finnhub_symbol: str) -> str | None:
    """
    Stooq spelling for a Finnhub symbol, or None where Stooq has no coverage.

    The previous version appended Stooq's US suffix to anything it did not
    recognise, so "NSE:INFY" became "nse:infy.us" — a query for a different
    company entirely. Returning None lets the router fall through to the next
    source instead of charting the wrong stock.
    """
    if not finnhub_symbol:
        return None
    ticker, exchange = parse_symbol(finnhub_symbol)
    if exchange is None:
        # A bare ticker with no exchange claim is a US listing as far as the
        # rest of the app is concerned.
        return f"{ticker.lower()}.us" if ticker else None
    return to_provider_symbol(ticker, exchange, "stooq")


class StooqFetcher:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def candle(self, finnhub_symbol: str, range_: str = "1mo") -> dict | None:
        stooq_sym = _to_stooq_symbol(finnhub_symbol)
        if not stooq_sym:
            return None
        days = _RANGE_DAYS.get(range_, 30)
        end = datetime.utcnow()
        start = end - timedelta(days=days)
        fmt = lambda d: d.strftime("%Y%m%d")
        try:
            r = await self._client.get(
                "https://stooq.com/q/d/l/",
                params={"s": stooq_sym, "d1": fmt(start), "d2": fmt(end), "i": "d"},
            )
            if not r.is_success:
                return None
            lines = r.text.strip().splitlines()
            if len(lines) < 2:
                return None
            rows = []
            for line in lines[1:]:
                cols = line.split(",")
                try:
                    rows.append({
                        "timestamp": datetime.strptime(cols[0], "%Y-%m-%d"),
                        "open": float(cols[1]),
                        "high": float(cols[2]),
                        "low": float(cols[3]),
                        "close": float(cols[4]),
                        "volume": float(cols[5]) if len(cols) > 5 else None,
                    })
                except (ValueError, IndexError):
                    continue
            if len(rows) < 3:
                return None
            prices = [r["close"] for r in rows]
            last = rows[-1]
            return {
                "prices": prices,
                "ohlcv": [{"o": r["open"], "h": r["high"], "l": r["low"],
                           "c": r["close"], "v": r["volume"]} for r in rows],
                "timestamps": [int(r["timestamp"].timestamp()) for r in rows],
                "lastClose": prices[-1],
                "dayHigh": last["high"],
                "dayLow": last["low"],
                "source": SOURCE,
                "_rows": rows,   # used for history writes
            }
        except Exception:
            return None
