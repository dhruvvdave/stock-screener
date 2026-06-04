"""GET /api/profile — company profile from Yahoo + Finnhub."""

import asyncio

from fastapi import APIRouter, Query

from backend.deps import CacheDep, HttpDep, LimiterDep
from backend.fetchers.finnhub import FinnhubFetcher
from backend.fetchers.yahoo import YahooFetcher

router = APIRouter()


@router.get("/api/profile")
async def get_profile(
    symbol: str = Query(""),
    finnhubSymbol: str = Query(""),
    http: HttpDep = None,
    cache: CacheDep = None,
    limiter: LimiterDep = None,
):
    ticker = (finnhubSymbol or symbol).upper()
    cached = await cache.get(ticker, "any", "profile")
    if cached is not None:
        return cached

    yahoo = YahooFetcher(http)
    finnhub = FinnhubFetcher(http)

    yahoo_ok = await limiter.consume("yahoo")
    finnhub_ok = bool(finnhubSymbol) and await limiter.consume("finnhub")

    tasks = []
    if yahoo_ok and symbol:
        await cache._redis.incr("metrics:source:yahoo:requests")
        tasks.append(yahoo.quote_summary(symbol, "assetProfile"))
        tasks.append(yahoo.quote(symbol))
    else:
        tasks.extend([None, None])

    if finnhub_ok:
        await cache._redis.incr("metrics:source:finnhub:requests")
        tasks.append(finnhub.profile(finnhubSymbol.upper()))
    else:
        tasks.append(None)

    results = await asyncio.gather(*[t for t in tasks if t is not None],
                                   return_exceptions=True)
    idx = 0
    asset_profile, yahoo_quote, finnhub_data = {}, {}, {}
    for i, task in enumerate(tasks):
        if task is not None:
            val = results[idx]
            idx += 1
            if isinstance(val, Exception):
                val = {}
            if i == 0:
                asset_profile = (val or {}).get("assetProfile", {})
            elif i == 1:
                yahoo_quote = val or {}
            elif i == 2:
                finnhub_data = val or {}

    payload = {
        "companyName": finnhub_data.get("name") or yahoo_quote.get("longName") or yahoo_quote.get("shortName") or symbol,
        "sector": asset_profile.get("sector") or finnhub_data.get("finnhubIndustry"),
        "description": asset_profile.get("longBusinessSummary"),
        "logo": finnhub_data.get("logo"),
        "website": finnhub_data.get("weburl") or asset_profile.get("website"),
    }
    await cache.set(ticker, "any", "profile", payload)
    return payload
