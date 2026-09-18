"""Shared request validation and error helpers for the API routers."""

from typing import Annotated

from fastapi import HTTPException, Query, status

# Tickers seen across the supported venues: AAPL, BRK.B, SHOP.TO, GSI.V,
# TSX:SHOP, ^GSPC. Anything else is rejected before it reaches a cache key
# or an upstream query string.
_SYMBOL_BODY = r"[A-Za-z0-9.\-:^]{1,24}"

#: A required ticker.
Symbol = Annotated[str, Query(pattern=rf"^{_SYMBOL_BODY}$", description="Ticker symbol")]
#: A ticker that may be omitted; callers declare the "" default themselves.
OptionalSymbol = Annotated[str, Query(pattern=rf"^$|^{_SYMBOL_BODY}$", description="Ticker symbol")]

CANDLE_RANGES = ("1mo", "3mo", "6mo", "1y", "2y")
CandleRange = Annotated[
    str, Query(pattern=rf"^({'|'.join(CANDLE_RANGES)})$", description="History window")
]


def rate_limited(source: str, retry_after: float) -> HTTPException:
    """429 with a Retry-After the client can act on.

    Every endpoint answers an exhausted budget the same way. Several of these
    used to return an empty 200, which is worse than useless: the caller
    stores a blank as though it were data.
    """
    seconds = max(1, round(retry_after)) if retry_after > 0 else 1
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Rate limit reached for {source}; retry in {seconds}s",
        headers={"Retry-After": str(seconds)},
    )


def upstream_unavailable(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)


def not_found(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
