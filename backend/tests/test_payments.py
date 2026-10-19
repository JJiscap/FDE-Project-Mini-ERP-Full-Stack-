"""Ticket 10: the Accounting screen's receivables and Payments (US-3, US-4).

Starting state of every test (from the harness): ARB-1KG 170 kg at 450.00, no orders, no invoices.
The Invoice under test is the real one from US-1: Sales confirm 20 kg of ARB-1KG for Café Lune, which
issues INV-0001 for 9,630.00 (9,000.00 + 630.00 VAT). The Accountant (Fon) then records Payments.

Expected values are literals from the scenario, never recomputed the way the code does it:
9,630.00 paid in full -> Paid, Balance 0.00, Open Receivables 0.00;
5,000.00 then 4,630.00 -> Balance 4,630.00, then Paid; 4,631.00 on a 4,630.00 Balance is refused.

Roles (spec matrix): the Accounting screen (receivables, record a Payment) is Admin and Accountant only.
Sales (US-3) and Warehouse get 403.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import pytest

from tests.test_dashboard import insert_payment, insert_sale_state
from tests.test_invoices import _bangkok_today, _foreign_invoice, _issue_invoice, _numbers

RECEIVABLES = "/api/accounting/receivables"
DASHBOARD = "/api/dashboard"
ACCOUNTING_ROLES = ("admin", "accountant")


# ---------------------------------------------------------------- helpers


def _pay(client, invoice_id: int, amount, method: str = "transfer", **extra):
    return client.post(
        f"/api/invoices/{invoice_id}/payments", json={"amount": amount, "method": method, **extra}
    )


def _detail(client, invoice_id: int) -> dict:
    response = client.get(f"/api/invoices/{invoice_id}")
    assert response.status_code == 200, response.text
    return response.json()


def _assert_untouched(client, invoice_id: int) -> None:
    """The Invoice is still Open, owes the full 9,630.00 and has no Payment."""
    detail = _detail(client, invoice_id)
    assert detail["status"] == "open"
    assert detail["payments"] == []
    assert (detail["paid"], detail["balance"]) == ("0.00", "9630.00")


# --------------------------------------------------- US-4: a full Payment


def test_us4_a_full_payment_makes_inv_0001_paid_and_drops_open_receivables_by_9630(client_as):
    issued = _issue_invoice(client_as)
    fon = client_as("accountant")

    receivables = fon.get(RECEIVABLES).json()
    assert receivables["open_receivables"] == "9630.00"
    assert receivables["total"] == 1
    [owed] = receivables["items"]
    assert (owed["number"], owed["total"], owed["balance"]) == ("INV-0001", "9630.00", "9630.00")
    assert fon.get(DASHBOARD).json()["open_invoices"] == {"count": 1, "amount": "9630.00"}

    response = _pay(fon, issued["id"], "9630.00")

    assert response.status_code == 201, response.text
    paid = response.json()
    assert paid["number"] == "INV-0001"
    assert paid["status"] == "paid"
    assert (paid["paid"], paid["balance"]) == ("9630.00", "0.00")
    assert paid["overdue"] is False
    [payment] = paid["payments"]
    assert payment["amount"] == "9630.00"
    assert payment["method"] == "transfer"
    assert payment["note"] is None

    # The follow-up reads agree on every screen.
    assert _detail(fon, issued["id"])["status"] == "paid"
    [listed] = fon.get("/api/invoices").json()["items"]
    assert (listed["status"], listed["balance"]) == ("paid", "0.00")
    receivables = fon.get(RECEIVABLES).json()
    assert (receivables["items"], receivables["total"], receivables["open_receivables"]) == ([], 0, "0.00")
    dashboard = fon.get(DASHBOARD).json()
    assert dashboard["open_invoices"] == {"count": 0, "amount": "0.00"}
    assert dashboard["sales_today"] == "9630.00"  # the sale itself does not go away


def test_a_payment_is_dated_today_in_bangkok_unless_a_date_is_given_and_keeps_its_note(client_as, conn):
    issued = _issue_invoice(client_as)
    fon = client_as("accountant")

    first = _pay(fon, issued["id"], "1000.00", method="cash", note="  Cash at the counter ").json()
    second = _pay(fon, issued["id"], "2000.00", method="cheque", paid_on="2026-10-19", note="Cheque 0123").json()

    payments = {p["amount"]: p for p in second["payments"]}
    assert payments["1000.00"]["paid_on"] == _bangkok_today(conn).isoformat()
    assert payments["1000.00"]["method"] == "cash"
    assert payments["1000.00"]["note"] == "Cash at the counter"
    assert payments["2000.00"]["paid_on"] == "2026-10-19"
    assert payments["2000.00"]["method"] == "cheque"
    assert payments["2000.00"]["note"] == "Cheque 0123"
    assert first["balance"] == "8630.00"
    assert second["balance"] == "6630.00"


def test_a_blank_note_is_stored_as_no_note(client_as):
    issued = _issue_invoice(client_as)

    paid = _pay(client_as("accountant"), issued["id"], "100.00", note="   ").json()

    assert paid["payments"][0]["note"] is None


def test_payments_are_listed_oldest_first_on_the_invoice(client_as):
    issued = _issue_invoice(client_as)
    fon = client_as("accountant")
    _pay(fon, issued["id"], "5000.00")
    _pay(fon, issued["id"], "4630.00")

    detail = _detail(client_as("sales"), issued["id"])  # Sales may see the Payments, not record them

    assert [p["amount"] for p in detail["payments"]] == ["5000.00", "4630.00"]


# ------------------------------------------------ US-4: partial Payments


def test_a_partial_payment_of_5000_leaves_it_open_with_a_balance_of_4630(client_as):
    issued = _issue_invoice(client_as)
    fon = client_as("accountant")

    response = _pay(fon, issued["id"], "5000.00")

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "open"
    assert (body["paid"], body["balance"]) == ("5000.00", "4630.00")
    [owed] = fon.get(RECEIVABLES).json()["items"]
    assert (owed["total"], owed["paid"], owed["balance"]) == ("9630.00", "5000.00", "4630.00")
    assert fon.get(RECEIVABLES).json()["open_receivables"] == "4630.00"
    assert fon.get(DASHBOARD).json()["open_invoices"] == {"count": 1, "amount": "4630.00"}


def test_paying_4631_on_a_balance_of_4630_is_refused_naming_the_balance_and_changes_nothing(client_as):
    issued = _issue_invoice(client_as)
    fon = client_as("accountant")
    assert _pay(fon, issued["id"], "5000.00").status_code == 201

    response = _pay(fon, issued["id"], "4631.00")

    assert response.status_code == 409
    assert response.json() == {"detail": "Payment is more than the balance of 4,630.00 THB"}
    detail = _detail(fon, issued["id"])
    assert detail["status"] == "open"
    assert detail["balance"] == "4630.00"
    assert [p["amount"] for p in detail["payments"]] == ["5000.00"]
    assert fon.get(DASHBOARD).json()["open_invoices"] == {"count": 1, "amount": "4630.00"}


def test_the_rest_of_the_balance_then_makes_it_paid(client_as):
    issued = _issue_invoice(client_as)
    fon = client_as("accountant")
    _pay(fon, issued["id"], "5000.00")

    response = _pay(fon, issued["id"], "4630.00")

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "paid"
    assert (body["paid"], body["balance"]) == ("9630.00", "0.00")
    assert [p["amount"] for p in body["payments"]] == ["5000.00", "4630.00"]
    assert fon.get(RECEIVABLES).json()["open_receivables"] == "0.00"
    assert fon.get(DASHBOARD).json()["open_invoices"] == {"count": 0, "amount": "0.00"}


def test_one_satang_more_than_the_full_total_is_refused(client_as):
    issued = _issue_invoice(client_as)
    fon = client_as("accountant")

    response = _pay(fon, issued["id"], "9630.01")

    assert response.status_code == 409
    assert response.json() == {"detail": "Payment is more than the balance of 9,630.00 THB"}
    _assert_untouched(fon, issued["id"])


def test_a_payment_of_one_satang_is_allowed(client_as):
    issued = _issue_invoice(client_as)

    body = _pay(client_as("accountant"), issued["id"], "0.01").json()

    assert (body["status"], body["paid"], body["balance"]) == ("open", "0.01", "9629.99")


# ------------------------------------------------ refusals: Paid, bad input


def test_a_payment_on_a_paid_invoice_is_409_and_records_nothing(client_as):
    issued = _issue_invoice(client_as)
    fon = client_as("accountant")
    assert _pay(fon, issued["id"], "9630.00").status_code == 201

    response = _pay(fon, issued["id"], "1.00")

    assert response.status_code == 409
    assert response.json() == {"detail": "INV-0001 is already paid"}
    assert [p["amount"] for p in _detail(fon, issued["id"])["payments"]] == ["9630.00"]


@pytest.mark.parametrize("amount", ["0", "0.00", "-5", "-0.01", 0, -100])
def test_a_payment_of_zero_or_less_is_refused_and_says_what_to_fix(client_as, amount):
    issued = _issue_invoice(client_as)
    fon = client_as("accountant")

    response = _pay(fon, issued["id"], amount)

    assert response.status_code == 422
    assert response.json() == {"detail": "Amount must be greater than 0"}
    _assert_untouched(fon, issued["id"])


@pytest.mark.parametrize(
    ("body", "message"),
    [
        ({"method": "cash"}, "Amount is required"),
        ({"amount": "abc", "method": "cash"}, "Amount must be a number"),
        ({"amount": "10.001", "method": "cash"}, "Amount can have at most 2 decimal places"),
        ({"amount": "12345678901.00", "method": "cash"}, "Amount is too large"),
        ({"amount": "100.00"}, "Method is required"),
        ({"amount": "100.00", "method": "bitcoin"}, "Method must be transfer, cash or cheque"),
        ({"amount": "100.00", "method": "cash", "paid_on": "31/10/2026"}, "Paid on must be a date like 2026-10-22"),
        ({"amount": "100.00", "method": "cash", "note": "x" * 501}, "Note must be at most 500 characters"),
    ],
)
def test_bad_payment_input_is_refused_with_one_readable_sentence(client_as, body, message):
    issued = _issue_invoice(client_as)
    fon = client_as("accountant")

    response = fon.post(f"/api/invoices/{issued['id']}/payments", json=body)

    assert response.status_code == 422
    assert response.json() == {"detail": message}
    _assert_untouched(fon, issued["id"])


def test_a_payment_on_an_unknown_invoice_is_404(client_as):
    response = _pay(client_as("accountant"), 999999999, "100.00")

    assert response.status_code == 404
    assert response.json() == {"detail": "Invoice not found"}


def test_a_payment_on_another_companys_invoice_is_404_and_writes_nothing(client_as, conn, company):
    foreign_id = _foreign_invoice(conn, company)

    response = _pay(client_as("admin"), foreign_id, "10.00")

    assert response.status_code == 404
    assert response.json() == {"detail": "Invoice not found"}
    count = conn.execute("select count(*) as n from public.payments where invoice_id = %s", (foreign_id,))
    assert count.fetchone()["n"] == 0


# ------------------------------------------------------- US-3: the Roles


@pytest.mark.parametrize("role", ["sales", "warehouse"])
def test_us3_sales_and_warehouse_cannot_open_the_receivables(client_as, role):
    _issue_invoice(client_as)

    response = client_as(role).get(RECEIVABLES)

    assert response.status_code == 403
    assert "not allowed" in response.json()["detail"]


@pytest.mark.parametrize("role", ["sales", "warehouse"])
def test_us3_sales_and_warehouse_cannot_record_a_payment_and_nothing_is_recorded(client_as, role):
    issued = _issue_invoice(client_as)

    response = _pay(client_as(role), issued["id"], "9630.00")

    assert response.status_code == 403
    _assert_untouched(client_as("admin"), issued["id"])


@pytest.mark.parametrize("role", ACCOUNTING_ROLES)
def test_admin_and_accountant_can_open_the_receivables(client_as, role):
    response = client_as(role).get(RECEIVABLES)

    assert response.status_code == 200, response.text
    assert response.json() == {
        "items": [],
        "total": 0,
        "page": 1,
        "page_size": 20,
        "open_receivables": "0.00",
        "overdue_count": 0,
        "overdue_receivables": "0.00",
    }


def test_admin_can_record_a_payment_too(client_as):
    issued = _issue_invoice(client_as)

    response = _pay(client_as("admin"), issued["id"], "9630.00")

    assert response.status_code == 201, response.text
    assert response.json()["status"] == "paid"


def test_no_token_is_401_on_receivables_and_payments(client):
    assert client.get(RECEIVABLES).status_code == 401
    assert client.post("/api/invoices/1/payments", json={"amount": "1.00", "method": "cash"}).status_code == 401


def test_the_role_is_checked_before_the_body(client_as):
    issued = _issue_invoice(client_as)

    response = client_as("sales").post(f"/api/invoices/{issued['id']}/payments", json={})

    assert response.status_code == 403


# --------------------------------------------------- the receivables list


def test_receivables_list_open_invoices_overdue_first_with_balances_and_the_total(client_as, conn, test_company_id):
    insert_sale_state(conn, test_company_id, number=1)  # open, due in 30 days
    overdue_id = insert_sale_state(conn, test_company_id, number=2, days_ago=45)  # due 15 days ago
    insert_sale_state(conn, test_company_id, number=3, days_ago=31)  # due yesterday
    insert_sale_state(conn, test_company_id, number=4, status="paid")  # not owed
    insert_payment(conn, test_company_id, overdue_id, "5000.00")

    receivables = client_as("accountant").get(RECEIVABLES).json()

    assert _numbers(receivables) == ["INV-0002", "INV-0003", "INV-0001"]  # most overdue first
    assert receivables["total"] == 3
    # 4,630.00 + 9,630.00 + 9,630.00
    assert receivables["open_receivables"] == "23890.00"
    # the two Overdue ones: 4,630.00 + 9,630.00
    assert receivables["overdue_count"] == 2
    assert receivables["overdue_receivables"] == "14260.00"
    first, second, third = receivables["items"]
    assert (first["overdue"], first["days_overdue"], first["paid"], first["balance"]) == (True, 15, "5000.00", "4630.00")
    assert (second["overdue"], second["days_overdue"], second["balance"]) == (True, 1, "9630.00")
    assert (third["overdue"], third["days_overdue"], third["balance"]) == (False, 0, "9630.00")
    assert first["customer"]["name"] == "Café Lune"


def test_the_receivables_total_covers_every_page(client_as, conn, test_company_id):
    for number in (1, 2, 3):
        insert_sale_state(conn, test_company_id, number=number)

    page = client_as("accountant").get(RECEIVABLES, params={"page_size": 2}).json()

    assert (len(page["items"]), page["total"]) == (2, 3)
    assert page["open_receivables"] == "28890.00"  # 3 x 9,630.00, not just this page


def test_receivables_can_be_searched_by_number_or_customer(client_as, conn, test_company_id):
    insert_sale_state(conn, test_company_id, number=1)
    insert_sale_state(conn, test_company_id, number=2)
    fon = client_as("accountant")

    assert _numbers(fon.get(RECEIVABLES, params={"q": "INV-0002"}).json()) == ["INV-0002"]
    assert _numbers(fon.get(RECEIVABLES, params={"q": "lune"}).json()) == ["INV-0001", "INV-0002"]  # same Due Date: oldest first
    assert fon.get(RECEIVABLES, params={"q": "zzz"}).json()["items"] == []


def test_receivables_only_count_the_callers_company(client_as, conn, company):
    _foreign_invoice(conn, company)
    _issue_invoice(client_as)

    receivables = client_as("accountant").get(RECEIVABLES).json()

    assert receivables["total"] == 1
    assert receivables["open_receivables"] == "9630.00"


# ------------------------------------------- two people paying at once


def test_two_full_payments_at_the_same_time_record_exactly_one(client_as):
    issued = _issue_invoice(client_as)
    first, second = client_as("accountant"), client_as("admin")

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda c: _pay(c, issued["id"], "9630.00"), [first, second]))

    assert sorted(r.status_code for r in results) == [201, 409]
    loser = next(r for r in results if r.status_code == 409)
    assert loser.json() == {"detail": "INV-0001 is already paid"}
    detail = _detail(first, issued["id"])
    assert detail["status"] == "paid"
    assert [p["amount"] for p in detail["payments"]] == ["9630.00"]


def test_two_payments_that_together_exceed_the_balance_can_never_both_be_recorded(client_as):
    issued = _issue_invoice(client_as)
    first, second = client_as("accountant"), client_as("admin")

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda c: _pay(c, issued["id"], "6000.00"), [first, second]))

    assert sorted(r.status_code for r in results) == [201, 409]
    loser = next(r for r in results if r.status_code == 409)
    assert loser.json() == {"detail": "Payment is more than the balance of 3,630.00 THB"}
    detail = _detail(first, issued["id"])
    assert (detail["status"], detail["paid"], detail["balance"]) == ("open", "6000.00", "3630.00")
