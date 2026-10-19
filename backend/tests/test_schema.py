"""Ticket 01: what the database itself guarantees.

There is no API yet, so these tests use SQL on a throwaway TEST-* company.
(From ticket 02 on, behaviour is tested through the HTTP API instead.)
Expected values come from docs/scenario.md, not from the code.
"""

from __future__ import annotations

import pytest
from psycopg import errors

from tests import support
from tests.support import (
    insert_customer,
    insert_movement,
    insert_product,
    on_hand,
)

SPEC_TABLES = {
    "companies",
    "users",
    "customers",
    "products",
    "stock_movements",
    "sales_orders",
    "order_items",
    "invoices",
    "payments",
    "doc_counters",
}


def next_number(conn, company_id: int, doc_type: str) -> str:
    row = conn.execute(
        "select public.next_doc_number(%s, %s) as number", (company_id, doc_type)
    ).fetchone()
    return row["number"]


# ------------------------------------------------------------ stock never negative


def test_stock_out_larger_than_on_hand_is_refused_and_leaves_on_hand_unchanged(conn, company):
    arb = insert_product(conn, company, "ARB-1KG")
    insert_movement(conn, company, arb, 170, "opening", ref_doc="OPENING")

    with pytest.raises(errors.RaiseException, match="Not enough stock for ARB-1KG"):
        insert_movement(conn, company, arb, -171, "out", reason="Too many samples")

    assert on_hand(conn, arb) == 170


def test_stock_out_down_to_exactly_zero_is_allowed(conn, company):
    arb = insert_product(conn, company, "ARB-1KG")
    insert_movement(conn, company, arb, 170, "opening", ref_doc="OPENING")

    insert_movement(conn, company, arb, -170, "out", reason="Write-off")

    assert on_hand(conn, arb) == 0


def test_a_sale_of_20_kg_takes_170_down_to_150(conn, company):
    arb = insert_product(conn, company, "ARB-1KG")
    insert_movement(conn, company, arb, 170, "opening", ref_doc="OPENING")

    insert_movement(conn, company, arb, -20, "sale", ref_doc="INV-0001")

    assert on_hand(conn, arb) == 150


def test_a_negative_adjustment_cannot_push_stock_below_zero(conn, company):
    rob = insert_product(conn, company, "ROB-1KG")
    insert_movement(conn, company, rob, 35, "opening", ref_doc="OPENING")

    with pytest.raises(errors.RaiseException, match="Not enough stock for ROB-1KG"):
        insert_movement(conn, company, rob, -36, "adjust", reason="Recount")

    assert on_hand(conn, rob) == 35


def test_a_movement_of_zero_is_refused(conn, company):
    arb = insert_product(conn, company, "ARB-1KG")

    with pytest.raises(errors.CheckViolation):
        insert_movement(conn, company, arb, 0, "in")


def test_stock_in_cannot_be_negative_and_stock_out_cannot_be_positive(conn, company):
    arb = insert_product(conn, company, "ARB-1KG")
    insert_movement(conn, company, arb, 100, "opening", ref_doc="OPENING")

    with pytest.raises(errors.CheckViolation):
        insert_movement(conn, company, arb, -5, "in")
    with pytest.raises(errors.CheckViolation):
        insert_movement(conn, company, arb, 5, "out", reason="Typo")


def test_there_is_no_stored_quantity_on_products(conn):
    columns = {
        r["column_name"]
        for r in conn.execute(
            """
            select column_name from information_schema.columns
            where table_schema = 'public' and table_name = 'products'
            """
        ).fetchall()
    }
    assert columns  # the table exists
    assert not {"quantity", "qty", "stock", "on_hand"} & columns


# ------------------------------------------------------------- constraints


def test_sku_is_unique_within_a_company(conn, company):
    insert_product(conn, company, "ARB-1KG")

    with pytest.raises(errors.UniqueViolation):
        insert_product(conn, company, "ARB-1KG")


def test_the_same_sku_can_exist_in_another_company(conn, company):
    other = support.create_test_company(conn, "other-sku")
    try:
        insert_product(conn, company, "ARB-1KG")
        insert_product(conn, other, "ARB-1KG")
    finally:
        support.drop_company(conn, other)


def test_negative_price_or_cost_is_refused(conn, company):
    with pytest.raises(errors.CheckViolation):
        insert_product(conn, company, "BAD-1", price="-1.00")
    with pytest.raises(errors.CheckViolation):
        insert_product(conn, company, "BAD-2", cost="-0.01")


def test_a_customer_without_a_tax_id_is_refused(conn, company):
    with pytest.raises(errors.NotNullViolation):
        conn.execute(
            "insert into public.customers (company_id, name) values (%s, 'No Tax Café')",
            (company,),
        )
    with pytest.raises(errors.CheckViolation):
        insert_customer(conn, company, name="Blank Tax Café", tax_id="  ")


def test_negative_payment_terms_are_refused(conn, company):
    with pytest.raises(errors.CheckViolation):
        insert_customer(conn, company, payment_terms_days=-1)


def test_sales_order_numbers_are_unique_within_a_company(conn, company):
    customer = insert_customer(conn, company)
    sql = "insert into public.sales_orders (company_id, number, customer_id) values (%s, %s, %s)"
    conn.execute(sql, (company, "SO-0001", customer))

    with pytest.raises(errors.UniqueViolation):
        conn.execute(sql, (company, "SO-0001", customer))


def test_an_order_line_needs_a_quantity_above_zero(conn, company):
    customer = insert_customer(conn, company)
    arb = insert_product(conn, company, "ARB-1KG")
    order_id = conn.execute(
        "insert into public.sales_orders (company_id, number, customer_id) "
        "values (%s, 'SO-0001', %s) returning id",
        (company, customer),
    ).fetchone()["id"]

    with pytest.raises(errors.CheckViolation):
        conn.execute(
            """
            insert into public.order_items
                (company_id, order_id, product_id, quantity, unit_price, unit_cost)
            values (%s, %s, %s, 0, 450.00, 320.00)
            """,
            (company, order_id, arb),
        )


def test_a_new_sales_order_is_a_draft_and_an_invoice_total_must_add_up(conn, company):
    customer = insert_customer(conn, company)
    order = conn.execute(
        "insert into public.sales_orders (company_id, number, customer_id) "
        "values (%s, 'SO-0001', %s) returning id, status, confirmed_at",
        (company, customer),
    ).fetchone()
    assert order["status"] == "draft"
    assert order["confirmed_at"] is None

    invoice_sql = """
        insert into public.invoices
            (company_id, number, order_id, customer_id, due_date, subtotal, vat, total)
        values (%s, 'INV-0001', %s, %s, current_date + 30, 9000.00, 630.00, %s)
    """
    with pytest.raises(errors.CheckViolation):
        conn.execute(invoice_sql, (company, order["id"], customer, "9000.00"))
    conn.execute(invoice_sql, (company, order["id"], customer, "9630.00"))

    invoice = conn.execute(
        "select status, subtotal, vat, total from public.invoices where company_id = %s",
        (company,),
    ).fetchone()
    assert invoice["status"] == "open"
    assert str(invoice["total"]) == "9630.00"


def test_a_payment_must_be_above_zero_and_use_a_known_method(conn, company):
    customer = insert_customer(conn, company)
    order_id = conn.execute(
        "insert into public.sales_orders (company_id, number, customer_id) "
        "values (%s, 'SO-0001', %s) returning id",
        (company, customer),
    ).fetchone()["id"]
    invoice_id = conn.execute(
        """
        insert into public.invoices
            (company_id, number, order_id, customer_id, due_date, subtotal, vat, total)
        values (%s, 'INV-0001', %s, %s, current_date + 30, 9000.00, 630.00, 9630.00)
        returning id
        """,
        (company, order_id, customer),
    ).fetchone()["id"]
    sql = "insert into public.payments (company_id, invoice_id, amount, method) values (%s, %s, %s, %s)"

    with pytest.raises(errors.CheckViolation):
        conn.execute(sql, (company, invoice_id, "0.00", "transfer"))
    with pytest.raises(errors.CheckViolation):
        conn.execute(sql, (company, invoice_id, "100.00", "bitcoin"))
    conn.execute(sql, (company, invoice_id, "9630.00", "transfer"))


def test_updated_at_moves_when_a_row_changes(conn, company):
    arb = insert_product(conn, company, "ARB-1KG")
    before = conn.execute(
        "select created_at, updated_at from public.products where id = %s", (arb,)
    ).fetchone()
    assert before["updated_at"] == before["created_at"]

    conn.execute("update public.products set price = 500.00 where id = %s", (arb,))

    after = conn.execute(
        "select created_at, updated_at from public.products where id = %s", (arb,)
    ).fetchone()
    assert after["updated_at"] > before["updated_at"]
    assert after["created_at"] == before["created_at"]


# ------------------------------------------------------------ document numbers


def test_document_numbers_count_up_from_0001_within_a_company(conn, company):
    assert next_number(conn, company, "SO") == "SO-0001"
    assert next_number(conn, company, "SO") == "SO-0002"


def test_each_document_type_has_its_own_counter(conn, company):
    assert next_number(conn, company, "SO") == "SO-0001"
    assert next_number(conn, company, "INV") == "INV-0001"
    assert next_number(conn, company, "IN") == "IN-0001"
    assert next_number(conn, company, "OUT") == "OUT-0001"
    assert next_number(conn, company, "ADJ") == "ADJ-0001"
    assert next_number(conn, company, "SO") == "SO-0002"


def test_another_company_starts_its_own_numbering_at_0001(conn, company):
    other = support.create_test_company(conn, "other-numbers")
    try:
        assert next_number(conn, company, "SO") == "SO-0001"
        assert next_number(conn, company, "SO") == "SO-0002"
        assert next_number(conn, other, "SO") == "SO-0001"
    finally:
        support.drop_company(conn, other)


def test_a_rolled_back_transaction_does_not_burn_a_document_number(conn, company):
    with pytest.raises(RuntimeError):
        with conn.transaction():
            assert next_number(conn, company, "INV") == "INV-0001"
            raise RuntimeError("the confirm failed halfway")

    assert next_number(conn, company, "INV") == "INV-0001"


def test_numbers_past_9999_are_not_truncated(conn, company):
    assert next_number(conn, company, "SO") == "SO-0001"
    conn.execute(
        "update public.doc_counters set last_value = 9999 "
        "where company_id = %s and doc_type = 'SO'",
        (company,),
    )

    assert next_number(conn, company, "SO") == "SO-10000"


def test_an_unknown_document_type_is_refused(conn, company):
    with pytest.raises(errors.CheckViolation):
        next_number(conn, company, "XYZ")


# ------------------------------------------------------------------- security


def test_the_tables_from_the_spec_exist(conn):
    names = {
        r["relname"]
        for r in conn.execute(
            "select relname from pg_class where relnamespace = 'public'::regnamespace "
            "and relkind in ('r', 'p')"
        ).fetchall()
    }
    assert SPEC_TABLES <= names


def test_every_table_has_row_level_security_and_no_policies(conn):
    tables = conn.execute(
        "select relname, relrowsecurity from pg_class "
        "where relnamespace = 'public'::regnamespace and relkind in ('r', 'p')"
    ).fetchall()
    assert tables
    assert [t["relname"] for t in tables if not t["relrowsecurity"]] == []

    policies = conn.execute(
        "select count(*) as n from pg_policies where schemaname = 'public'"
    ).fetchone()
    assert policies["n"] == 0


@pytest.mark.parametrize("role", ["anon", "authenticated"])
def test_browser_roles_cannot_select_any_table_or_view(conn, role):
    relations = conn.execute(
        """
        select c.relname, has_table_privilege(%s, c.oid, 'select') as can_select
        from pg_class c
        where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v')
        """,
        (role,),
    ).fetchall()
    assert {r["relname"] for r in relations} >= SPEC_TABLES | {"stock_on_hand"}
    assert [r["relname"] for r in relations if r["can_select"]] == []


def test_stock_on_hand_is_a_security_invoker_view(conn):
    row = conn.execute(
        "select relkind, reloptions from pg_class "
        "where relnamespace = 'public'::regnamespace and relname = 'stock_on_hand'"
    ).fetchone()
    assert row is not None and row["relkind"] == "v"
    assert "security_invoker=true" in (row["reloptions"] or [])


def test_functions_are_security_invoker_pinned_and_closed_to_browser_roles(conn):
    functions = conn.execute(
        """
        select p.proname, p.prosecdef, p.proconfig,
               has_function_privilege('anon', p.oid, 'execute') as anon_can_run,
               has_function_privilege('authenticated', p.oid, 'execute') as authed_can_run
        from pg_proc p
        where p.pronamespace = 'public'::regnamespace
        """
    ).fetchall()
    names = {f["proname"] for f in functions}
    assert {"next_doc_number"} <= names
    for f in functions:
        assert not f["prosecdef"], f"{f['proname']} must be security invoker"
        assert any(c.startswith("search_path=") for c in (f["proconfig"] or [])), (
            f"{f['proname']} must set search_path"
        )
        assert not f["anon_can_run"], f"anon can execute {f['proname']}"
        assert not f["authed_can_run"], f"authenticated can execute {f['proname']}"


def test_browser_roles_cannot_call_next_doc_number(conn, company):
    # The same refusal, observed by really running as the browser role.
    with pytest.raises(errors.InsufficientPrivilege):
        with conn.transaction():
            conn.execute("set local role anon")
            conn.execute("select public.next_doc_number(%s, 'SO')", (company,))
