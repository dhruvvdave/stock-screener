"""GET /history/{ticker} — stored OHLCV bars from PostgreSQL."""

import logging
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Path, Query
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from backend.config import get_settings
from backend.services.db import PriceHistory, get_session_factory
from backend.validation import upstream_unavailable

log = logging.getLogger(__name__)
router = APIRouter()

Ticker = Annotated[str, Path(pattern=r"^[A-Za-z0-9.\-:^]{1,24}$")]


@router.get("/history/{ticker}")
async def get_history(
    ticker: Ticker,
    start: Annotated[datetime | None, Query(description="ISO-8601 start timestamp")] = None,
    end: Annotated[datetime | None, Query(description="ISO-8601 end timestamp")] = None,
    limit: Annotated[int | None, Query(ge=1, description="Max rows to return")] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    settings = get_settings()
    # Unbounded, this could stream the whole table to one caller.
    limit = min(limit or settings.history_default_limit, settings.history_max_limit)
    ticker = ticker.upper()

    statement = select(PriceHistory).where(PriceHistory.ticker == ticker)
    if start:
        statement = statement.where(PriceHistory.timestamp >= start)
    if end:
        statement = statement.where(PriceHistory.timestamp <= end)
    statement = (
        statement.order_by(PriceHistory.timestamp.asc()).offset(offset).limit(limit + 1)
    )

    try:
        async with get_session_factory()() as session:
            rows = (await session.execute(statement)).scalars().all()
    except SQLAlchemyError:
        log.exception("history query failed for %s", ticker)
        raise upstream_unavailable("Price history is unavailable") from None

    # One row past the limit tells the caller there is more without a COUNT.
    has_more = len(rows) > limit
    rows = rows[:limit]

    return {
        "ticker": ticker,
        "count": len(rows),
        "limit": limit,
        "offset": offset,
        "hasMore": has_more,
        "rows": [
            {
                "timestamp": row.timestamp.isoformat(),
                "source": row.source,
                "open": row.open,
                "high": row.high,
                "low": row.low,
                "close": row.close,
                "volume": row.volume,
            }
            for row in rows
        ],
    }
