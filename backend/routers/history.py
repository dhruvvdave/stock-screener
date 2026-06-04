"""GET /history/{ticker} — read OHLCV history from PostgreSQL."""

from datetime import datetime

from fastapi import APIRouter, Query
from sqlalchemy import select, text

from backend.services.db import PriceHistory, get_session_factory

router = APIRouter()


@router.get("/history/{ticker}")
async def get_history(
    ticker: str,
    start: datetime | None = Query(None, description="ISO-8601 start timestamp"),
    end: datetime | None = Query(None, description="ISO-8601 end timestamp"),
):
    ticker = ticker.upper()
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(PriceHistory).where(PriceHistory.ticker == ticker)
        if start:
            stmt = stmt.where(PriceHistory.timestamp >= start)
        if end:
            stmt = stmt.where(PriceHistory.timestamp <= end)
        stmt = stmt.order_by(PriceHistory.timestamp.asc())
        rows = (await session.execute(stmt)).scalars().all()

    return {
        "ticker": ticker,
        "count": len(rows),
        "rows": [
            {
                "timestamp": r.timestamp.isoformat(),
                "source": r.source,
                "open": r.open,
                "high": r.high,
                "low": r.low,
                "close": r.close,
                "volume": r.volume,
            }
            for r in rows
        ],
    }
