"""Settings, read from environment variables.

A `.env` file is loaded if one is found in the current directory or any parent
(so running from `backend/` finds the repo-root `.env`). Real environment
variables always win over the file, which is how Vercel provides them.
Never log or print these values.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import find_dotenv, load_dotenv


class ConfigError(RuntimeError):
    """A required environment variable is missing."""


def _require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ConfigError(f"Environment variable {name} is not set. See .env.example.")
    return value


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_publishable_key: str
    supabase_secret_key: str
    supabase_jwks_url: str
    database_url: str

    @property
    def jwt_audience(self) -> str:
        return "authenticated"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    # override=False: variables already in the environment take priority over .env
    load_dotenv(find_dotenv(usecwd=True), override=False)
    supabase_url = _require("SUPABASE_URL").rstrip("/")
    return Settings(
        supabase_url=supabase_url,
        supabase_publishable_key=_require("SUPABASE_PUBLISHABLE_KEY"),
        supabase_secret_key=os.environ.get("SUPABASE_SECRET_KEY", "").strip(),
        supabase_jwks_url=os.environ.get("SUPABASE_JWKS_URL", "").strip()
        or f"{supabase_url}/auth/v1/.well-known/jwks.json",
        database_url=_require("DATABASE_URL"),
    )
