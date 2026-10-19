"""Plain helper functions for the test suite (fixtures live in conftest.py).

Everything here that deletes data refuses to touch a company whose name does
not start with `TEST-`. The Siam Bean demo company is never touched by tests.

These helpers talk to Supabase directly (httpx / SQL) on purpose, so the tests
do not depend on the application code they are checking.
"""

from __future__ import annotations

import uuid

import httpx
import psycopg

from app.core.config import get_settings
from scripts.demo_data import load_master_data

# One id per pytest process. Company names and emails carry it, so runs
# started at the same time by parallel agents never collide.
RUN_ID = uuid.uuid4().hex[:8]

# Children first, so foreign keys never block a delete.
_CLEAR_ORDER = (
    "payments",
    "invoices",
    "order_items",
    "sales_orders",
    "stock_movements",
    "doc_counters",
    "products",
    "customers",
)

_TIMEOUT = 30.0


# ---------------------------------------------------------------- companies


def create_test_company(conn: psycopg.Connection, label: str | None = None) -> int:
    """Insert a company named `TEST-<runid>` (or `TEST-<runid>-<label>`); return its id."""
    name = f"TEST-{RUN_ID}" if label is None else f"TEST-{RUN_ID}-{label}"
    row = conn.execute(
        "insert into public.companies (name) values (%s) returning id", (name,)
    ).fetchone()
    return row["id"]


def _require_test_company(conn: psycopg.Connection, company_id: int) -> None:
    row = conn.execute(
        "select name from public.companies where id = %s", (company_id,)
    ).fetchone()
    if row is None:
        return
    if not row["name"].startswith("TEST-"):
        raise RuntimeError(
            f"Refusing to delete data of company {company_id}: it is not a TEST-* company."
        )


def clear_company_data(conn: psycopg.Connection, company_id: int) -> None:
    """Delete every business row of a TEST-* company (users and the company stay)."""
    _require_test_company(conn, company_id)
    # One round trip: several statements in a single simple query (no parameters,
    # the id is an int), atomic because a multi-statement query is one transaction.
    cid = int(company_id)
    conn.execute(
        "; ".join(f"delete from public.{table} where company_id = {cid}" for table in _CLEAR_ORDER)
    )


def reset_company(conn: psycopg.Connection, company_id: int) -> None:
    """Put a TEST-* company back to the clean starting state every API test assumes.

    The 4 sample products with their Opening Stock (ARB-1KG 170, ROB-1KG 35,
    BLD-1KG 90, DRP-10 240) and the 3 sample customers. No orders, invoices,
    payments, other movements or document counters. Users are left alone.
    """
    clear_company_data(conn, company_id)
    load_master_data(conn, company_id, total_customers=3)


def drop_company(conn: psycopg.Connection, company_id: int) -> None:
    """Delete a TEST-* company with all its rows, its users rows and its auth users."""
    _require_test_company(conn, company_id)
    clear_company_data(conn, company_id)
    user_ids = [
        r["id"]
        for r in conn.execute(
            "select id from public.users where company_id = %s", (company_id,)
        ).fetchall()
    ]
    for user_id in user_ids:
        delete_auth_user(user_id)
    conn.execute("delete from public.users where company_id = %s", (company_id,))
    conn.execute("delete from public.companies where id = %s", (company_id,))


# ------------------------------------------------------------- auth (REST)


def _auth_url(path: str) -> str:
    return f"{get_settings().supabase_url}/auth/v1{path}"


def create_auth_user(email: str, password: str) -> str:
    """Create a confirmed Supabase Auth user with the admin API; return its id."""
    r = httpx.post(
        _auth_url("/admin/users"),
        headers={"apikey": get_settings().supabase_secret_key},
        json={"email": email, "password": password, "email_confirm": True},
        timeout=_TIMEOUT,
    )
    r.raise_for_status()
    return r.json()["id"]


def delete_auth_user(user_id: str) -> None:
    r = httpx.delete(
        _auth_url(f"/admin/users/{user_id}"),
        headers={"apikey": get_settings().supabase_secret_key},
        timeout=_TIMEOUT,
    )
    if r.status_code not in (200, 404):
        r.raise_for_status()


def login_status(email: str, password: str) -> tuple[int, str | None]:
    """Sign in with email and password. Returns (HTTP status, access token or None)."""
    r = httpx.post(
        _auth_url("/token?grant_type=password"),
        headers={"apikey": get_settings().supabase_publishable_key},
        json={"email": email, "password": password},
        timeout=_TIMEOUT,
    )
    token = r.json().get("access_token") if r.status_code == 200 else None
    return r.status_code, token


def login(email: str, password: str) -> str:
    """Sign in and return a real access token (JWT)."""
    status, token = login_status(email, password)
    if token is None:
        raise RuntimeError(f"Login failed for {email}: HTTP {status}")
    return token


# -------------------------------------------------------- rows for DB tests


def insert_product(
    conn: psycopg.Connection,
    company_id: int,
    sku: str,
    *,
    name: str = "Test product",
    unit: str = "kg",
    price: str = "450.00",
    cost: str = "320.00",
    reorder_level: int = 50,
) -> int:
    row = conn.execute(
        """
        insert into public.products (company_id, sku, name, unit, price, cost, reorder_level)
        values (%s, %s, %s, %s, %s, %s, %s) returning id
        """,
        (company_id, sku, name, unit, price, cost, reorder_level),
    ).fetchone()
    return row["id"]


def insert_movement(
    conn: psycopg.Connection,
    company_id: int,
    product_id: int,
    quantity: int,
    movement_type: str,
    *,
    ref_doc: str | None = None,
    reason: str | None = None,
) -> None:
    conn.execute(
        """
        insert into public.stock_movements
            (company_id, product_id, quantity, movement_type, ref_doc, reason)
        values (%s, %s, %s, %s, %s, %s)
        """,
        (company_id, product_id, quantity, movement_type, ref_doc, reason),
    )


def insert_customer(
    conn: psycopg.Connection,
    company_id: int,
    name: str = "Test Café",
    tax_id: str = "0105561000011",
    payment_terms_days: int = 30,
) -> int:
    row = conn.execute(
        """
        insert into public.customers (company_id, name, tax_id, payment_terms_days)
        values (%s, %s, %s, %s) returning id
        """,
        (company_id, name, tax_id, payment_terms_days),
    ).fetchone()
    return row["id"]


def on_hand(conn: psycopg.Connection, product_id: int) -> int:
    row = conn.execute(
        "select on_hand from public.stock_on_hand where product_id = %s", (product_id,)
    ).fetchone()
    return row["on_hand"]


def on_hand_by_sku(conn: psycopg.Connection, company_id: int) -> dict[str, int]:
    rows = conn.execute(
        "select sku, on_hand from public.stock_on_hand where company_id = %s", (company_id,)
    ).fetchall()
    return {r["sku"]: r["on_hand"] for r in rows}
