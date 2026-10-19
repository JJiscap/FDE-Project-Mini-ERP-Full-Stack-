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
from urllib.parse import urlparse

from dotenv import find_dotenv, load_dotenv
from psycopg.conninfo import make_conninfo

# This project's Supabase transaction pooler (Singapore). Only used when
# DATABASE_URL is empty; see _database_url().
_DEFAULT_POOLER_HOST = "aws-0-ap-southeast-1.pooler.supabase.com"


class ConfigError(RuntimeError):
    """A required environment variable is missing."""


def _require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ConfigError(f"Environment variable {name} is not set. See .env.example.")
    return value


def _database_url(supabase_url: str) -> str:
    """The Postgres connection string.

    Normally `DATABASE_URL` (the transaction pooler URI from the Supabase
    dashboard). If it is blank, build the pooler connection from the project
    ref in SUPABASE_URL and POSTGRES_PASSWORD, so a half-filled .env still works.
    """
    explicit = os.environ.get("DATABASE_URL", "").strip()
    if explicit:
        return explicit
    password = os.environ.get("POSTGRES_PASSWORD", "").strip()
    if not password:
        raise ConfigError(
            "Set DATABASE_URL (Supabase transaction pooler URI) or POSTGRES_PASSWORD. "
            "See .env.example."
        )
    project_ref = (urlparse(supabase_url).hostname or "").split(".")[0]
    return make_conninfo(
        host=os.environ.get("SUPABASE_POOLER_HOST", "").strip() or _DEFAULT_POOLER_HOST,
        port=6543,
        dbname="postgres",
        user=f"postgres.{project_ref}",
        password=password,
    )


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
        database_url=_database_url(supabase_url),
    )
