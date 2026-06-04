"""Alpha Vantage fetcher — OVERVIEW and TIME_SERIES_DAILY."""

import httpx

from backend.config import get_settings

SOURCE = "alphavantage"
_BASE = "https://www.alphavantage.co/query"


class AlphaVantageFetcher:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    @property
    def _key(self) -> str:
        return get_settings().av_key

    async def overview(self, symbol: str) -> dict | None:
        if not self._key:
            return None
        bare = symbol.split(".")[0]
        try:
            r = await self._client.get(
                _BASE,
                params={"function": "OVERVIEW", "symbol": bare, "apikey": self._key},
            )
            if not r.is_success:
                return None
            d = r.json()
            if d.get("Note") or d.get("Error Message") or d.get("Information") or not d.get("Symbol"):
                return None

            def n(v):
                try:
                    x = float(v)
                    return None if x != x else x  # NaN check
                except (TypeError, ValueError):
                    return None

            def pct(v):
                x = n(v)
                return round(x * 100, 1) if x is not None else None

            return {
                "sector": d.get("Sector") or None,
                "industry": d.get("Industry") or None,
                "description": d.get("Description") or None,
                "beta": n(d.get("Beta")),
                "peRatio": n(d.get("PERatio")),
                "forwardPE": n(d.get("ForwardPE")),
                "pegRatio": n(d.get("PEGRatio")),
                "priceToBook": n(d.get("PriceToBookRatio")),
                "priceToSales": n(d.get("PriceToSalesRatioTTM")),
                "evToEbitda": n(d.get("EVToEBITDA")),
                "dividendYield": round(n(d.get("DividendYield")) * 100, 2) if n(d.get("DividendYield")) else None,
                "eps": n(d.get("EPS")),
                "bookValue": n(d.get("BookValue")),
                "analystTarget": n(d.get("AnalystTargetPrice")),
                "high52w": n(d.get("52WeekHigh")),
                "low52w": n(d.get("52WeekLow")),
                "operatingMargin": pct(d.get("OperatingMarginTTM")),
                "profitMargin": pct(d.get("ProfitMargin")),
                "roe": pct(d.get("ReturnOnEquityTTM")),
                "roa": pct(d.get("ReturnOnAssetsTTM")),
                "revenueTTM": round(n(d.get("RevenueTTM")) / 1e9, 2) if n(d.get("RevenueTTM")) else None,
                "revenuePerShare": n(d.get("RevenuePerShareTTM")),
            }
        except Exception:
            return None

    async def daily(self, symbol: str, outputsize: str = "compact") -> list[dict] | None:
        """Return list of {timestamp, open, high, low, close, volume} dicts, newest first."""
        if not self._key:
            return None
        bare = symbol.split(".")[0]
        try:
            r = await self._client.get(
                _BASE,
                params={
                    "function": "TIME_SERIES_DAILY",
                    "symbol": bare,
                    "outputsize": outputsize,
                    "apikey": self._key,
                },
            )
            if not r.is_success:
                return None
            d = r.json()
            series = d.get("Time Series (Daily)")
            if not series:
                return None
            from datetime import datetime
            rows = []
            for date_str, vals in sorted(series.items(), reverse=True):
                rows.append({
                    "timestamp": datetime.strptime(date_str, "%Y-%m-%d"),
                    "open": float(vals.get("1. open", 0)),
                    "high": float(vals.get("2. high", 0)),
                    "low": float(vals.get("3. low", 0)),
                    "close": float(vals.get("4. close", 0)),
                    "volume": float(vals.get("5. volume", 0)),
                })
            return rows or None
        except Exception:
            return None
