"""Shared pytest fixtures: the harness every ticket's tests reuse (ADR-0005).

HOW TO WRITE AN API TEST
------------------------
Tests talk to the real FastAPI app through `TestClient`, against the hosted
Supabase project, with real access tokens. Nothing is mocked.

    def test_sales_can_see_who_they_are(client_as):
        me = client_as("sales").get("/api/me")
        assert me.status_code == 200
        assert me.json()["role"] == "sales"

    def test_no_token_is_refused(client):
        assert client.get("/api/me").status_code == 401

What a test starts with, every time:
- Company `TEST-<runid>` (one per pytest run) with 4 users, one per Role:
  "admin", "sales", "warehouse", "accountant" (real Supabase Auth logins).
- Its data reset to: the 4 sample products with Opening Stock (ARB-1KG 170,
  ROB-1KG 35, BLD-1KG 90, DRP-10 240) and the 3 sample customers (Café Lune,
  Brew Lab Ari, Sukhumvit Corner Café). No orders, invoices, payments, other
  stock movements or document counters, so the first order is `SO-0001`.
- The Siam Bean demo company is never touched.

FIXTURES
--------
client            TestClient with no token (anonymous). Resets the company first.
client_as(role)   Factory: TestClient that sends `role`'s Bearer token.
                  `client_as("sales")`, `client_as("warehouse")`, ...
headers           {role: {"Authorization": "Bearer ..."}}, for `client.get(url, headers=headers["sales"])`.
test_company_id   Id of the test company (int), after the reset.
api_company       The ApiCompany: id, name and `users[role]` -> ApiUser (id, email, full_name, role, token).
login_without_role  Headers of a logged-in auth user that has no `users` row (must get 403).
conn              Autocommit psycopg connection, for arranging data the API cannot create yet
                  (use `tests.support.insert_product`, ...). Assert through the API when you can.
company           A separate empty throwaway TEST company for DB-level tests (no users, no data).

Routes that exist only for the tests live in tests/support_routes.py and are
mounted at /api/_test by the `app` fixture; the production app never has them.
"""

from __future__ import annotations

import itertools
import secrets
import uuid
from contextlib import ExitStack
from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient

from app.core.db import connect
from tests import support

ROLES = ("admin", "sales", "warehouse", "accountant")

_company_counter = itertools.count(1)


@dataclass(frozen=True)
class ApiUser:
    """A logged-in test user: real Supabase Auth user, `users` row and access token."""

    id: str
    email: str
    full_name: str
    role: str
    token: str

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}


@dataclass(frozen=True)
class ApiCompany:
    """The session's TEST company and its four Role users."""

    id: int
    name: str
    users: dict[str, ApiUser]


# --------------------------------------------------------------- database


@pytest.fixture(scope="session")
def conn():
    """Autocommit connection, rows as dicts. Use `with conn.transaction():` for atomic blocks."""
    with connect(autocommit=True) as connection:
        yield connection


@pytest.fixture
def company(conn):
    """Id of an empty throwaway company (no users, no products, no customers). Dropped after the test."""
    company_id = support.create_test_company(conn, f"db{next(_company_counter)}")
    try:
        yield company_id
    finally:
        support.drop_company(conn, company_id)


# -------------------------------------------------------------------- API


@pytest.fixture(scope="session")
def api_company(conn):
    """Company `TEST-<runid>` with 4 Role users and real access tokens; removed at session end."""
    company_id = support.create_test_company(conn)
    password = f"Tst-{secrets.token_urlsafe(12)}"
    auth_ids: list[str] = []
    try:
        users: dict[str, ApiUser] = {}
        for role in ROLES:
            email = f"{role}-{support.RUN_ID}@siambean.test"
            full_name = f"Test {role.title()}"
            user_id = support.create_auth_user(email, password)
            auth_ids.append(user_id)
            conn.execute(
                "insert into public.users (id, company_id, full_name, email, role) "
                "values (%s, %s, %s, %s, %s)",
                (user_id, company_id, full_name, email, role),
            )
            users[role] = ApiUser(user_id, email, full_name, role, support.login(email, password))
        name = conn.execute(
            "select name from public.companies where id = %s", (company_id,)
        ).fetchone()["name"]
        yield ApiCompany(company_id, name, users)
    finally:
        support.drop_company(conn, company_id)
        for user_id in auth_ids:  # in case creation stopped halfway
            support.delete_auth_user(user_id)


@pytest.fixture(scope="session")
def app():
    """The real FastAPI app, plus the test-only routes under /api/_test."""
    from app.main import app as fastapi_app
    from tests.support_routes import router as test_router

    fastapi_app.include_router(test_router, prefix="/api/_test")
    return fastapi_app


@pytest.fixture
def clean_company(conn, api_company):
    """Reset the test company to the clean starting state. Used by `client` and `client_as`."""
    support.reset_company(conn, api_company.id)
    return api_company


@pytest.fixture
def test_company_id(clean_company) -> int:
    return clean_company.id


@pytest.fixture(scope="session")
def headers(api_company) -> dict[str, dict[str, str]]:
    """{role: {"Authorization": "Bearer <token>"}} for passing to `client.get(url, headers=...)`."""
    return {role: user.headers for role, user in api_company.users.items()}


@pytest.fixture
def client(app, clean_company):
    """TestClient with no Authorization header."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def client_as(app, clean_company):
    """Factory: `client_as("sales")` is a TestClient that sends the sales user's token."""
    with ExitStack() as stack:

        def make(role: str) -> TestClient:
            user = clean_company.users[role]
            return stack.enter_context(TestClient(app, headers=user.headers))

        yield make


@pytest.fixture
def login_without_role(conn):
    """Headers of someone who can log in but has no row in `users` (no Role, no Company)."""
    email = f"norole-{support.RUN_ID}-{uuid.uuid4().hex[:6]}@siambean.test"
    password = f"Tst-{secrets.token_urlsafe(12)}"
    user_id = support.create_auth_user(email, password)
    try:
        yield {"Authorization": f"Bearer {support.login(email, password)}"}
    finally:
        support.delete_auth_user(user_id)
