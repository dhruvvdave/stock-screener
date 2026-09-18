"""POST /api/analyze — proxy a prompt to OpenAI for the AI analysis panel.

The key can come from the request body, so a visitor can bring their own, or
from OPENAI_KEY on the server. It is used for the one upstream call and never
logged or stored.

Status codes and the `{"error": ...}` body shape match the Vercel function in
api/analyze.js, which the frontend was written against.
"""

import logging
from typing import Annotated

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from backend.config import get_settings
from backend.deps import HttpDep, LimiterDep

log = logging.getLogger(__name__)
router = APIRouter()

_OPENAI_URL = "https://api.openai.com/v1/chat/completions"
_MODEL = "gpt-4o-mini"
_MAX_TOKENS = 500


class AnalyzeRequest(BaseModel):
    prompt: Annotated[str, Field(min_length=1, max_length=8000)]
    # Optional: falls back to the server's key when absent.
    openaiKey: Annotated[str | None, Field(default=None, max_length=200)]  # noqa: N815


def _error(status: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": message})


@router.post("/api/analyze")
async def analyze(body: AnalyzeRequest, http: HttpDep, limiter: LimiterDep):
    settings = get_settings()
    key = (body.openaiKey or "").strip() or settings.openai_key
    if not key:
        # The panel watches for this exact value and prompts for a key.
        return _error(503, "no_key")

    if not await limiter.consume("openai"):
        retry = await limiter.retry_after("openai")
        return JSONResponse(
            status_code=429,
            content={"error": f"Rate limit reached; retry in {max(1, round(retry))}s"},
            headers={"Retry-After": str(max(1, round(retry)))},
        )

    try:
        r = await http.post(
            _OPENAI_URL,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": _MODEL,
                "max_tokens": _MAX_TOKENS,
                "messages": [{"role": "user", "content": body.prompt}],
            },
            timeout=httpx.Timeout(45.0, connect=5.0),
        )
    except httpx.TimeoutException:
        return _error(504, "OpenAI timed out")
    except httpx.HTTPError:
        # Deliberately not logging the exception: the request carries the key.
        log.warning("OpenAI request failed")
        return _error(502, "Could not reach OpenAI")

    try:
        payload = r.json()
    except ValueError:
        return _error(502, f"OpenAI returned {r.status_code}")

    if not r.is_success or payload.get("error"):
        message = (payload.get("error") or {}).get("message") or f"OpenAI returned {r.status_code}"
        # 401 means the caller's key is bad, which is their problem to fix.
        return _error(401 if r.status_code == 401 else 502, message)

    choices = payload.get("choices") or [{}]
    return {"text": (choices[0].get("message") or {}).get("content") or ""}
