"""Postgres access (psycopg 3) on DATABASE_URL.

DATABASE_URL may be Supabase's transaction pooler, which does not support
prepared statements, so every connection sets `prepare_threshold=None`.
"""

from __future__ import annotations

import psycopg
from psycopg.rows import dict_row

from app.core.config import get_settings


def connect(**kwargs) -> psycopg.Connection:
    """Open a one-off connection (scripts and tests). Rows come back as dicts.

    Pass `autocommit=True` for scripts that manage transactions themselves.
    The caller closes the connection (use it as a context manager).
    """
    return psycopg.connect(
        get_settings().database_url,
        prepare_threshold=None,
        row_factory=dict_row,
        **kwargs,
    )
