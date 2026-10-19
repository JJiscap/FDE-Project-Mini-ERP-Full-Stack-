"""Ticket 02: the test harness itself (ADR-0005). Every later ticket relies on these promises."""

from __future__ import annotations

import pytest

from tests import support
from tests.support import RUN_ID, insert_customer, insert_movement, insert_product, on_hand_by_sku


def count(conn, table: str, company_id: int, extra: str = "") -> int:
    return conn.execute(
        f"select count(*) as n from public.{table} where company_id = %s {extra}", (company_id,)
    ).fetchone()["n"]


def test_each_test_starts_with_the_scenario_opening_stock(conn, test_company_id):
    assert on_hand_by_sku(conn, test_company_id) == {
        "ARB-1KG": 170,
        "ROB-1KG": 35,
        "BLD-1KG": 90,
        "DRP-10": 240,
    }


def test_each_test_starts_with_the_three_sample_customers(conn, test_company_id):
    names = {
        r["name"]
        for r in conn.execute(
            "select name from public.customers where company_id = %s", (test_company_id,)
        ).fetchall()
    }
    assert names == {"Café Lune", "Brew Lab Ari", "Sukhumvit Corner Café"}


def test_each_test_starts_without_any_document(conn, test_company_id):
    for table in ("sales_orders", "order_items", "invoices", "payments", "doc_counters"):
        assert count(conn, table, test_company_id) == 0, table
    assert count(conn, "stock_movements", test_company_id, "and movement_type <> 'opening'") == 0


def test_the_company_is_named_test_runid_and_is_not_siam_bean(api_company):
    assert api_company.name == f"TEST-{RUN_ID}"


def test_reset_removes_everything_a_test_left_behind(conn, test_company_id):
    extra_product = insert_product(conn, test_company_id, "LEAK-1KG")
    insert_movement(conn, test_company_id, extra_product, 10, "in")
    insert_customer(conn, test_company_id, name="Leaked Café")
    conn.execute("select public.next_doc_number(%s, 'SO')", (test_company_id,))

    support.reset_company(conn, test_company_id)

    assert set(on_hand_by_sku(conn, test_company_id)) == {"ARB-1KG", "ROB-1KG", "BLD-1KG", "DRP-10"}
    assert count(conn, "customers", test_company_id) == 3
    assert count(conn, "doc_counters", test_company_id) == 0


def test_each_role_can_log_in_and_has_its_own_token(api_company):
    tokens = {role: user.token for role, user in api_company.users.items()}

    assert set(tokens) == {"admin", "sales", "warehouse", "accountant"}
    assert len(set(tokens.values())) == 4


def test_clean_up_refuses_a_company_that_is_not_a_test_company(conn):
    name = f"NOTTEST-{RUN_ID}"
    company_id = conn.execute(
        "insert into public.companies (name) values (%s) returning id", (name,)
    ).fetchone()["id"]
    try:
        insert_product(conn, company_id, "KEEP-1KG")

        with pytest.raises(RuntimeError, match="not a TEST-"):
            support.reset_company(conn, company_id)
        with pytest.raises(RuntimeError, match="not a TEST-"):
            support.drop_company(conn, company_id)

        assert count(conn, "products", company_id) == 1
    finally:
        conn.execute("delete from public.products where company_id = %s", (company_id,))
        conn.execute("delete from public.companies where id = %s", (company_id,))
