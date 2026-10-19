"""Ticket 01: the demo seed.

The seed functions are run against throwaway TEST-* companies, never against
Siam Bean. Expected values are the literals from docs/scenario.md.
"""

from __future__ import annotations

import re

import pytest

from scripts.seed import DEMO_USERS, DemoUser, seed_company, seed_master_data, seed_users
from tests import support
from tests.support import RUN_ID, on_hand_by_sku

SCENARIO_ON_HAND = {"ARB-1KG": 170, "ROB-1KG": 35, "BLD-1KG": 90, "DRP-10": 240}


def count(conn, table: str, company_id: int) -> int:
    return conn.execute(
        f"select count(*) as n from public.{table} where company_id = %s", (company_id,)
    ).fetchone()["n"]


# -------------------------------------------------------------- demo users spec


def test_the_demo_users_are_the_five_people_from_the_scenario():
    assert {u.email: (u.full_name, u.role) for u in DEMO_USERS} == {
        "somchai@siambean.test": ("Khun Somchai", "admin"),
        "nok@siambean.test": ("Nok", "sales"),
        "ploy@siambean.test": ("Ploy", "sales"),
        "lek@siambean.test": ("Lek", "warehouse"),
        "fon@siambean.test": ("Fon", "accountant"),
    }


# ------------------------------------------------------------------ the company


def test_seeding_the_company_twice_gives_one_company(conn):
    name = f"TEST-{RUN_ID}-seedco"
    first = seed_company(conn, name=name)
    try:
        second = seed_company(conn, name=name)
        assert second == first
        n = conn.execute(
            "select count(*) as n from public.companies where name = %s", (name,)
        ).fetchone()["n"]
        assert n == 1
    finally:
        support.drop_company(conn, first)


# ---------------------------------------------------------------- master data


def test_seeded_stock_on_hand_is_the_opening_stock_of_the_scenario(conn, company):
    seed_master_data(conn, company)

    assert on_hand_by_sku(conn, company) == SCENARIO_ON_HAND


def test_seeded_products_carry_the_scenario_prices_costs_and_reorder_levels(conn, company):
    seed_master_data(conn, company)

    rows = conn.execute(
        "select sku, name, unit, cost, price, reorder_level, active "
        "from public.products where company_id = %s",
        (company,),
    ).fetchall()
    assert {
        r["sku"]: (r["name"], r["unit"], str(r["cost"]), str(r["price"]), r["reorder_level"])
        for r in rows
    } == {
        "ARB-1KG": ("Arabica, 1 kg bag", "kg", "320.00", "450.00", 50),
        "ROB-1KG": ("Robusta, 1 kg bag", "kg", "220.00", "320.00", 40),
        "BLD-1KG": ("House Blend, 1 kg bag", "kg", "260.00", "380.00", 30),
        "DRP-10": ("Drip bags, box of 10", "box", "90.00", "150.00", 100),
    }
    assert all(r["active"] for r in rows)


def test_opening_stock_is_recorded_as_opening_movements(conn, company):
    seed_master_data(conn, company)

    kinds = conn.execute(
        "select distinct movement_type, ref_doc from public.stock_movements where company_id = %s",
        (company,),
    ).fetchall()
    assert [(k["movement_type"], k["ref_doc"]) for k in kinds] == [("opening", "OPENING")]


def test_the_three_sample_customers_have_their_scenario_tax_ids_and_terms(conn, company):
    seed_master_data(conn, company)

    rows = conn.execute(
        "select name, tax_id, payment_terms_days from public.customers where company_id = %s "
        "and name in ('Café Lune', 'Brew Lab Ari', 'Sukhumvit Corner Café')",
        (company,),
    ).fetchall()
    assert {r["name"]: (r["tax_id"], r["payment_terms_days"]) for r in rows} == {
        "Café Lune": ("0105561000011", 30),
        "Brew Lab Ari": ("0105562000022", 0),
        "Sukhumvit Corner Café": ("0105563000033", 15),
    }


def test_the_company_ends_up_with_200_customers(conn, company):
    seed_master_data(conn, company)

    assert count(conn, "customers", company) == 200


def test_generated_cafes_have_unique_names_13_digit_tax_ids_and_mixed_terms(conn, company):
    seed_master_data(conn, company)

    rows = conn.execute(
        "select name, tax_id, payment_terms_days from public.customers where company_id = %s",
        (company,),
    ).fetchall()
    assert len({r["name"] for r in rows}) == 200
    assert len({r["tax_id"] for r in rows}) == 200
    assert all(re.fullmatch(r"\d{13}", r["tax_id"]) for r in rows)
    assert {r["payment_terms_days"] for r in rows} == {0, 15, 30}


def test_seeding_twice_changes_nothing(conn, company):
    seed_master_data(conn, company)
    seed_master_data(conn, company)

    assert on_hand_by_sku(conn, company) == SCENARIO_ON_HAND
    assert count(conn, "products", company) == 4
    assert count(conn, "customers", company) == 200
    assert count(conn, "stock_movements", company) == 4


def test_a_re_seed_leaves_a_changed_price_and_the_current_stock_alone(conn, company):
    seed_master_data(conn, company)
    conn.execute(
        "update public.products set price = 500.00 where company_id = %s and sku = 'ARB-1KG'",
        (company,),
    )
    arb = conn.execute(
        "select id from public.products where company_id = %s and sku = 'ARB-1KG'", (company,)
    ).fetchone()["id"]
    support.insert_movement(conn, company, arb, -20, "sale", ref_doc="INV-0001")

    seed_master_data(conn, company)

    assert on_hand_by_sku(conn, company)["ARB-1KG"] == 150
    price = conn.execute(
        "select price from public.products where id = %s", (arb,)
    ).fetchone()["price"]
    assert str(price) == "500.00"


def test_the_test_harness_can_seed_only_the_three_sample_customers(conn, company):
    seed_master_data(conn, company, total_customers=3)

    names = {
        r["name"]
        for r in conn.execute(
            "select name from public.customers where company_id = %s", (company,)
        ).fetchall()
    }
    assert names == {"Café Lune", "Brew Lab Ari", "Sukhumvit Corner Café"}


# ------------------------------------------------------------------ demo users


@pytest.fixture
def unique_users():
    """The five demo people with run-unique emails, so a test never touches the real demo logins."""
    return [
        DemoUser(
            email=f"{u.email.split('@')[0]}-{RUN_ID}@siambean.test",
            full_name=u.full_name,
            role=u.role,
        )
        for u in DEMO_USERS
    ]


def test_seeded_users_can_log_in_and_have_a_users_row_with_their_role(conn, company, unique_users):
    password = f"Tst-{RUN_ID}-Pass-1"

    seed_users(conn, company, unique_users, password=password)

    for user in unique_users:
        status, token = support.login_status(user.email, password)
        assert status == 200 and token, f"{user.email} could not log in"
    rows = conn.execute(
        "select email, role, full_name from public.users where company_id = %s", (company,)
    ).fetchall()
    assert {r["email"]: (r["role"], r["full_name"]) for r in rows} == {
        u.email: (u.role, u.full_name) for u in unique_users
    }


def test_seeding_users_twice_keeps_five_users_and_their_logins(conn, company, unique_users):
    password = f"Tst-{RUN_ID}-Pass-2"

    seed_users(conn, company, unique_users, password=password)
    seed_users(conn, company, unique_users, password=password)

    assert count(conn, "users", company) == 5
    status, _ = support.login_status(unique_users[0].email, password)
    assert status == 200


def test_the_demo_password_can_be_overridden_by_an_environment_variable(
    conn, company, unique_users, monkeypatch
):
    password = f"Env-{RUN_ID}-Pass-3"
    monkeypatch.setenv("DEMO_PASSWORD", password)

    seed_users(conn, company, unique_users[:1])

    status, _ = support.login_status(unique_users[0].email, password)
    assert status == 200
