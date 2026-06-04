"""Stooq fetcher — free chart fallback, no API key required."""

from datetime import datetime, timedelta

import httpx

SOURCE = "stooq"
_RANGE_DAYS = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730}


def _to_stooq_symbol(finnhub_symbol: str) -> str | None:
    if not finnhub_symbol:
        return None
    for prefix, suffix in [("TSX:", ".ca"), ("TSXV:", ".ca"), ("LSE:", ".uk"), ("ASX:", ".au")]:
        if finnhub_symbol.startswith(prefix):
            return finnhub_symbol[len(prefix):].lower() + suffix
    return finnhub_symbol.lower() + ".us"


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
