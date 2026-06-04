"""Financial Modeling Prep fetcher."""

import httpx

from backend.config import get_settings

SOURCE = "fmp"
_BASE = "https://financialmodelingprep.com/api/v3"


class FMPFetcher:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    @property
    def _key(self) -> str:
        return get_settings().fmp_key

    async def enrich(self, symbol: str) -> dict | None:
        if not self._key:
            return None
        bare = symbol.split(".")[0]

        def n(v, d=2):
            try:
                x = float(v)
                return round(x, d) if x == x else None
            except (TypeError, ValueError):
                return None

        try:
            import asyncio
            metrics_r, income_r = await asyncio.gather(
                self._client.get(f"{_BASE}/key-metrics/{bare}",
                                 params={"limit": 1, "apikey": self._key}),
                self._client.get(f"{_BASE}/income-statement/{bare}",
                                 params={"limit": 4, "apikey": self._key}),
            )
            metrics_list = metrics_r.json() if metrics_r.is_success else []
            income_list = income_r.json() if income_r.is_success else []
            metrics = metrics_list[0] if metrics_list else None
            latest = income_list[0] if income_list else None
            if not metrics and not latest:
                return None

            rev_growth = None
            if len(income_list) >= 2 and income_list[0].get("revenue") and income_list[1].get("revenue"):
                delta = income_list[0]["revenue"] - income_list[1]["revenue"]
                rev_growth = n(delta / abs(income_list[1]["revenue"]) * 100, 1)

            return {
                "peRatio": n(metrics.get("peRatio"), 1) if metrics else None,
                "evToEbitda": n(metrics.get("enterpriseValueMultiple"), 1) if metrics else None,
                "psRatio": n(metrics.get("priceToSalesRatio"), 2) if metrics else None,
                "roic": n(metrics.get("roic", 0) * 100, 1) if metrics and metrics.get("roic") is not None else None,
                "revenueAnnual": n(latest["revenue"] / 1e9, 2) if latest and latest.get("revenue") else None,
                "netIncomeAnnual": n(latest["netIncome"] / 1e9, 2) if latest and latest.get("netIncome") else None,
                "grossMargin": n(latest["grossProfitRatio"] * 100, 1) if latest and latest.get("grossProfitRatio") is not None else None,
                "epsAnnual": n(latest.get("eps"), 2) if latest else None,
                "revenueGrowthYoY": rev_growth,
                "earningsHistory": [
                    {"period": q.get("period") or (q.get("date") or "")[:7],
                     "eps": q.get("eps"), "revenue": q.get("revenue")}
                    for q in income_list[:4]
                    if q.get("eps") is not None and q.get("revenue") is not None
                ],
            }
        except Exception:
            return None
