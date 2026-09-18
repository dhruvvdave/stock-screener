"""GET /api/fundamentals — key statistics and ratios from Yahoo Finance."""

from typing import Any

from fastapi import APIRouter

from backend.deps import CacheDep, HttpDep, LimiterDep
from backend.fetchers.yahoo import YahooFetcher
from backend.services import cache as cache_res
from backend.validation import Symbol, rate_limited

router = APIRouter()

# Yahoo wraps most numbers as {"raw": ..., "fmt": ...}; some come through bare.
_FIELDS = [
    ("forwardPE", "defaultKeyStatistics", "forwardPE"),
    ("pegRatio", "defaultKeyStatistics", "pegRatio"),
    ("shortRatio", "defaultKeyStatistics", "shortRatio"),
    ("shortPctFloat", "defaultKeyStatistics", "shortPercentOfFloat"),
    ("currentRatio", "financialData", "currentRatio"),
    ("debtToEquity", "financialData", "debtToEquity"),
    ("freeCashFlow", "financialData", "freeCashflow"),
    ("operatingMargins", "financialData", "operatingMargins"),
    ("profitMargins", "financialData", "profitMargins"),
    ("returnOnEquity", "financialData", "returnOnEquity"),
    ("returnOnAssets", "financialData", "returnOnAssets"),
]


def _raw(value: Any) -> Any:
    return value.get("raw") if isinstance(value, dict) else value


@router.get("/api/fundamentals")
async def get_fundamentals(symbol: Symbol, http: HttpDep, cache: CacheDep, limiter: LimiterDep):
    symbol = symbol.strip()
    limited = False

    async def fetch():
        nonlocal limited
        if not await limiter.consume("yahoo"):
            limited = True
            return None
        await cache.incr_source("yahoo")
        data = await YahooFetcher(http).quote_summary(
            symbol, "defaultKeyStatistics,financialData"
        )
        if not data:
            return None
        return {
            out: _raw((data.get(module) or {}).get(key))
            for out, module, key in _FIELDS
        }

    result = await cache.get_or_set(symbol, cache_res.FUNDAMENTALS, fetch)
    if result is not None:
        return result
    if limited:
        raise rate_limited("yahoo", await limiter.retry_after("yahoo"))
    # Yahoo has no statistics for plenty of small listings; that is not an error.
    return {out: None for out, _, _ in _FIELDS}
