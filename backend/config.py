from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # External API keys
    finnhub_key: str = ""
    fmp_key: str = ""
    av_key: str = ""
    twelve_data_key: str = ""
    # Server-side fallback for the AI panel; visitors may send their own.
    openai_key: str = ""

    # Infrastructure
    redis_url: str = "redis://localhost:6379/0"
    postgres_dsn: str = "postgresql+asyncpg://markr:markr@localhost:5432/markr"

    # Comma-separated browser origins allowed to call the API.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Cache TTLs in seconds, one per resource, because a live price and a
    # company description go stale on very different timescales.
    ttl_quote: int = 30
    ttl_list_quote: int = 30
    ttl_candle: int = 300
    ttl_news: int = 900
    ttl_search: int = 3600
    ttl_fundamentals: int = 3600
    ttl_stock_metrics: int = 3600
    ttl_analyst: int = 3600
    ttl_enrich: int = 21600
    ttl_profile: int = 86400
    ttl_default: int = 600

    # Rows returned by /history/{ticker} when the caller does not say.
    history_default_limit: int = 1000
    history_max_limit: int = 10000

    # Months of price_history partitions kept ahead of the current one.
    partition_months_ahead: int = 3

    # Token bucket per source — "capacity,refill_rate_per_second".
    rate_finnhub: str = "30,0.5"        # 30 burst, 0.5 req/s sustained
    rate_yahoo: str = "60,2.0"
    rate_alphavantage: str = "5,0.083"  # free tier: 5 req/min
    rate_fmp: str = "10,0.167"          # free tier: 10 req/min
    rate_stooq: str = "30,1.0"
    rate_twelvedata: str = "8,0.133"    # free tier: 8 req/min
    rate_openai: str = "20,0.2"         # protects the server key from a hot loop

    def ttl_for(self, resource: str) -> int:
        """TTL for a cache resource. Ranged resources share their base TTL,
        so `candle:1mo` and `candle:2y` both use ttl_candle."""
        base = resource.split(":", 1)[0].replace("-", "_")
        ttl = getattr(self, f"ttl_{base}", None)
        return ttl if isinstance(ttl, int) else self.ttl_default

    def rate_params(self, source: str) -> tuple[float, float]:
        """Return (capacity, refill_per_second) for a source."""
        raw = getattr(self, f"rate_{source}", "10,0.1")
        capacity, rate = raw.split(",")
        return float(capacity), float(rate)

    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
