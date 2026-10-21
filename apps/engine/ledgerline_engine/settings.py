"""Configuration from the environment. Secrets never have defaults."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LL_", env_file=".env", extra="ignore")

    # Shared secret Convex uses to sign every request to the engine.
    engine_secret: str = ""
    # Accept unsigned requests (local development and tests only).
    allow_unsigned: bool = False
    signature_window_seconds: int = 300

    xero_client_id: str = ""
    xero_client_secret: str = ""
    xero_api_base: str = "https://api.xero.com"
    xero_identity_base: str = "https://identity.xero.com"

    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-5.6-luna"
    openrouter_base: str = "https://openrouter.ai/api/v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
