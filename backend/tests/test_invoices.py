"""Ticket 10: Invoice list and detail (US-3, business rule 6, Overdue), read through the API.

Starting state of every test (from the harness): ARB-1KG 170 kg at 450.00, DRP-10 240 boxes at 150.00,
no orders, no invoices. Café Lune has Payment Terms of 30 days, Tax ID 0105561000011.

Real Invoices are made the way the business makes them: Sales create a Draft and Confirm it
(`_issue_invoice`). Invoices that must be old (Overdue) are inserted straight into the database with
the helpers of test_dashboard, because Confirm always dates an Invoice today.

Expected values are literals from the scenario, never recomputed the way the code does it:
20 x 450.00 = 9,000.00 + 630.00 VAT = 9,630.00 (INV-0001, due 30 days after the Invoice Date);
20 x 450.00 + 10 x 150.00 = 10,500.00 + 735.00 VAT = 11,235.00.

Roles (spec matrix): Admin, Sales and Accountant view Invoices; Warehouse gets 403 on every Invoice endpoint.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from tests.test_dashboard import insert_payment, insert_sale_state
from tests.test_sales_orders import _new_order, _set_price

INVOICES = "/api/invoices"
VIEWERS = ("admin", "sales", "accountant")


# ---------------------------------------------------------------- helpers


def _issue_invoice(client_as, customer: str = "Café Lune", lines=(("ARB-1KG", 20),)) -> dict:
    """Sales create a Draft and Confirm it. Returns the Invoice ref `{id, number}` of the order."""
    sales = client_as("sales")
    order = _new_order(sales, customer=customer, lines=list(lines))
    response = sales.post(f"/api/sales-orders/{order['id']}/confirm")
    assert response.status_code == 200, response.text
    return {**response.json()["invoice"], "order": {"id": order["id"], "number": order["number"]}}


def _bangkok_today(conn) -> date:
    return conn.execute("select (now() at time zone 'Asia/Bangkok')::date as d").fetchone()["d"]


def _numbers(page: dict) -> list[str]:
    return [item["number"] for item in page["items"]]


def _foreign_invoice(conn, company_id: int) -> int:
    """An Invoice of ANOTHER Company (INV-0001 there too), arranged directly in the database."""
    customer_id = conn.execute(
        "insert into public.customers (company_id, name, tax_id) values (%s, 'Other Café', '0105569999999') "
        "returning id",
        (company_id,),
    ).fetchone()["id"]
    order_id = conn.execute(
        "insert into public.sales_orders (company_id, number, customer_id, status, confirmed_at) "
        "values (%s, 'SO-0001', %s, 'confirmed', now()) returning id",
        (company_id, customer_id),
    ).fetchone()["id"]
    return conn.execute(
        """
        insert into public.invoices
            (company_id, number, order_id, customer_id, due_date, subtotal, vat, total)
        values (%s, 'INV-0001', %s, %s, (now() at time zone 'Asia/Bangkok')::date + 30, 100.00, 7.00, 107.00)
        returning id
        """,
        (company_id, order_id, customer_id),
    ).fetchone()["id"]


# ------------------------------------------------------------------ roles


@pytest.mark.parametrize("role", VIEWERS)
def test_admin_sales_and_accountant_can_list_invoices(client_as, role):
    response = client_as(role).get(INVOICES)

    assert response.status_code == 200, response.text
    assert response.json() == {"items": [], "total": 0, "page": 1, "page_size": 20}


@pytest.mark.parametrize("role", VIEWERS)
def test_admin_sales_and_accountant_can_open_an_invoice(client_as, role):
    invoice = _issue_invoice(client_as)

    response = client_as(role).get(f"{INVOICES}/{invoice['id']}")

    assert response.status_code == 200, response.text
    assert response.json()["number"] == "INV-0001"


def test_warehouse_gets_403_on_every_invoice_endpoint(client_as):
    invoice = _issue_invoice(client_as)
    warehouse = client_as("warehouse")

    assert warehouse.get(INVOICES).status_code == 403
    assert warehouse.get(f"{INVOICES}/{invoice['id']}").status_code == 403
    assert (
        warehouse.post(f"{INVOICES}/{invoice['id']}/payments", json={"amount": "1.00", "method": "cash"}).status_code
        == 403
    )


def test_no_token_is_401_on_the_invoice_endpoints(client):
    assert client.get(INVOICES).status_code == 401
    assert client.get(f"{INVOICES}/1").status_code == 401


# ------------------------------------------------------------------- list


def test_a_confirmed_order_shows_up_in_the_list_as_open_inv_0001(client_as, conn):
    _issue_invoice(client_as)

    page = client_as("accountant").get(INVOICES).json()

    assert page["total"] == 1
    [item] = page["items"]
    assert item["number"] == "INV-0001"
    assert item["customer"]["name"] == "Café Lune"
    assert item["total"] == "9630.00"
    assert item["paid"] == "0.00"
    assert item["balance"] == "9630.00"
    assert item["status"] == "open"
    assert item["overdue"] is False
    assert item["days_overdue"] == 0
    assert item["invoice_date"] == _bangkok_today(conn).isoformat()
    assert date.fromisoformat(item["due_date"]) - date.fromisoformat(item["invoice_date"]) == timedelta(days=30)


def test_the_list_is_newest_first(client_as):
    _issue_invoice(client_as)
    _issue_invoice(client_as, customer="Brew Lab Ari", lines=(("DRP-10", 10),))

    page = client_as("sales").get(INVOICES).json()

    assert _numbers(page) == ["INV-0002", "INV-0001"]
    assert page["items"][0]["total"] == "1605.00"  # 10 x 150.00 = 1,500.00 + 105.00 VAT


def test_search_finds_an_invoice_by_number_or_by_part_of_the_customer_name(client_as):
    _issue_invoice(client_as)
    _issue_invoice(client_as, customer="Brew Lab Ari", lines=(("DRP-10", 10),))
    sales = client_as("sales")

    assert _numbers(sales.get(INVOICES, params={"q": "INV-0001"}).json()) == ["INV-0001"]
    assert _numbers(sales.get(INVOICES, params={"q": "lune"}).json()) == ["INV-0001"]
    assert _numbers(sales.get(INVOICES, params={"q": "BREW"}).json()) == ["INV-0002"]
    nothing = sales.get(INVOICES, params={"q": "zzz"}).json()
    assert nothing == {"items": [], "total": 0, "page": 1, "page_size": 20}


def test_the_list_pages_at_most_20_rows(client_as, conn, test_company_id):
    for number in (1, 2, 3):
        insert_sale_state(conn, test_company_id, number=number)
    sales = client_as("sales")

    first = sales.get(INVOICES, params={"page_size": 2}).json()
    second = sales.get(INVOICES, params={"page_size": 2, "page": 2}).json()

    assert (first["total"], first["page"], first["page_size"]) == (3, 1, 2)
    assert _numbers(first) == ["INV-0003", "INV-0002"]
    assert _numbers(second) == ["INV-0001"]
    too_big = sales.get(INVOICES, params={"page_size": 21})
    assert too_big.status_code == 422


def test_status_filters_open_paid_and_overdue(client_as, conn, test_company_id):
    insert_sale_state(conn, test_company_id, number=1)  # open, due in 30 days
    insert_sale_state(conn, test_company_id, number=2, days_ago=45)  # open, due 15 days ago: Overdue
    insert_sale_state(conn, test_company_id, number=3, status="paid")
    sales = client_as("sales")

    assert _numbers(sales.get(INVOICES, params={"status": "open"}).json()) == ["INV-0002", "INV-0001"]
    assert _numbers(sales.get(INVOICES, params={"status": "paid"}).json()) == ["INV-0003"]
    assert _numbers(sales.get(INVOICES, params={"status": "overdue"}).json()) == ["INV-0002"]
    assert sales.get(INVOICES, params={"status": "bogus"}).status_code == 422


def test_the_list_only_shows_the_callers_company(client_as, conn, company):
    _foreign_invoice(conn, company)
    _issue_invoice(client_as)

    page = client_as("admin").get(INVOICES).json()

    assert page["total"] == 1
    assert page["items"][0]["customer"]["name"] == "Café Lune"


# ---------------------------------------------------------------- Overdue


def test_an_open_invoice_due_yesterday_is_overdue_by_one_day(client_as, conn, test_company_id):
    insert_sale_state(conn, test_company_id, number=1, days_ago=31)  # 30 days of terms, due yesterday (Bangkok)

    [item] = client_as("sales").get(INVOICES).json()["items"]

    assert item["status"] == "open"
    assert item["overdue"] is True
    assert item["days_overdue"] == 1


def test_an_invoice_due_today_is_not_overdue_yet(client_as, conn, test_company_id):
    insert_sale_state(conn, test_company_id, number=1, days_ago=30)  # due today (Bangkok)

    [item] = client_as("sales").get(INVOICES).json()["items"]

    assert item["overdue"] is False
    assert item["days_overdue"] == 0


def test_a_paid_invoice_is_never_overdue_even_long_after_its_due_date(client_as, conn, test_company_id):
    invoice_id = insert_sale_state(conn, test_company_id, number=1, days_ago=90, status="paid")

    [item] = client_as("sales").get(INVOICES).json()["items"]
    detail = client_as("sales").get(f"{INVOICES}/{invoice_id}").json()

    assert item["status"] == "paid"
    assert item["overdue"] is False
    assert detail["overdue"] is False


def test_a_partly_paid_invoice_past_its_due_date_is_still_overdue(client_as, conn, test_company_id):
    invoice_id = insert_sale_state(conn, test_company_id, number=1, days_ago=45)
    insert_payment(conn, test_company_id, invoice_id, "5000.00")

    detail = client_as("accountant").get(f"{INVOICES}/{invoice_id}").json()

    assert detail["status"] == "open"
    assert detail["overdue"] is True
    assert detail["days_overdue"] == 15
    assert detail["balance"] == "4630.00"


# ----------------------------------------------------------------- detail


def test_detail_shows_customer_tax_id_lines_totals_due_date_and_the_order_link(client_as, conn):
    issued = _issue_invoice(client_as)

    detail = client_as("accountant").get(f"{INVOICES}/{issued['id']}").json()

    assert detail["id"] == issued["id"]
    assert detail["number"] == "INV-0001"
    assert detail["status"] == "open"
    assert detail["overdue"] is False
    assert detail["customer"]["name"] == "Café Lune"
    assert detail["customer"]["tax_id"] == "0105561000011"
    assert detail["customer"]["payment_terms_days"] == 30
    assert detail["customer"]["address"] == "88 Soi Ari 1, Phaya Thai, Bangkok 10400"
    [line] = detail["lines"]
    assert (line["sku"], line["name"], line["unit"]) == ("ARB-1KG", "Arabica, 1 kg bag", "kg")
    assert (line["quantity"], line["unit_price"], line["amount"]) == (20, "450.00", "9000.00")
    assert (detail["subtotal"], detail["vat"], detail["total"]) == ("9000.00", "630.00", "9630.00")
    assert (detail["paid"], detail["balance"]) == ("0.00", "9630.00")
    assert detail["payments"] == []
    assert detail["invoice_date"] == _bangkok_today(conn).isoformat()
    assert date.fromisoformat(detail["due_date"]) - date.fromisoformat(detail["invoice_date"]) == timedelta(days=30)
    assert detail["order"] == issued["order"]  # {"id": ..., "number": "SO-0001"}


def test_detail_of_an_invoice_with_two_lines_adds_up_the_vat_on_the_whole_subtotal(client_as):
    issued = _issue_invoice(client_as, lines=(("ARB-1KG", 20), ("DRP-10", 10)))

    detail = client_as("sales").get(f"{INVOICES}/{issued['id']}").json()

    assert [(line["sku"], line["amount"]) for line in detail["lines"]] == [
        ("ARB-1KG", "9000.00"),
        ("DRP-10", "1500.00"),
    ]
    assert (detail["subtotal"], detail["vat"], detail["total"]) == ("10500.00", "735.00", "11235.00")


def test_changing_a_product_price_later_never_changes_an_issued_invoice(client_as):
    issued = _issue_invoice(client_as)
    _set_price(client_as("admin"), "ARB-1KG", "500.00")

    detail = client_as("sales").get(f"{INVOICES}/{issued['id']}").json()

    assert detail["lines"][0]["unit_price"] == "450.00"
    assert (detail["subtotal"], detail["vat"], detail["total"]) == ("9000.00", "630.00", "9630.00")


def test_an_unknown_invoice_is_404(client_as):
    response = client_as("accountant").get(f"{INVOICES}/999999999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Invoice not found"}


def test_another_companys_invoice_is_404_not_403(client_as, conn, company):
    foreign_id = _foreign_invoice(conn, company)

    response = client_as("admin").get(f"{INVOICES}/{foreign_id}")

    assert response.status_code == 404
    assert response.json() == {"detail": "Invoice not found"}
