"""Finnhub fetcher — primary source for quotes, candles, search, analyst."""

from datetime import date, timedelta

import httpx

from backend.config import get_settings

SOURCE = "finnhub"
_BASE = "https://finnhub.io/api/v1"

RANGE_DAYS = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730}


def _finnhub_to_yahoo(symbol: str) -> str:
    for prefix, suffix in [("TSXV:", ".V"), ("TSX:", ".TO"), ("LSE:", ".L"),
                            ("ASX:", ".AX"), ("NSE:", ".NS")]:
        if symbol.startswith(prefix):
            return symbol[len(prefix):] + suffix
    return symbol


class FinnhubFetcher:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    @property
    def _key(self) -> str:
        return get_settings().finnhub_key

    async def quote(self, symbol: str) -> dict | None:
        if not self._key:
            return None
        try:
            r = await self._client.get(
                f"{_BASE}/quote",
                params={"symbol": symbol, "token": self._key},
            )
            if not r.is_success:
                return None
            d = r.json()
            if not isinstance(d.get("c"), (int, float)) or d["c"] <= 0:
                return None
            return {
                "symbol": symbol,
                "price": d["c"],
                "change": d.get("d"),
                "changePercent": d.get("dp"),
                "high": d.get("h"),
                "low": d.get("l"),
                "open": d.get("o"),
                "previousClose": d.get("pc"),
                "timestamp": d.get("t"),
                "volume": d.get("v"),
            }
        except Exception:
            return None

    async def candle(self, symbol: str, range_: str = "1mo") -> dict | None:
        if not self._key:
            return None
        import time
        now = int(time.time())
        from_ = now - RANGE_DAYS.get(range_, 30) * 86400
        try:
            r = await self._client.get(
                f"{_BASE}/stock/candle",
                params={"symbol": symbol, "resolution": "D",
                        "from": from_, "to": now, "token": self._key},
            )
            if not r.is_success:
                return None
            d = r.json()
            if d.get("s") != "ok" or not isinstance(d.get("c"), list) or len(d["c"]) < 3:
                return None
            ohlcv = [
                {"o": o, "h": h, "l": l, "c": c, "v": v}
                for o, h, l, c, v in zip(
                    d.get("o", []), d.get("h", []), d.get("l", []),
                    d["c"], d.get("v", [])
                )
            ]
            return {
                "prices": d["c"],
                "ohlcv": ohlcv,
                "timestamps": d.get("t"),
                "lastClose": d["c"][-1],
                "source": SOURCE,
            }
        except Exception:
            return None

    async def search(self, query: str) -> list[dict]:
        if not self._key:
            return []
        allowed = {"Common Stock", "EQS", "ADR", "ETF"}
        try:
            r = await self._client.get(
                f"{_BASE}/search",
                params={"q": query, "token": self._key},
            )
            if not r.is_success:
                return []
            items = r.json().get("result", [])
            results = []
            for s in items:
                if s.get("type") not in allowed:
                    continue
                ds = s.get("displaySymbol", "")
                symbol = ds.split(":")[-1] if ":" in ds else ds
                exch = _resolve_exchange(s)
                results.append({"symbol": symbol, "name": s.get("description", ""), "exchange": exch})
            return results[:12]
        except Exception:
            return []

    async def profile(self, symbol: str) -> dict | None:
        if not self._key:
            return None
        try:
            r = await self._client.get(
                f"{_BASE}/stock/profile2",
                params={"symbol": symbol, "token": self._key},
            )
            if not r.is_success:
                return None
            d = r.json()
            return d if d.get("name") else None
        except Exception:
            return None

    async def analyst(self, symbol: str) -> dict:
        empty = {"buy": 0, "hold": 0, "sell": 0, "total": 0,
                 "meanTarget": None, "highTarget": None, "lowTarget": None,
                 "bullish": None, "bearish": None, "articles": 0}
        if not self._key:
            return empty
        try:
            import asyncio
            rec_r, tgt_r, sent_r = await asyncio.gather(
                self._client.get(f"{_BASE}/stock/recommendation",
                                 params={"symbol": symbol, "token": self._key}),
                self._client.get(f"{_BASE}/stock/price-target",
                                 params={"symbol": symbol, "token": self._key}),
                self._client.get(f"{_BASE}/news-sentiment",
                                 params={"symbol": symbol, "token": self._key}),
            )
            rec = rec_r.json() if rec_r.is_success else []
            tgt = tgt_r.json() if tgt_r.is_success else {}
            sent = sent_r.json() if sent_r.is_success else {}
            latest = sorted(rec, key=lambda x: x.get("period", ""), reverse=True)[0] if rec else None
            return {
                "buy": (latest.get("buy") or 0) + (latest.get("strongBuy") or 0) if latest else 0,
                "hold": latest.get("hold") or 0 if latest else 0,
                "sell": (latest.get("sell") or 0) + (latest.get("strongSell") or 0) if latest else 0,
                "total": sum([
                    (latest.get("buy") or 0), (latest.get("strongBuy") or 0),
                    (latest.get("hold") or 0), (latest.get("sell") or 0),
                    (latest.get("strongSell") or 0),
                ]) if latest else 0,
                "meanTarget": tgt.get("targetMean"),
                "highTarget": tgt.get("targetHigh"),
                "lowTarget": tgt.get("targetLow"),
                "bullish": sent.get("sentiment", {}).get("bullishPercent"),
                "bearish": sent.get("sentiment", {}).get("bearishPercent"),
                "articles": sent.get("buzz", {}).get("articlesInLastWeek") or 0,
            }
        except Exception:
            return empty

    async def metrics(self, symbol: str) -> dict | None:
        if not self._key:
            return None
        try:
            r = await self._client.get(
                f"{_BASE}/stock/metric",
                params={"symbol": symbol, "metric": "all", "token": self._key},
            )
            if not r.is_success:
                return None
            m = r.json().get("metric", {})
            mkt = m.get("marketCapitalization")
            return {
                "pe": m.get("peTTM") or m.get("peAnnual"),
                "pb": m.get("pbAnnual") or m.get("pbQuarterly"),
                "beta": m.get("beta"),
                "mktCap": round(mkt / 1000, 2) if mkt is not None else None,
                "epsGrowth": m.get("epsGrowthTTMYoy") or m.get("epsGrowthQuarterlyYoy"),
                "revGrowth": m.get("revenueGrowthTTMYoy") or m.get("revenueGrowthQuarterlyYoy"),
                "dividendYield": m.get("dividendYieldIndicatedAnnual") or m.get("currentDividendYieldTTM"),
                "high52w": m.get("52WeekHigh"),
                "low52w": m.get("52WeekLow"),
                "avgVol": m.get("10DayAverageTradingVolume"),
            }
        except Exception:
            return None

    async def news(self, symbol: str) -> list[dict] | None:
        if not self._key:
            return None
        today = date.today()
        from_ = (today - timedelta(days=7)).isoformat()
        try:
            r = await self._client.get(
                f"{_BASE}/company-news",
                params={"symbol": symbol, "from": from_,
                        "to": today.isoformat(), "token": self._key},
            )
            if not r.is_success:
                return None
            items = r.json()
            if not isinstance(items, list) or not items:
                return None
            return [
                {
                    "title": item.get("headline", ""),
                    "publisher": item.get("source", ""),
                    "link": item.get("url"),
                    "publishedAt": item.get("datetime"),
                }
                for item in items[:5]
            ]
        except Exception:
            return None


def _resolve_exchange(item: dict) -> str:
    ds = item.get("displaySymbol", "")
    for prefix, name in [("TSXV:", "TSX-V"), ("TSX:", "TSX"), ("LSE:", "LSE"),
                          ("ASX:", "ASX"), ("XETRA:", "XETRA"), ("NSE:", "NSE")]:
        if ds.startswith(prefix):
            return name
    exch = (item.get("primaryExch") or item.get("exchange") or "").upper()
    if "TORONTO" in exch or exch == "TSX":
        return "TSX"
    if "VENTURE" in exch or exch == "TSXV":
        return "TSX-V"
    if "NEW YORK" in exch or exch == "NYSE":
        return "NYSE"
    if "NASDAQ" in exch:
        return "NASDAQ"
    if "AMEX" in exch:
        return "AMEX"
    if "OTC" in exch or exch == "PINK":
        return "OTC"
    if "LONDON" in exch or exch == "LSE":
        return "LSE"
    return exch or "US"
