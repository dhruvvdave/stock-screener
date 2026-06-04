"""Yahoo Finance HTTP fetcher (no API key required)."""

import httpx

FULL_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
_HEADERS = {
    "User-Agent": FULL_UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}
_QUOTE_FIELDS = ",".join([
    "regularMarketPrice", "regularMarketChangePercent", "regularMarketVolume",
    "regularMarketChange", "averageDailyVolume10Day", "marketCap", "trailingPE",
    "priceToBook", "beta", "fiftyTwoWeekHigh", "fiftyTwoWeekLow",
    "trailingAnnualDividendYield", "earningsTimestampStart", "earningsTimestamp",
    "earningsGrowth", "revenueGrowth", "forwardPE", "longName", "shortName",
])

SOURCE = "yahoo"


class YahooFetcher:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def quote(self, symbol: str) -> dict | None:
        """Single quote. symbol is Yahoo format (e.g. SHOP.TO)."""
        for host in ("query1", "query2"):
            try:
                r = await self._client.get(
                    f"https://{host}.finance.yahoo.com/v7/finance/quote",
                    params={"symbols": symbol, "fields": _QUOTE_FIELDS},
                    headers=_HEADERS,
                )
                if not r.is_success:
                    continue
                result = r.json().get("quoteResponse", {}).get("result", [])
                if result and result[0].get("regularMarketPrice"):
                    return result[0]
            except Exception:
                continue
        return None

    async def quotes_batch(self, symbols: list[str]) -> dict:
        """Batch quotes. Returns {symbol: parsed_dict}."""
        joined = ",".join(symbols)
        for host in ("query1", "query2"):
            try:
                r = await self._client.get(
                    f"https://{host}.finance.yahoo.com/v7/finance/quote",
                    params={"symbols": joined, "fields": _QUOTE_FIELDS},
                    headers=_HEADERS,
                )
                if not r.is_success:
                    continue
                results = r.json().get("quoteResponse", {}).get("result", [])
                data = {}
                for q in results:
                    if not q.get("regularMarketPrice"):
                        continue
                    data[q["symbol"]] = {
                        "price": q["regularMarketPrice"],
                        "change": round(q.get("regularMarketChangePercent") or 0, 2),
                        **({} if q.get("regularMarketVolume") is None else {"vol": round(q["regularMarketVolume"] / 1e6, 2)}),
                        **({} if q.get("averageDailyVolume10Day") is None else {"avgVol": round(q["averageDailyVolume10Day"] / 1e6, 2)}),
                        **({} if q.get("marketCap") is None else {"mktCap": round(q["marketCap"] / 1e9, 1)}),
                        **({} if not (q.get("trailingPE") and q["trailingPE"] > 0) else {"pe": round(q["trailingPE"], 1)}),
                        **({} if not (q.get("forwardPE") and q["forwardPE"] > 0) else {"forwardPE": round(q["forwardPE"], 1)}),
                        **({} if q.get("priceToBook") is None else {"pb": round(q["priceToBook"], 2)}),
                        **({} if q.get("beta") is None else {"beta": round(q["beta"], 2)}),
                        **({} if q.get("fiftyTwoWeekHigh") is None else {"high52w": round(q["fiftyTwoWeekHigh"], 2)}),
                        **({} if q.get("fiftyTwoWeekLow") is None else {"low52w": round(q["fiftyTwoWeekLow"], 2)}),
                        **({} if not (q.get("trailingAnnualDividendYield") and q["trailingAnnualDividendYield"] > 0) else {
                            "dividendYield": round(q["trailingAnnualDividendYield"] * 100, 2)
                        }),
                        **({} if (q.get("earningsTimestampStart") or q.get("earningsTimestamp")) is None else {
                            "earningsDate": q.get("earningsTimestampStart") or q.get("earningsTimestamp")
                        }),
                        **({} if q.get("earningsGrowth") is None else {"epsGrowth": round(q["earningsGrowth"] * 100, 1)}),
                        **({} if q.get("revenueGrowth") is None else {"revGrowth": round(q["revenueGrowth"] * 100, 1)}),
                    }
                if data:
                    return data
            except Exception:
                continue
        return {}

    async def candle(self, symbol: str, range_: str = "1mo") -> dict | None:
        """Price history. Returns {prices, ohlcv, timestamps, lastClose} or None."""
        for host in ("query1", "query2"):
            try:
                r = await self._client.get(
                    f"https://{host}.finance.yahoo.com/v8/finance/chart/{symbol}",
                    params={"interval": "1d", "range": range_},
                    headers=_HEADERS,
                )
                if not r.is_success:
                    continue
                d = r.json()
                result = (d.get("chart", {}).get("result") or [None])[0]
                if not result:
                    continue
                q = (result.get("indicators", {}).get("quote") or [{}])[0]
                closes = [v for v in (q.get("close") or []) if v is not None]
                if len(closes) < 3:
                    continue
                timestamps = result.get("timestamp")
                ohlcv = [
                    {"o": o, "h": h, "l": l, "c": c, "v": v}
                    for o, h, l, c, v in zip(
                        q.get("open") or [],
                        q.get("high") or [],
                        q.get("low") or [],
                        q.get("close") or [],
                        q.get("volume") or [],
                    )
                    if c is not None
                ]
                return {
                    "prices": closes,
                    "ohlcv": ohlcv,
                    "timestamps": timestamps,
                    "lastClose": closes[-1],
                    "source": SOURCE,
                }
            except Exception:
                continue
        return None

    async def quote_summary(self, symbol: str, modules: str) -> dict:
        try:
            r = await self._client.get(
                f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{symbol}",
                params={"modules": modules},
                headers=_HEADERS,
            )
            if not r.is_success:
                return {}
            result = r.json().get("quoteSummary", {}).get("result") or [{}]
            return result[0] if result else {}
        except Exception:
            return {}

    async def news(self, symbol: str) -> list[dict] | None:
        try:
            r = await self._client.get(
                "https://query2.finance.yahoo.com/v1/finance/search",
                params={"q": symbol, "newsCount": 5, "quotesCount": 0, "enableFuzzyQuery": False},
                headers=_HEADERS,
            )
            if not r.is_success:
                return None
            items = r.json().get("news", [])[:5]
            if not items:
                return None
            return [
                {
                    "title": item.get("title", ""),
                    "publisher": item.get("publisher", ""),
                    "link": item.get("link"),
                    "publishedAt": item.get("providerPublishTime"),
                }
                for item in items
            ]
        except Exception:
            return None
