from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # External API keys
    finnhub_key: str = ""
    fmp_key: str = ""
    av_key: str = ""
    twelve_data_key: str = ""

    # Infrastructure
    redis_url: str = "redis://localhost:6379/0"
    postgres_dsn: str = "postgresql+asyncpg://markr:markr@localhost:5432/markr"

    # Cache TTLs (seconds) keyed by resolution label
    ttl_5min: int = 60
    ttl_1h: int = 300
    ttl_1d: int = 3600

    # Token bucket config per source — "capacity,refill_rate_per_second"
    # Alpha Vantage free tier: 5 req/min = ~0.083/s
    rate_finnhub: str = "30,0.5"        # 30 cap, 0.5 req/s
    rate_yahoo: str = "60,2.0"          # 60 cap, 2 req/s
    rate_alphavantage: str = "5,0.083"  # 5 cap, 0.083 req/s (5/min)
    rate_fmp: str = "10,0.167"          # 10 cap, 0.167 req/s (10/min)
    rate_stooq: str = "30,1.0"
    rate_twelvedata: str = "8,0.133"    # 8 cap, 0.133 req/s (8/min)

    def ttl_for_resolution(self, resolution: str) -> int:
        if resolution in ("5min", "5m", "15min", "30min"):
            return self.ttl_5min
        if resolution in ("1h", "60min"):
            return self.ttl_1h
        return self.ttl_1d

    def rate_params(self, source: str) -> tuple[float, float]:
        """Return (capacity, refill_per_second) for a source."""
        raw = getattr(self, f"rate_{source}", "10,0.1")
        cap, rate = raw.split(",")
        return float(cap), float(rate)


@lru_cache
def get_settings() -> Settings:
    return Settings()
