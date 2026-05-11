"""
Application Settings

Central configuration loaded from environment variables.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    app_env: str = "development"
    log_level: str = "debug"
    prometheus_enabled: bool = True

    # LLM
    llm_api_base: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o"
    llm_timeout: int = 120

    # ClickHouse
    clickhouse_host: str = "localhost"
    clickhouse_port: int = 9000
    clickhouse_user: str = "orion"
    clickhouse_password: str = ""
    clickhouse_db: str = "analytics"

    # Knowledge Service
    knowledge_svc_url: str = "http://localhost:8003"

    # Redis
    redis_url: str = "redis://localhost:6379/3"

    # PostgreSQL
    database_url: str = "postgresql+asyncpg://orion:orion_pass@localhost:5436/orion_intelligence"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
