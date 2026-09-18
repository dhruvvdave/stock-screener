"""Markr API — caching and rate-limiting proxy over several market data feeds."""

import logging
from contextlib import asynccontextmanager

import httpx
import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import get_settings
from backend.routers import (
    analyst, app_metrics, candle, enrich, fundamentals, health, history,
    news, profile, quotes, search, stock, stock_metrics,
)
from backend.services.db import drain_background_writes, init_db

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

ROUTERS = [
    stock, quotes, candle, search, profile, analyst, news,
    fundamentals, stock_metrics, enrich, app_metrics, history, health,
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.redis = aioredis.from_url(
        settings.redis_url, encoding="utf-8", decode_responses=True
    )
    app.state.http = httpx.AsyncClient(
        timeout=httpx.Timeout(10.0, connect=5.0),
        limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
        headers={"User-Agent": "Markr/2.0"},
    )
    try:
        await init_db()
        log.info("price_history ready")
    except Exception:
        # The quote and chart endpoints work without Postgres; only the
        # /history reads and the background writes need it.
        log.warning("Postgres unavailable — history will be empty", exc_info=True)

    yield

    await drain_background_writes()
    await app.state.redis.aclose()
    await app.state.http.aclose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Markr API", version="2.0.0", lifespan=lifespan)

    # Browsers only need the dev server and whatever the deployment sets;
    # a blanket "*" let any page on the internet spend this key's quota.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins(),
        allow_methods=["GET"],
        allow_headers=["*"],
    )

    for module in ROUTERS:
        app.include_router(module.router)

    return app


app = create_app()
