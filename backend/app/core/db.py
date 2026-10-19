"""Postgres access (psycopg 3) on DATABASE_URL.

DATABASE_URL may be Supabase's transaction pooler, which does not support
prepared statements, so every connection sets `prepare_threshold=None`.

In an endpoint, ask for the request's connection with the `Conn` type:

    @router.post("/things")
    def create_thing(body: ThingIn, user: SomeGuardedUser, conn: Conn):
        conn.execute("insert into public.things ...", (...))

All the work of one request runs in ONE transaction. It is committed when the
endpoint returns, before the response is sent, and rolled back if anything is
raised (an HTTPException, a database error, a bug). Rows come back as dicts.
"""

from __future__ import annotations

import threading
from collections.abc import Iterator
from typing import Annotated

import psycopg
from fastapi import Depends
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.core.config import get_settings

_pool: ConnectionPool | None = None
_pool_lock = threading.Lock()


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


def get_pool() -> ConnectionPool:
    """The process-wide connection pool, opened on first use."""
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                pool = ConnectionPool(
                    get_settings().database_url,
                    min_size=1,
                    max_size=5,
                    kwargs={"prepare_threshold": None, "row_factory": dict_row},
                    check=ConnectionPool.check_connection,  # drop connections the pooler closed
                    open=False,
                )
                pool.open(wait=True, timeout=30)
                _pool = pool
    return _pool


def get_conn() -> Iterator[psycopg.Connection]:
    """One connection and one transaction per request (commit on success, rollback on error)."""
    with get_pool().connection() as conn:
        yield conn


# scope="function": the transaction is committed right after the endpoint returns,
# before the response is sent, so a client's next request always sees the change.
Conn = Annotated[psycopg.Connection, Depends(get_conn, scope="function")]
