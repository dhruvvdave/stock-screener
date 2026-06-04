"""Markr FastAPI backend — replaces Vercel serverless api/ functions."""

import logging

import httpx
import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import get_settings
from backend.services.db import init_db
from backend.routers import (
    stock, quotes, candle, search, profile,
    analyst, news, fundamentals, stock_metrics,
    enrich, app_metrics, history,
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Markr API", version="2.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    async def startup():
        app.state.redis = aioredis.from_url(
            settings.redis_url, encoding="utf-8", decode_responses=True
        )
        app.state.http = httpx.AsyncClient(timeout=10.0)
        try:
            await init_db()
            log.info("Database initialized")
        except Exception:
            log.warning("Postgres unavailable — history writes will fail silently")

    @app.on_event("shutdown")
    async def shutdown():
        await app.state.redis.aclose()
        await app.state.http.aclose()

    for router_module in [
        stock, quotes, candle, search, profile,
        analyst, news, fundamentals, stock_metrics,
        enrich, app_metrics, history,
    ]:
        app.include_router(router_module.router)

    return app


app = create_app()
