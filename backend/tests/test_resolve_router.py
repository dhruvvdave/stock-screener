"""
GET /api/resolve — the status codes a caller has to branch on.

The frontend distinguishes three outcomes, so the endpoint has to make them
distinguishable without parsing prose.
"""

import httpx
import pytest

from backend.deps import get_http, get_limiter, get_redis
from backend.main import create_app

from .conftest import FakeHttp, FakeLimiter, FakeRedis, finnhub_search_payload


@pytest.fixture
def client_factory():
    """A test client whose Redis, HTTP and limiter are doubles."""

    def build(payload=None, allow=True):
        app = create_app()
        redis = FakeRedis()
        app.dependency_overrides[get_redis] = lambda: redis
        app.dependency_overrides[get_http] = lambda: FakeHttp(payload)
        app.dependency_overrides[get_limiter] = lambda: FakeLimiter(allow=allow)
        # No lifespan is entered, so nothing touches Postgres.
        return httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        )

    return build


class TestResolveEndpoint:
    async def test_resolved_listing_returns_200_with_provider_symbols(self, client_factory):
        async with client_factory(finnhub_search_payload(
            ("GSI", "Gatos Silver", "TSXV:GSI"),
        )) as client:
            r = await client.get("/api/resolve", params={"symbol": "GSI"})

        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "resolved"
        assert body["exchange"] == "TSX-V"
        assert body["symbols"]["yahoo"] == "GSI.V"
        assert body["currency"] == "CAD"

    async def test_ambiguous_ticker_returns_409_with_candidates(self, client_factory):
        async with client_factory(finnhub_search_payload(
            ("SHOP", "Shopify Inc", "TSX:SHOP"),
            ("SHOP", "Shopify Inc", "SHOP"),
        )) as client:
            r = await client.get("/api/resolve", params={"symbol": "SHOP"})

        # 409, not 400: the request was well formed, it just does not identify
        # one listing.
        assert r.status_code == 409
        body = r.json()
        assert body["status"] == "ambiguous"
        assert {c["exchange"] for c in body["candidates"]} == {"TSX", "US"}
        assert body["symbols"] == {}

    async def test_unknown_ticker_returns_404_with_a_usable_message(self, client_factory):
        async with client_factory(finnhub_search_payload()) as client:
            r = await client.get("/api/resolve", params={"symbol": "ZZZZ"})

        assert r.status_code == 404
        body = r.json()
        assert body["status"] == "not_found"
        assert "ZZZZ" in body["message"]

    async def test_exchange_hint_is_honoured(self, client_factory):
        async with client_factory() as client:
            r = await client.get(
                "/api/resolve", params={"symbol": "SHOP", "exchange": "TSX"}
            )

        assert r.status_code == 200
        assert r.json()["symbols"]["finnhub"] == "TSX:SHOP"

    async def test_missing_symbol_is_a_validation_error(self, client_factory):
        async with client_factory() as client:
            r = await client.get("/api/resolve")
        assert r.status_code == 422
