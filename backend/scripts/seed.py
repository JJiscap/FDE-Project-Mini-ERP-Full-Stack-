"""Seed the Siam Bean Co. demo data. Safe to run again (idempotent).

    cd backend && uv run python -m scripts.seed

Creates, if missing: the company, the 5 demo users (Supabase Auth + a `users`
row with their Role), the 4 sample products with Opening Stock, and 200
customers (the 3 samples plus 197 generated cafés).

The shared demo password defaults to the value below and can be overridden
with the DEMO_PASSWORD environment variable.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Sequence

import psycopg

from app.core import supabase_auth
from app.core.config import load_env
from app.core.db import connect
from scripts.demo_data import load_master_data

DEFAULT_DEMO_PASSWORD = "SiamBean-Demo-2026"

COMPANY_NAME = "Siam Bean Co."
COMPANY_TAX_ID = "0105560012345"  # fictional
COMPANY_ADDRESS = "99 Soi Sukhumvit 71, Phra Khanong Nuea, Watthana, Bangkok 10110"


@dataclass(frozen=True)
class DemoUser:
    email: str
    full_name: str
    role: str  # admin | sales | warehouse | accountant


DEMO_USERS: tuple[DemoUser, ...] = (
    DemoUser("somchai@siambean.test", "Khun Somchai", "admin"),
    DemoUser("nok@siambean.test", "Nok", "sales"),
    DemoUser("ploy@siambean.test", "Ploy", "sales"),
    DemoUser("lek@siambean.test", "Lek", "warehouse"),
    DemoUser("fon@siambean.test", "Fon", "accountant"),
)


def demo_password() -> str:
    load_env()
    return os.environ.get("DEMO_PASSWORD", "").strip() or DEFAULT_DEMO_PASSWORD


def seed_company(
    conn: psycopg.Connection,
    name: str = COMPANY_NAME,
    tax_id: str | None = COMPANY_TAX_ID,
    address: str | None = COMPANY_ADDRESS,
) -> int:
    """Return the id of the company called `name`, creating it if it does not exist."""
    row = conn.execute(
        """
        insert into public.companies (name, tax_id, address)
        values (%s, %s, %s)
        on conflict (name) do nothing
        returning id
        """,
        (name, tax_id, address),
    ).fetchone()
    if row is None:
        row = conn.execute("select id from public.companies where name = %s", (name,)).fetchone()
    return row["id"]


def seed_master_data(conn: psycopg.Connection, company_id: int, total_customers: int = 200) -> None:
    """The 4 sample products with Opening Stock and `total_customers` customers."""
    load_master_data(conn, company_id, total_customers)


def seed_users(
    conn: psycopg.Connection,
    company_id: int,
    users: Sequence[DemoUser] = DEMO_USERS,
    password: str | None = None,
) -> dict[str, str]:
    """Create or update the demo users. Returns {email: auth user id}.

    An existing login keeps its id; its password is reset to the demo password
    and its `users` row (Role, name, Company) is rewritten.
    """
    password = password or demo_password()
    ids: dict[str, str] = {}
    for user in users:
        existing = conn.execute(
            "select id from auth.users where lower(email) = lower(%s)", (user.email,)
        ).fetchone()
        if existing is None:
            user_id = supabase_auth.create_user(user.email, password, full_name=user.full_name)
        else:
            user_id = str(existing["id"])
            supabase_auth.set_password(user_id, password)
        conn.execute(
            """
            insert into public.users (id, company_id, full_name, email, role)
            values (%s, %s, %s, %s, %s)
            on conflict (id) do update
               set company_id = excluded.company_id,
                   full_name  = excluded.full_name,
                   email      = excluded.email,
                   role       = excluded.role
            """,
            (user_id, company_id, user.full_name, user.email, user.role),
        )
        ids[user.email] = user_id
    return ids


def main() -> None:
    with connect(autocommit=True) as conn:
        company_id = seed_company(conn)
        seed_master_data(conn, company_id)
        seed_users(conn, company_id)
        counts = conn.execute(
            """
            select (select count(*) from public.products  where company_id = %(c)s) as products,
                   (select count(*) from public.customers where company_id = %(c)s) as customers,
                   (select count(*) from public.users     where company_id = %(c)s) as users
            """,
            {"c": company_id},
        ).fetchone()
    print(
        f"Seeded {COMPANY_NAME}: {counts['users']} users, "
        f"{counts['products']} products, {counts['customers']} customers."
    )


if __name__ == "__main__":
    main()
