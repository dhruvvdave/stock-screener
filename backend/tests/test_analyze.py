"""Tests for POST /api/analyze.

The AI panel was calling this endpoint against the FastAPI backend, where it
did not exist, so the feature 404'd under Docker Compose. These pin the
contract the frontend was written against.
"""

import httpx
import pytest
import pytest_asyncio

from backend.deps import get_http, get_limiter, get_redis
from backend.main import create_app
from backend.services.rate_limiter import TokenBucketLimiter


class FakeOpenAI:
    """Stands in for the OpenAI endpoint, recording what we sent it."""

    def __init__(self, status=200, payload=None, raises=None):
        self.status = status
        self.payload = payload if payload is not None else {
            "choices": [{"message": {"content": '{"summary": "ok"}'}}]
        }
        self.raises = raises
        self.requests = []

    async def post(self, url, *, headers=None, json=None, timeout=None):
        self.requests.append({"url": url, "headers": headers or {}, "json": json or {}})
        if self.raises:
            raise self.raises
        return httpx.Response(
            self.status, json=self.payload, request=httpx.Request("POST", url)
        )


@pytest_asyncio.fixture
async def make_client(redis, settings, monkeypatch):
    monkeypatch.setattr("backend.services.db.init_db", _noop)

    async def _build(upstream):
        app = create_app()
        app.dependency_overrides[get_redis] = lambda: redis
        app.dependency_overrides[get_limiter] = lambda: TokenBucketLimiter(redis)
        app.dependency_overrides[get_http] = lambda: upstream
        transport = httpx.ASGITransport(app=app)
        return httpx.AsyncClient(transport=transport, base_url="http://test")

    yield _build


async def _noop(*args, **kwargs):
    return None


async def test_a_prompt_with_a_caller_key_reaches_openai(make_client):
    upstream = FakeOpenAI()
    async with await make_client(upstream) as client:
        r = await client.post("/api/analyze", json={"prompt": "hi", "openaiKey": "sk-caller"})

    assert r.status_code == 200
    assert r.json() == {"text": '{"summary": "ok"}'}
    assert upstream.requests[0]["headers"]["Authorization"] == "Bearer sk-caller"
    assert upstream.requests[0]["json"]["messages"] == [{"role": "user", "content": "hi"}]


async def test_the_server_key_is_used_when_the_caller_sends_none(make_client, settings, monkeypatch):
    monkeypatch.setattr(settings, "openai_key", "sk-server")
    upstream = FakeOpenAI()
    async with await make_client(upstream) as client:
        r = await client.post("/api/analyze", json={"prompt": "hi"})

    assert r.status_code == 200
    assert upstream.requests[0]["headers"]["Authorization"] == "Bearer sk-server"


async def test_a_caller_key_takes_precedence_over_the_server_key(make_client, settings, monkeypatch):
    monkeypatch.setattr(settings, "openai_key", "sk-server")
    upstream = FakeOpenAI()
    async with await make_client(upstream) as client:
        await client.post("/api/analyze", json={"prompt": "hi", "openaiKey": "sk-caller"})

    assert upstream.requests[0]["headers"]["Authorization"] == "Bearer sk-caller"


async def test_no_key_anywhere_returns_the_sentinel_the_panel_watches_for(make_client, settings, monkeypatch):
    """AIInsights compares against this exact string to decide whether to
    show its key input, so the value is part of the contract."""
    monkeypatch.setattr(settings, "openai_key", "")
    upstream = FakeOpenAI()
    async with await make_client(upstream) as client:
        r = await client.post("/api/analyze", json={"prompt": "hi"})

    assert r.status_code == 503
    assert r.json() == {"error": "no_key"}
    assert upstream.requests == [], "called OpenAI with no key"


async def test_a_blank_key_counts_as_no_key(make_client, settings, monkeypatch):
    monkeypatch.setattr(settings, "openai_key", "")
    upstream = FakeOpenAI()
    async with await make_client(upstream) as client:
        r = await client.post("/api/analyze", json={"prompt": "hi", "openaiKey": "   "})
    assert r.json() == {"error": "no_key"}


@pytest.mark.parametrize("body", [
    {},                                  # no prompt
    {"prompt": ""},                      # empty prompt
    {"prompt": "x" * 8001},              # oversized prompt
])
async def test_bad_requests_are_rejected(make_client, body):
    async with await make_client(FakeOpenAI()) as client:
        assert (await client.post("/api/analyze", json=body)).status_code == 422


async def test_a_rejected_key_comes_back_as_401(make_client):
    upstream = FakeOpenAI(status=401, payload={"error": {"message": "Incorrect API key"}})
    async with await make_client(upstream) as client:
        r = await client.post("/api/analyze", json={"prompt": "hi", "openaiKey": "sk-bad"})

    assert r.status_code == 401
    assert r.json() == {"error": "Incorrect API key"}


async def test_an_upstream_failure_comes_back_as_502(make_client):
    upstream = FakeOpenAI(status=500, payload={"error": {"message": "server error"}})
    async with await make_client(upstream) as client:
        r = await client.post("/api/analyze", json={"prompt": "hi", "openaiKey": "sk-x"})

    assert r.status_code == 502
    assert r.json()["error"] == "server error"


async def test_a_timeout_comes_back_as_504(make_client):
    upstream = FakeOpenAI(raises=httpx.TimeoutException("too slow"))
    async with await make_client(upstream) as client:
        r = await client.post("/api/analyze", json={"prompt": "hi", "openaiKey": "sk-x"})

    assert r.status_code == 504
    assert "timed out" in r.json()["error"]


async def test_an_unreachable_upstream_comes_back_as_502(make_client):
    upstream = FakeOpenAI(raises=httpx.ConnectError("no route"))
    async with await make_client(upstream) as client:
        r = await client.post("/api/analyze", json={"prompt": "hi", "openaiKey": "sk-x"})

    assert r.status_code == 502


async def test_a_non_json_upstream_response_does_not_500(make_client):
    class Garbage(FakeOpenAI):
        async def post(self, url, **kwargs):
            return httpx.Response(200, text="<html>502</html>",
                                  request=httpx.Request("POST", url))

    async with await make_client(Garbage()) as client:
        r = await client.post("/api/analyze", json={"prompt": "hi", "openaiKey": "sk-x"})
    assert r.status_code == 502


async def test_an_empty_choices_list_yields_empty_text(make_client):
    async with await make_client(FakeOpenAI(payload={"choices": []})) as client:
        r = await client.post("/api/analyze", json={"prompt": "hi", "openaiKey": "sk-x"})
    assert r.status_code == 200
    assert r.json() == {"text": ""}


async def test_the_key_never_reaches_the_logs(make_client, caplog):
    """The request carries a live credential, so nothing about it should be
    logged, including via exception tracebacks."""
    import logging

    caplog.set_level(logging.DEBUG)
    upstream = FakeOpenAI(raises=httpx.ConnectError("no route"))
    async with await make_client(upstream) as client:
        await client.post("/api/analyze", json={"prompt": "hi", "openaiKey": "sk-secret-value"})

    assert "sk-secret-value" not in caplog.text


async def test_an_exhausted_budget_returns_429(make_client, redis, settings):
    limiter = TokenBucketLimiter(redis)
    capacity, _ = settings.rate_params("openai")
    for _ in range(int(capacity)):
        await limiter.consume("openai")

    async with await make_client(FakeOpenAI()) as client:
        r = await client.post("/api/analyze", json={"prompt": "hi", "openaiKey": "sk-x"})

    assert r.status_code == 429
    assert int(r.headers["Retry-After"]) >= 1
