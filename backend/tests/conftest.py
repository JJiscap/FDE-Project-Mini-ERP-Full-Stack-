"""Shared pytest fixtures. See tests/support.py for the plain helpers.

Database-level fixtures (ticket 01):

- `conn`     one autocommit connection to the hosted Supabase Postgres for the session.
- `company`  a fresh, empty `TEST-<runid>-<n>` company id for one test, dropped afterwards.
"""

from __future__ import annotations

import itertools

import pytest

from app.core.db import connect
from tests import support

_company_counter = itertools.count(1)


@pytest.fixture(scope="session")
def conn():
    """Autocommit connection, rows as dicts. Use `with conn.transaction():` for atomic blocks."""
    with connect(autocommit=True) as connection:
        yield connection


@pytest.fixture
def company(conn):
    """Id of an empty throwaway company (no products, no customers). Dropped after the test."""
    company_id = support.create_test_company(conn, f"db{next(_company_counter)}")
    try:
        yield company_id
    finally:
        support.drop_company(conn, company_id)
