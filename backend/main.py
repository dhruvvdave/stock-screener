"""Markr FastAPI backend — replaces Vercel serverless api/ functions."""

import logging
from contextlib import asynccontextmanager

import httpx
import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import get_settings
from backend.services.db import create_parent_table, get_engine
from backend.services.partitions import PartitionMaintainer
from backend.routers import (
    stock, quotes, candle, search, profile,
    analyst, news, fundamentals, stock_metrics,
    enrich, app_metrics, history,
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.redis = aioredis.from_url(
            settings.redis_url, encoding="utf-8", decode_responses=True
        )
        app.state.http = httpx.AsyncClient(timeout=10.0)

        # A malformed DSN raises here rather than on first use, so engine
        # construction sits inside the same guard as the startup pass: one
        # unreachable-or-misconfigured database, one error path.
        app.state.partitions = None
        try:
            app.state.partitions = PartitionMaintainer(
                get_engine(),
                months_back=settings.partition_months_back,
                months_forward=settings.partition_months_forward,
                interval_seconds=settings.partition_refresh_hours * 3600,
            )
            await create_parent_table()
            # The startup pass goes through the maintainer rather than calling
            # ensure_partitions() directly, so its outcome lands in the state
            # that /metrics reads.
            await app.state.partitions.run_once()
            log.info("Database initialized")
        except Exception:
            # The app still serves quotes, charts and news without Postgres —
            # only /history and the background write path depend on it — so this
            # does not stop the boot. But it is an ERROR, not a warning, and it
            # is reflected on /metrics: a database the app cannot reach must not
            # be something you only discover by reading the price history later.
            log.error(
                "Database initialization FAILED — price history writes will be "
                "dropped until the next partition maintenance pass succeeds",
                exc_info=True,
            )
            if app.state.partitions is not None:
                app.state.partitions.record_startup_failure()

        if app.state.partitions is not None:
            # Runs the window again on an interval so a long-lived process cannot
            # drift past its last partition, and so a database that was
            # unreachable at boot is picked up on the next tick without a restart.
            app.state.partitions.start()

        try:
            yield
        finally:
            if app.state.partitions is not None:
                await app.state.partitions.stop()
            await app.state.redis.aclose()
            await app.state.http.aclose()

    app = FastAPI(title="Markr API", version="2.0.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    for router_module in [
        stock, quotes, candle, search, profile,
        analyst, news, fundamentals, stock_metrics,
        enrich, app_metrics, history,
    ]:
        app.include_router(router_module.router)

    return app


app = create_app()
