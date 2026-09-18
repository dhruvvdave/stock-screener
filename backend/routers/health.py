"""GET /health — liveness and dependency readiness.

Compose and any orchestrator gate on this, so it reports each dependency
separately and answers 503 when one is down rather than 200 with a sad face.
"""

import logging

from fastapi import APIRouter, Response, status
from sqlalchemy import text

from backend.deps import RedisDep
from backend.services.db import get_engine

log = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health")
async def health(redis: RedisDep, response: Response):
    checks = {"redis": await _check_redis(redis), "postgres": await _check_postgres()}
    healthy = all(checks.values())
    if not healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "ok" if healthy else "degraded", "checks": checks}


async def _check_redis(redis) -> bool:
    try:
        return bool(await redis.ping())
    except Exception:
        log.warning("Redis health check failed", exc_info=True)
        return False


async def _check_postgres() -> bool:
    try:
        async with get_engine().connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        log.warning("Postgres health check failed", exc_info=True)
        return False
