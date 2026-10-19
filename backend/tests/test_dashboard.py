"""Ticket 11: the Dashboard, four live numbers for every Role (US-1, US-2, US-4).

Starting state of every test (from the harness): ARB-1KG 170, ROB-1KG 35 (reorder level 40),
BLD-1KG 90, DRP-10 240, no orders, no invoices.

The Confirm API does not exist yet, so the US-1 state (order SO-0001, sale movement of 20 kg
ARB-1KG, Invoice INV-0001 of 9,630.00) is inserted straight into the database. Expected values
are literals from the scenario, never recomputed.
"""

from __future__ import annotations

import pytest

from tests import support

DASHBOARD = "/api/dashboard"
MOVEMENTS = "/api/stock/movements"


# ------------------------------------------------------------------ helpers


def bangkok_today(conn):
    return conn.execute("select (now() at time zone 'Asia/Bangkok')::date as d").fetchone()["d"]


def _id_of(conn, table: str, company_id: int, column: str, value: str) -> int:
    return conn.execute(
        f"select id from public.{table} where company_id = %s and {column} = %s", (company_id, value)
    ).fetchone()["id"]


def insert_sale_state(conn, company_id: int, *, number: int = 1, days_ago: int = 0, status: str = "open"):
    """US-1 after Confirm: SO-000n confirmed for Café Lune, 20 x ARB-1KG, sale movement, INV-000n.

    Returns the invoice id. `days_ago` moves the invoice date back (Bangkok calendar).
    """
    customer_id = _id_of(conn, "customers", company_id, "name", "Café Lune")
    product_id = _id_of(conn, "products", company_id, "sku", "ARB-1KG")
    so_number, inv_number = f"SO-{number:04d}", f"INV-{number:04d}"
    order_id = conn.execute(
        """
        insert into public.sales_orders (company_id, number, customer_id, status, confirmed_at)
        values (%s, %s, %s, 'confirmed', now()) returning id
        """,
        (company_id, so_number, customer_id),
    ).fetchone()["id"]
    conn.execute(
        """
        insert into public.order_items (company_id, order_id, product_id, quantity, unit_price, unit_cost)
        values (%s, %s, %s, 20, 450.00, 320.00)
        """,
        (company_id, order_id, product_id),
    )
    support.insert_movement(conn, company_id, product_id, -20, "sale", ref_doc=inv_number)
    return conn.execute(
        """
        insert into public.invoices
            (company_id, number, order_id, customer_id, invoice_date, due_date,
             subtotal, vat, total, status)
        values (%s, %s, %s, %s,
                (now() at time zone 'Asia/Bangkok')::date - %s,
                (now() at time zone 'Asia/Bangkok')::date - %s + 30,
                9000.00, 630.00, 9630.00, %s)
        returning id
        """,
        (company_id, inv_number, order_id, customer_id, days_ago, days_ago, status),
    ).fetchone()["id"]


def insert_payment(conn, company_id: int, invoice_id: int, amount: str) -> None:
    conn.execute(
        """
        insert into public.payments (company_id, invoice_id, amount, method)
        values (%s, %s, %s, 'transfer')
        """,
        (company_id, invoice_id, amount),
    )


def mark_paid(conn, invoice_id: int) -> None:
    conn.execute("update public.invoices set status = 'paid' where id = %s", (invoice_id,))


def dashboard(client) -> dict:
    response = client.get(DASHBOARD)
    assert response.status_code == 200, response.text
    return response.json()


# ------------------------------------------------------------ who may open it


@pytest.mark.parametrize("role", ["admin", "sales", "warehouse", "accountant"])
def test_every_role_can_open_the_dashboard(client_as, role):
    assert client_as(role).get(DASHBOARD).status_code == 200


def test_no_token_is_refused(client):
    assert client.get(DASHBOARD).status_code == 401


# ------------------------------------------------------------- clean company


def test_a_clean_company_shows_low_stock_1_and_stock_value_107100(client_as):
    body = dashboard(client_as("sales"))

    assert body["sales_today"] == "0.00"
    assert body["low_stock_count"] == 1
    assert body["open_invoices"] == {"count": 0, "amount": "0.00"}
    assert body["stock_value"] == "107100.00"


def test_as_of_is_the_bangkok_date(client_as, conn):
    body = dashboard(client_as("sales"))

    assert body["as_of"] == bangkok_today(conn).isoformat()


# ---------------------------------------------------------------- Low Stock


def test_stock_in_of_10_rob_1kg_clears_low_stock(client_as):
    warehouse = client_as("warehouse")
    products = warehouse.get("/api/stock/products").json()
    rob = next(p["id"] for p in products if p["sku"] == "ROB-1KG")

    response = warehouse.post(MOVEMENTS, json={"product_id": rob, "movement_type": "in", "quantity": 10})
    assert response.status_code == 201

    body = dashboard(warehouse)
    assert body["low_stock_count"] == 0
    assert body["stock_value"] == "109300.00"  # 107,100.00 + 10 x 220.00


def test_a_deactivated_product_is_not_counted_in_low_stock_or_stock_value(client_as, conn, test_company_id):
    conn.execute(
        "update public.products set active = false where company_id = %s and sku = 'ROB-1KG'",
        (test_company_id,),
    )

    body = dashboard(client_as("admin"))

    assert body["low_stock_count"] == 0
    assert body["stock_value"] == "99400.00"  # 107,100.00 - 35 x 220.00


# ---------------------------------------------------- after the US-1 Confirm


def test_after_the_us1_confirm_the_invoice_tiles_show_9630(client_as, conn, test_company_id):
    insert_sale_state(conn, test_company_id)

    body = dashboard(client_as("accountant"))

    assert body["sales_today"] == "9630.00"
    assert body["open_invoices"] == {"count": 1, "amount": "9630.00"}
    assert body["stock_value"] == "100700.00"


def test_the_real_us1_flow_through_the_api_moves_all_four_dashboard_tiles(client_as):
    """No rows inserted by hand: Nok drafts and confirms Café Lune's 20 x ARB-1KG, then reads the Dashboard.

    Owed since the dashboard ticket (the Confirm API did not exist yet). The expected values are the
    scenario's: 9,630.00 sold today and owed, stock 107,100.00 - 20 x 320.00 = 100,700.00, and
    ROB-1KG (35 < 40) still the one Low Stock Product.
    """
    sales, accountant = client_as("sales"), client_as("accountant")
    before = dashboard(accountant)
    assert before["sales_today"] == "0.00"
    assert before["stock_value"] == "107100.00"

    lune = next(c for c in sales.get("/api/customers", params={"q": "Café Lune"}).json()["items"] if c["name"] == "Café Lune")
    arb = next(p for p in sales.get("/api/products", params={"q": "ARB-1KG"}).json()["items"] if p["sku"] == "ARB-1KG")
    draft = sales.post(
        "/api/sales-orders",
        json={"customer_id": lune["id"], "lines": [{"product_id": arb["id"], "quantity": 20}]},
    )
    assert draft.status_code == 201, draft.text
    confirmed = sales.post(f"/api/sales-orders/{draft.json()['id']}/confirm")
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["invoice"]["number"] == "INV-0001"

    for role_client in (accountant, sales):  # every Role sees the same numbers
        body = dashboard(role_client)
        assert body["sales_today"] == "9630.00"
        assert body["open_invoices"] == {"count": 1, "amount": "9630.00"}
        assert body["stock_value"] == "100700.00"
        assert body["low_stock_count"] == 1


def test_a_refused_confirm_leaves_the_dashboard_as_it_was(client_as):
    sales, accountant = client_as("sales"), client_as("accountant")
    before = dashboard(accountant)
    lune = next(c for c in sales.get("/api/customers", params={"q": "Café Lune"}).json()["items"] if c["name"] == "Café Lune")
    arb = next(p for p in sales.get("/api/products", params={"q": "ARB-1KG"}).json()["items"] if p["sku"] == "ARB-1KG")
    draft = sales.post(
        "/api/sales-orders",
        json={"customer_id": lune["id"], "lines": [{"product_id": arb["id"], "quantity": 171}]},
    ).json()

    refused = sales.post(f"/api/sales-orders/{draft['id']}/confirm")

    assert refused.status_code == 409
    assert dashboard(accountant) == before


def test_a_full_payment_closes_the_invoice_but_sales_today_stays(client_as, conn, test_company_id):
    invoice_id = insert_sale_state(conn, test_company_id)
    insert_payment(conn, test_company_id, invoice_id, "9630.00")
    mark_paid(conn, invoice_id)

    body = dashboard(client_as("accountant"))

    assert body["open_invoices"] == {"count": 0, "amount": "0.00"}
    assert body["sales_today"] == "9630.00"


def test_a_partial_payment_of_5000_leaves_4630_receivable(client_as, conn, test_company_id):
    invoice_id = insert_sale_state(conn, test_company_id)
    insert_payment(conn, test_company_id, invoice_id, "5000.00")

    body = dashboard(client_as("accountant"))

    assert body["open_invoices"] == {"count": 1, "amount": "4630.00"}


def test_two_partial_payments_are_both_subtracted(client_as, conn, test_company_id):
    invoice_id = insert_sale_state(conn, test_company_id)
    insert_payment(conn, test_company_id, invoice_id, "5000.00")
    insert_payment(conn, test_company_id, invoice_id, "630.00")

    body = dashboard(client_as("accountant"))

    assert body["open_invoices"] == {"count": 1, "amount": "4000.00"}


def test_an_invoice_dated_yesterday_in_bangkok_is_not_sales_today(client_as, conn, test_company_id):
    insert_sale_state(conn, test_company_id, days_ago=1)

    body = dashboard(client_as("accountant"))

    assert body["sales_today"] == "0.00"
    assert body["open_invoices"] == {"count": 1, "amount": "9630.00"}  # still owed


def test_the_numbers_are_live_on_every_request(client_as, conn, test_company_id):
    accountant = client_as("accountant")
    assert dashboard(accountant)["open_invoices"]["count"] == 0

    invoice_id = insert_sale_state(conn, test_company_id)
    assert dashboard(accountant)["open_invoices"]["count"] == 1

    insert_payment(conn, test_company_id, invoice_id, "9630.00")
    mark_paid(conn, invoice_id)
    assert dashboard(accountant)["open_invoices"]["count"] == 0


# -------------------------------------------------------------- one company


def test_another_companys_invoice_is_not_counted(client_as, conn, test_company_id, company):
    # `company` is a separate empty throwaway company with its own product and customer.
    support.insert_customer(conn, company, name="Café Lune")
    arb = support.insert_product(conn, company, "ARB-1KG", cost="320.00")
    support.insert_movement(conn, company, arb, 170, "opening")
    insert_sale_state(conn, company)

    body = dashboard(client_as("sales"))

    assert body["sales_today"] == "0.00"
    assert body["open_invoices"] == {"count": 0, "amount": "0.00"}
    assert body["stock_value"] == "107100.00"
