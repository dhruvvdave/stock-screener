"""GET /api/resolve — turn a ticker into a listing and its provider symbols."""

import logging

from fastapi import APIRouter, Query, Response

from backend.deps import HttpDep, LimiterDep, RedisDep
from backend.services.symbols import AMBIGUOUS, NOT_FOUND, SymbolResolver

log = logging.getLogger(__name__)
router = APIRouter()

# 409 for ambiguity rather than 400: the request was well formed, it just does
# not identify one listing. The body carries the candidates so the caller can
# ask the user which one they meant.
_STATUS_CODES = {AMBIGUOUS: 409, NOT_FOUND: 404}


@router.get("/api/resolve")
async def resolve_symbol(
    response: Response,
    symbol: str = Query(..., min_length=1, description="Ticker, TSXV:GSI or GSI.V"),
    exchange: str = Query("", description="Optional exchange hint, e.g. TSX-V"),
    redis: RedisDep = None,
    http: HttpDep = None,
    limiter: LimiterDep = None,
):
    resolver = SymbolResolver(redis, http=http, limiter=limiter)
    resolution = await resolver.resolve(symbol, exchange or None)

    response.status_code = _STATUS_CODES.get(resolution.status, 200)
    return resolution.to_dict()
