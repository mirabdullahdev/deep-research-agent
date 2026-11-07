from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openai_api_key: str = ""
    tavily_api_key: str = ""

    planner_model: str = "gpt-5"
    worker_model: str = "gpt-5-mini"
    writer_model: str = "gpt-5"

    cors_origins: list[str] = ["http://localhost:3000"]

    rate_limit_enabled: bool = True
    runs_per_visitor: int = 1
    runs_per_ip_per_day: int = 3
    global_budget_usd: float = 2.0
    trust_proxy: bool = False
    limits_db: str = "data/limits.db"


@lru_cache
def get_settings() -> Settings:
    return Settings()
