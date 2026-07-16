"""Application configuration."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    app_name: str = "orion-llm-svc"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://orion:orion@localhost:5432/orion_llm"

    # Redis
    redis_url: str = "redis://localhost:6379/0"
    redis_cache_ttl: int = 300

    # Server
    host: str = "0.0.0.0"
    port: int = 8010

    model_config = {"env_prefix": "LLM_SVC_"}


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
