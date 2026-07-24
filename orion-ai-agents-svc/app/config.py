"""Application configuration."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    app_name: str = "orion-ai-agents-svc"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://orion:orion@localhost:5432/orion_ai_agents"

    # Redis
    redis_url: str = "redis://localhost:6379/1"
    redis_cache_ttl: int = 300

    # Server
    host: str = "0.0.0.0"
    port: int = 8011

    model_config = {"env_prefix": "AGENTS_SVC_"}


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
