"""Ticket 12 (bonus): GET /api/invoices/{id}/pdf downloads an Invoice as a PDF.

Starting state (harness): ARB-1KG 170 kg at 450.00, Café Lune with 30 days terms, no orders.
US-1 gives the expected values, as literals from the scenario: 20 x ARB-1KG = 9,000.00,
VAT 630.00, Total 9,630.00, INV-0001.

Invoices are made through the real API flow (draft, add lines, confirm). Payments have no
endpoint in this branch (ticket 10), so they are inserted straight in the TEST company.
The PDF text is read back with pypdf.
"""

from __future__ import annotations

import io

import pytest
from pypdf import PdfReader

from tests.test_sales_orders import _new_order, _product, _set_price

VIEWERS = ("admin", "sales", "accountant")
COMPANY_TAX_ID = "0105559012345"
COMPANY_ADDRESS = "99 Sukhumvit Road, Bangkok 10110"


def _confirmed_invoice(client, lines=(("ARB-1KG", 20),)) -> dict:
    order = _new_order(client, lines=list(lines))
    response = client.post(f"/api/sales-orders/{order['id']}/confirm")
    assert response.status_code == 200, response.text
    return response.json()["invoice"]


def _pdf_text(response) -> str:
    assert response.status_code == 200, response.text
    reader = PdfReader(io.BytesIO(response.content))
    return "\n".join(page.extract_text() for page in reader.pages)


def _set_company_details(conn, company_id: int) -> None:
    conn.execute(
        "update public.companies set tax_id = %s, address = %s where id = %s",
        (COMPANY_TAX_ID, COMPANY_ADDRESS, company_id),
    )


def _customer_row(conn, company_id: int, name: str = "Café Lune") -> dict:
    return conn.execute(
        "select id, name, tax_id, address from public.customers where company_id = %s and name = %s",
        (company_id, name),
    ).fetchone()


# ------------------------------------------------------------ who may download


@pytest.mark.parametrize("role", VIEWERS)
def test_admin_sales_and_accountant_get_a_pdf_named_after_the_invoice(
    client_as, test_company_id, role
):
    invoice = _confirmed_invoice(client_as("sales"))

    response = client_as(role).get(f"/api/invoices/{invoice['id']}/pdf")

    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    assert "INV-0001" in response.headers["content-disposition"]
    assert ".pdf" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF")


def test_warehouse_cannot_download_an_invoice_pdf(client_as, test_company_id):
    invoice = _confirmed_invoice(client_as("sales"))

    response = client_as("warehouse").get(f"/api/invoices/{invoice['id']}/pdf")

    assert response.status_code == 403
    assert "detail" in response.json()


def test_no_token_is_401(client, client_as, test_company_id):
    invoice = _confirmed_invoice(client_as("sales"))

    assert client.get(f"/api/invoices/{invoice['id']}/pdf").status_code == 401


def test_an_unknown_invoice_is_404(client_as, test_company_id):
    response = client_as("sales").get("/api/invoices/999999999/pdf")

    assert response.status_code == 404
    assert "detail" in response.json()


def test_another_companys_invoice_is_404(client_as, conn, test_company_id, company):
    """`company` is a separate TEST company; its Invoice must stay invisible to ours."""
    customer_id = conn.execute(
        "insert into public.customers (company_id, name, tax_id) values (%s, 'Other Co', '0105500000001') returning id",
        (company,),
    ).fetchone()["id"]
    order_id = conn.execute(
        "insert into public.sales_orders (company_id, number, customer_id, status) "
        "values (%s, 'SO-0001', %s, 'confirmed') returning id",
        (company, customer_id),
    ).fetchone()["id"]
    invoice_id = conn.execute(
        "insert into public.invoices (company_id, number, order_id, customer_id, due_date, subtotal, vat, total) "
        "values (%s, 'INV-0001', %s, %s, current_date + 30, 100, 7, 107) returning id",
        (company, order_id, customer_id),
    ).fetchone()["id"]

    response = client_as("admin").get(f"/api/invoices/{invoice_id}/pdf")

    assert response.status_code == 404


# ------------------------------------------------------------------ the content


def test_the_pdf_shows_the_invoice_with_both_tax_ids_and_the_scenario_amounts(
    client_as, conn, test_company_id
):
    _set_company_details(conn, test_company_id)
    cafe = _customer_row(conn, test_company_id)
    invoice = _confirmed_invoice(client_as("sales"))

    text = _pdf_text(client_as("accountant").get(f"/api/invoices/{invoice['id']}/pdf"))

    assert "INV-0001" in text
    assert "9,000.00" in text
    assert "630.00" in text
    assert "9,630.00" in text
    assert "9,630.00 THB" in text
    assert COMPANY_TAX_ID in text
    assert COMPANY_ADDRESS in text
    assert cafe["tax_id"] in text
    assert "Café Lune" in text
    # the line: SKU, quantity with unit, unit price
    assert "ARB-1KG" in text
    assert "20 kg" in text
    assert "450.00" in text
    # VAT is labelled as 7%
    assert "7%" in text


def test_the_pdf_shows_invoice_date_and_due_date_30_days_later(client_as, conn, test_company_id):
    invoice = _confirmed_invoice(client_as("sales"))
    row = conn.execute(
        "select invoice_date, due_date from public.invoices where id = %s", (invoice["id"],)
    ).fetchone()
    assert (row["due_date"] - row["invoice_date"]).days == 30

    text = _pdf_text(client_as("sales").get(f"/api/invoices/{invoice['id']}/pdf"))

    assert f"{row['invoice_date']:%d %b %Y}".lstrip("0") in text
    assert f"{row['due_date']:%d %b %Y}".lstrip("0") in text


def test_a_later_price_change_does_not_change_the_pdf(client_as, test_company_id):
    sales = client_as("sales")
    invoice = _confirmed_invoice(sales)
    before = _pdf_text(sales.get(f"/api/invoices/{invoice['id']}/pdf"))

    _set_price(client_as("admin"), "ARB-1KG", "999.00")
    assert _product(sales, "ARB-1KG")["price"] == "999.00"
    after = _pdf_text(sales.get(f"/api/invoices/{invoice['id']}/pdf"))

    assert "450.00" in after
    assert "9,000.00" in after
    assert "9,630.00" in after
    assert "999.00" not in after
    assert "9,990.00" not in after
    assert after == before


def test_an_unpaid_invoice_shows_paid_zero_and_the_full_balance(client_as, test_company_id):
    invoice = _confirmed_invoice(client_as("sales"))

    text = _pdf_text(client_as("sales").get(f"/api/invoices/{invoice['id']}/pdf"))

    assert "Paid" in text
    assert "Balance" in text
    assert "0.00 THB" in text
    assert text.count("9,630.00 THB") >= 2  # Total and Balance


def test_after_a_partial_payment_the_pdf_shows_paid_and_balance(client_as, conn, test_company_id):
    invoice = _confirmed_invoice(client_as("sales"))
    for amount in ("2000.00", "1000.00"):
        conn.execute(
            "insert into public.payments (company_id, invoice_id, amount, method) "
            "values (%s, %s, %s, 'transfer')",
            (test_company_id, invoice["id"], amount),
        )

    text = _pdf_text(client_as("accountant").get(f"/api/invoices/{invoice['id']}/pdf"))

    assert "3,000.00 THB" in text  # Paid: the two payments added up
    assert "6,630.00 THB" in text  # Balance: 9,630.00 - 3,000.00


def test_several_lines_and_missing_company_details_still_make_a_pdf(client_as, test_company_id):
    """The TEST company has no tax id or address by default: the PDF must not crash on that."""
    invoice = _confirmed_invoice(client_as("sales"), lines=(("ARB-1KG", 20), ("DRP-10", 3)))

    text = _pdf_text(client_as("sales").get(f"/api/invoices/{invoice['id']}/pdf"))

    assert "ARB-1KG" in text
    assert "DRP-10" in text
    assert "INV-0001" in text


def test_non_latin_text_does_not_crash_the_pdf(client_as, conn, test_company_id):
    invoice = _confirmed_invoice(client_as("sales"))
    conn.execute(
        "update public.customers set address = %s where company_id = %s and name = 'Café Lune'",
        ("เลขที่ 1 ถนนสุขุมวิท กรุงเทพฯ 10110", test_company_id),
    )

    response = client_as("sales").get(f"/api/invoices/{invoice['id']}/pdf")

    assert response.status_code == 200, response.text
    text = _pdf_text(response)
    assert "INV-0001" in text
    assert "9,630.00" in text
