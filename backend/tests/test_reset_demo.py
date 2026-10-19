"""Ticket 13 (part A): `scripts.reset_demo` puts a company back to the fresh demo state.

Every test runs `reset_company` against a throwaway TEST-* company, never against
Siam Bean. Expected values are literals from docs/scenario.md.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from scripts import reset_demo
from scripts.demo_data import PRODUCTS, SAMPLE_CUSTOMERS
from scripts.reset_demo import reset_company
from tests import support
from tests.support import on_hand_by_sku

SCENARIO_ON_HAND = {"ARB-1KG": 170, "ROB-1KG": 35, "BLD-1KG": 90, "DRP-10": 240}
SMALL = 5  # customers kept after a reset in most tests (the 3 samples + 2 generated); 200 is checked once


# ------------------------------------------------------------------ helpers


def one(conn, sql: str, *params):
    return conn.execute(sql, params).fetchone()


def count(conn, table: str, company_id: int) -> int:
    return one(conn, f"select count(*) as n from public.{table} where company_id = %s", company_id)["n"]


def product_id(conn, company_id: int, sku: str) -> int:
    return one(conn, "select id from public.products where company_id = %s and sku = %s", company_id, sku)["id"]


def customer_id(conn, company_id: int, name: str) -> int:
    return one(conn, "select id from public.customers where company_id = %s and name = %s", company_id, name)["id"]


def make_busy(conn, company_id: int) -> dict:
    """Leave the company the way a day of testing would: documents, movements, counters,
    changed master data, extra products and customers. Returns ids needed by the tests."""
    lune = customer_id(conn, company_id, "Café Lune")
    arb = product_id(conn, company_id, "ARB-1KG")
    rob = product_id(conn, company_id, "ROB-1KG")

    # US-1 style document set: confirmed order, sale movement, invoice, payment.
    order = one(
        conn,
        "insert into public.sales_orders (company_id, number, customer_id, status, confirmed_at) "
        "values (%s, 'SO-0001', %s, 'confirmed', now()) returning id",
        company_id,
        lune,
    )["id"]
    conn.execute(
        "insert into public.order_items (company_id, order_id, product_id, quantity, unit_price, unit_cost) "
        "values (%s, %s, %s, 20, 450.00, 320.00)",
        (company_id, order, arb),
    )
    support.insert_movement(conn, company_id, arb, -20, "sale", ref_doc="INV-0001")
    invoice = one(
        conn,
        "insert into public.invoices (company_id, number, order_id, customer_id, due_date, subtotal, vat, total) "
        "values (%s, 'INV-0001', %s, %s, current_date + 30, 9000.00, 630.00, 9630.00) returning id",
        company_id,
        order,
        lune,
    )["id"]
    conn.execute(
        "insert into public.payments (company_id, invoice_id, amount, method) values (%s, %s, 5000.00, 'transfer')",
        (company_id, invoice),
    )
    # a cancelled draft too
    conn.execute(
        "insert into public.sales_orders (company_id, number, customer_id, status) values (%s, 'SO-0002', %s, 'cancelled')",
        (company_id, lune),
    )

    # stock movements of every kind
    support.insert_movement(conn, company_id, rob, 10, "in", ref_doc="IN-0001")
    support.insert_movement(conn, company_id, rob, -5, "out", ref_doc="OUT-0001", reason="sample")
    support.insert_movement(conn, company_id, rob, -3, "adjust", ref_doc="ADJ-0001", reason="count")
    for doc_type, last in (("SO", 2), ("INV", 1), ("IN", 1), ("OUT", 1), ("ADJ", 1)):
        conn.execute(
            "insert into public.doc_counters (company_id, doc_type, last_value) values (%s, %s, %s)",
            (company_id, doc_type, last),
        )

    # master data drifted
    conn.execute(
        "update public.products set price = 999.00, cost = 1.00, reorder_level = 1, name = 'Renamed', active = false "
        "where id = %s",
        (arb,),
    )
    conn.execute("update public.customers set active = false, payment_terms_days = 99 where id = %s", (lune,))
    brew = customer_id(conn, company_id, "Brew Lab Ari")
    conn.execute("update public.customers set name = 'Brew Lab Renamed', address = null where id = %s", (brew,))

    # extras made during testing
    extra_customer = support.insert_customer(conn, company_id, name="Test Extra Café")
    extra_product = support.insert_product(conn, company_id, "XTRA-1")
    support.insert_movement(conn, company_id, extra_product, 7, "in", ref_doc="IN-0002")
    return {"extra_customer": extra_customer, "extra_product": extra_product, "lune": lune, "arb": arb}


# ------------------------------------------------------------------ the guard


def test_it_refuses_a_company_that_is_neither_siam_bean_nor_a_test_company(conn):
    other = conn.execute(
        "insert into public.companies (name) values (%s) returning id", (f"NOT-A-DEMO-{support.RUN_ID}",)
    ).fetchone()["id"]
    try:
        support.insert_product(conn, other, "KEEP-1")
        with pytest.raises(RuntimeError, match="Siam Bean"):
            reset_company(conn, other)
        assert count(conn, "products", other) == 1  # nothing was touched
    finally:
        conn.execute("delete from public.products where company_id = %s", (other,))
        conn.execute("delete from public.companies where id = %s", (other,))


def test_it_refuses_an_unknown_company(conn):
    with pytest.raises(RuntimeError, match="not found"):
        reset_company(conn, 999999999)


# ------------------------------------------------------------ documents gone


def test_it_deletes_orders_invoices_payments_and_resets_the_counters(conn, test_company_id):
    make_busy(conn, test_company_id)

    reset_company(conn, test_company_id, total_customers=SMALL)

    for table in ("payments", "invoices", "order_items", "sales_orders", "doc_counters"):
        assert count(conn, table, test_company_id) == 0, table


def test_the_next_documents_after_a_reset_are_numbered_0001(conn, client_as, test_company_id):
    make_busy(conn, test_company_id)
    reset_company(conn, test_company_id, total_customers=SMALL)

    lune = customer_id(conn, test_company_id, "Café Lune")
    created = client_as("sales").post("/api/sales-orders", json={"customer_id": lune})
    assert created.status_code == 201, created.text
    assert created.json()["number"] == "SO-0001"
    for doc_type in ("INV", "IN", "OUT", "ADJ"):
        number = one(conn, "select public.next_doc_number(%s, %s) as n", test_company_id, doc_type)["n"]
        assert number == f"{doc_type}-0001"


# -------------------------------------------------------------------- stock


def test_stock_on_hand_is_the_opening_stock_again(conn, test_company_id):
    make_busy(conn, test_company_id)
    assert on_hand_by_sku(conn, test_company_id)["ARB-1KG"] == 150  # the sale of 20 is in

    reset_company(conn, test_company_id, total_customers=SMALL)

    assert on_hand_by_sku(conn, test_company_id) == SCENARIO_ON_HAND
    kinds = conn.execute(
        "select distinct movement_type from public.stock_movements where company_id = %s", (test_company_id,)
    ).fetchall()
    assert [k["movement_type"] for k in kinds] == ["opening"]
    assert count(conn, "stock_movements", test_company_id) == 4


# -------------------------------------------------------------- master data


def test_the_four_products_are_back_to_the_seed_values_and_active(conn, test_company_id):
    make_busy(conn, test_company_id)

    reset_company(conn, test_company_id, total_customers=SMALL)

    rows = conn.execute(
        "select sku, name, unit, price, cost, reorder_level, active from public.products "
        "where company_id = %s order by sku",
        (test_company_id,),
    ).fetchall()
    assert rows == [
        {
            "sku": p.sku, "name": p.name, "unit": p.unit, "price": p.price, "cost": p.cost,
            "reorder_level": p.reorder_level, "active": True,
        }
        for p in sorted(PRODUCTS, key=lambda p: p.sku)
    ]  # fmt: skip
    arb = one(
        conn,
        "select price, cost, reorder_level from public.products where id = %s",
        product_id(conn, test_company_id, "ARB-1KG"),
    )
    assert (arb["price"], arb["cost"], arb["reorder_level"]) == (Decimal("450.00"), Decimal("320.00"), 50)


def test_the_sample_customers_are_back_and_active_and_extras_are_removed(conn, test_company_id):
    ids = make_busy(conn, test_company_id)

    reset_company(conn, test_company_id, total_customers=SMALL)

    assert count(conn, "customers", test_company_id) == SMALL
    for spec in SAMPLE_CUSTOMERS:
        row = one(
            conn,
            "select tax_id, payment_terms_days, address, phone, active from public.customers "
            "where company_id = %s and name = %s",
            test_company_id,
            spec.name,
        )
        assert row == {
            "tax_id": spec.tax_id, "payment_terms_days": spec.payment_terms_days,
            "address": spec.address, "phone": spec.phone, "active": True,
        }  # fmt: skip
    assert one(conn, "select count(*) as n from public.customers where id = %s", ids["extra_customer"])["n"] == 0
    assert one(conn, "select count(*) as n from public.products where id = %s", ids["extra_product"])["n"] == 0
    assert count(conn, "products", test_company_id) == 4


def test_a_missing_sample_customer_is_created_again(conn, test_company_id):
    conn.execute(
        "delete from public.customers where company_id = %s and name = 'Sukhumvit Corner Café'", (test_company_id,)
    )

    reset_company(conn, test_company_id, total_customers=SMALL)

    assert one(
        conn,
        "select active from public.customers where company_id = %s and name = 'Sukhumvit Corner Café'",
        test_company_id,
    ) == {"active": True}


def test_by_default_there_are_200_customers(conn, test_company_id):
    reset_company(conn, test_company_id)

    assert count(conn, "customers", test_company_id) == 200


# ------------------------------------------------------- what is left alone


def test_the_users_of_the_company_are_untouched(conn, test_company_id):
    query = "select id, email, role, full_name from public.users where company_id = %s order by email"
    before = conn.execute(query, (test_company_id,)).fetchall()
    assert len(before) == 4
    make_busy(conn, test_company_id)

    reset_company(conn, test_company_id, total_customers=SMALL)

    assert conn.execute(query, (test_company_id,)).fetchall() == before


def test_another_company_is_untouched(conn, test_company_id, company):
    other_product = support.insert_product(conn, company, "OTHER-1")
    support.insert_movement(conn, company, other_product, 5, "opening", ref_doc="OPENING")
    make_busy(conn, test_company_id)

    reset_company(conn, test_company_id, total_customers=SMALL)

    assert on_hand_by_sku(conn, company) == {"OTHER-1": 5}


# --------------------------------------------------- idempotent and atomic


def test_running_it_twice_gives_the_same_state(conn, test_company_id):
    tables = ("products", "customers", "stock_movements", "doc_counters", "sales_orders")
    make_busy(conn, test_company_id)
    reset_company(conn, test_company_id, total_customers=SMALL)
    first = {t: count(conn, t, test_company_id) for t in tables}

    reset_company(conn, test_company_id, total_customers=SMALL)

    second = {t: count(conn, t, test_company_id) for t in tables}
    assert second == first
    assert second == {"products": 4, "customers": SMALL, "stock_movements": 4, "doc_counters": 0, "sales_orders": 0}
    assert on_hand_by_sku(conn, test_company_id) == SCENARIO_ON_HAND


def test_a_failure_halfway_changes_nothing(conn, test_company_id, monkeypatch):
    make_busy(conn, test_company_id)
    tables = ("sales_orders", "invoices", "payments", "stock_movements")
    before = {t: count(conn, t, test_company_id) for t in tables}

    def boom(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(reset_demo, "load_master_data", boom)
    with pytest.raises(RuntimeError, match="boom"):
        reset_company(conn, test_company_id, total_customers=SMALL)

    assert {t: count(conn, t, test_company_id) for t in tables} == before


def test_it_returns_counts_only(conn, test_company_id):
    summary = reset_company(conn, test_company_id, total_customers=SMALL)

    assert summary == {"products": 4, "customers": SMALL, "stock_movements": 4}


# -------------------------------------------------------- the dashboard


def test_after_a_reset_the_dashboard_shows_the_fresh_demo_numbers(conn, client_as, test_company_id):
    make_busy(conn, test_company_id)
    reset_company(conn, test_company_id, total_customers=SMALL)

    body = client_as("admin").get("/api/dashboard").json()

    assert body["sales_today"] == "0.00"
    assert body["low_stock_count"] == 1
    assert body["stock_value"] == "107100.00"
    assert body["open_invoices"]["count"] == 0
