"""Ticket 09: Confirm a Draft -> stock out + Invoice in one transaction (US-1, US-3).

Starting state of every test (from the harness): ARB-1KG 170 kg at 450.00 (cost 320.00),
ROB-1KG 35 kg at 320.00, BLD-1KG 90, DRP-10 240, no orders, no invoices, no counters.
Café Lune has Payment Terms of 30 days.

Expected values are literals from the scenario, never recomputed the way the code does it:
170 -> 150 kg; 9,000.00 + 630.00 VAT = 9,630.00; INV-0001; Due Date = Invoice Date + 30 days.

The Invoice endpoints belong to ticket 10, so the Invoice rows are read straight from the
database here (the other half of the seam: the order detail `invoice: {id, number}` is read
through the API).

The sale Stock Movement's `ref_doc` is the INV number (spec: "writes the `sale` movements
(ref_doc = INV number)").
"""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from psycopg import errors

from tests import support
from tests.test_sales_orders import _add_line, _customer, _new_order, _product

FORBIDDEN_ROLES = ("warehouse", "accountant")
CONFIRMERS = ("admin", "sales")


# ---------------------------------------------------------------- helpers


def _confirm(client, order_id: int):
    return client.post(f"/api/sales-orders/{order_id}/confirm")


def _invoices(conn, company_id: int) -> list[dict]:
    return conn.execute(
        """
        select id, number, order_id, customer_id, invoice_date, due_date,
               subtotal, vat, total, status, created_by
        from public.invoices where company_id = %s order by id
        """,
        (company_id,),
    ).fetchall()


def _sale_movements(conn, company_id: int) -> list[dict]:
    return conn.execute(
        """
        select m.quantity, m.ref_doc, m.movement_type, m.created_by, p.sku
        from public.stock_movements m join public.products p on p.id = m.product_id
        where m.company_id = %s and m.movement_type = 'sale' order by m.id
        """,
        (company_id,),
    ).fetchall()


def _on_hand(conn, company_id: int) -> dict[str, int]:
    return support.on_hand_by_sku(conn, company_id)


def _bangkok_today(conn):
    return conn.execute("select (now() at time zone 'Asia/Bangkok')::date as d").fetchone()["d"]


def _inv_counter(conn, company_id: int):
    return conn.execute(
        "select last_value from public.doc_counters where company_id = %s and doc_type = 'INV'",
        (company_id,),
    ).fetchone()


def _assert_nothing_changed(client, conn, company_id: int, order_id: int) -> None:
    """The order is still a Draft, stock is untouched, and no Invoice or INV number exists."""
    order = client.get(f"/api/sales-orders/{order_id}").json()
    assert order["status"] == "draft"
    assert order["confirmed_at"] is None
    assert order["invoice"] is None
    assert _on_hand(conn, company_id) == {"ARB-1KG": 170, "ROB-1KG": 35, "BLD-1KG": 90, "DRP-10": 240}
    assert _sale_movements(conn, company_id) == []
    assert _invoices(conn, company_id) == []
    assert _inv_counter(conn, company_id) is None  # no INV number was taken


def _set_quantity_in_db(conn, order_id: int, quantity: int) -> None:
    """Make a line short of stock the way the API never allows to be undone: straight in the DB."""
    conn.execute("update public.order_items set quantity = %s where order_id = %s", (quantity, order_id))


# ---------------------------------------------------------- US-1, happy path


def test_us1_confirming_20_arb_1kg_for_cafe_lune_issues_inv_0001(client_as, conn, test_company_id):
    client = client_as("sales")
    order = _new_order(client, lines=[("ARB-1KG", 20)])
    assert order["number"] == "SO-0001"

    response = _confirm(client, order["id"])

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"] == order["id"]
    assert body["number"] == "SO-0001"
    assert body["status"] == "confirmed"
    assert body["confirmed_at"] is not None
    assert (body["subtotal"], body["vat"], body["total"]) == ("9000.00", "630.00", "9630.00")
    assert body["invoice"]["number"] == "INV-0001"

    [invoice] = _invoices(conn, test_company_id)
    assert body["invoice"]["id"] == invoice["id"]
    assert invoice["number"] == "INV-0001"
    assert invoice["order_id"] == order["id"]
    assert invoice["customer_id"] == _customer(client, "Café Lune")["id"]
    assert str(invoice["subtotal"]) == "9000.00"
    assert str(invoice["vat"]) == "630.00"
    assert str(invoice["total"]) == "9630.00"
    assert invoice["status"] == "open"


def test_us1_on_hand_goes_from_170_to_150_kg(client_as, conn, test_company_id):
    client = client_as("sales")
    order = _new_order(client, lines=[("ARB-1KG", 20)])

    assert _confirm(client, order["id"]).status_code == 200

    assert _product(client, "ARB-1KG")["on_hand"] == 150
    assert _on_hand(conn, test_company_id) == {"ARB-1KG": 150, "ROB-1KG": 35, "BLD-1KG": 90, "DRP-10": 240}
    # The order's own line shows the new On Hand too.
    assert client.get(f"/api/sales-orders/{order['id']}").json()["lines"][0]["on_hand"] == 150


def test_us1_due_date_is_the_invoice_date_plus_30_days_and_the_date_is_bangkok_today(
    client_as, conn, test_company_id
):
    client = client_as("sales")
    order = _new_order(client, lines=[("ARB-1KG", 20)])

    assert _confirm(client, order["id"]).status_code == 200

    [invoice] = _invoices(conn, test_company_id)
    assert invoice["invoice_date"] == _bangkok_today(conn)
    assert invoice["due_date"] == invoice["invoice_date"] + timedelta(days=30)


def test_cash_terms_make_the_invoice_due_the_same_day(client_as, conn, test_company_id):
    client = client_as("sales")
    order = _new_order(client, customer="Brew Lab Ari", lines=[("ARB-1KG", 20)])  # Cash (0 days)

    assert _confirm(client, order["id"]).status_code == 200

    [invoice] = _invoices(conn, test_company_id)
    assert invoice["due_date"] == invoice["invoice_date"]


def test_15_day_terms_for_sukhumvit_corner(client_as, conn, test_company_id):
    client = client_as("sales")
    order = _new_order(client, customer="Sukhumvit Corner Café", lines=[("ARB-1KG", 20)])

    assert _confirm(client, order["id"]).status_code == 200

    [invoice] = _invoices(conn, test_company_id)
    assert invoice["due_date"] == invoice["invoice_date"] + timedelta(days=15)


def test_confirm_writes_one_sale_movement_per_line_with_the_invoice_number(client_as, conn, test_company_id):
    sales = client_as("sales")
    order = _new_order(sales, lines=[("ARB-1KG", 20), ("ROB-1KG", 5)])

    assert _confirm(sales, order["id"]).status_code == 200

    movements = _sale_movements(conn, test_company_id)
    assert [(m["sku"], m["quantity"], m["ref_doc"], m["movement_type"]) for m in movements] == [
        ("ARB-1KG", -20, "INV-0001", "sale"),
        ("ROB-1KG", -5, "INV-0001", "sale"),
    ]
    assert {str(m["created_by"]) for m in movements} == {sales.get("/api/me").json()["id"]}
    # 20 x 450.00 + 5 x 320.00 = 10,600.00; VAT 742.00; total 11,342.00
    [invoice] = _invoices(conn, test_company_id)
    assert (str(invoice["subtotal"]), str(invoice["vat"]), str(invoice["total"])) == (
        "10600.00",
        "742.00",
        "11342.00",
    )
    assert _on_hand(conn, test_company_id)["ROB-1KG"] == 30


def test_the_stock_history_shows_the_sale_with_its_invoice_and_balance(client_as):
    sales, warehouse = client_as("sales"), client_as("warehouse")
    order = _new_order(sales, lines=[("ARB-1KG", 20)])
    assert _confirm(sales, order["id"]).status_code == 200

    arb = next(p for p in warehouse.get("/api/stock/products").json() if p["sku"] == "ARB-1KG")
    history = warehouse.get("/api/stock/movements", params={"product_id": arb["id"]}).json()

    top = history["items"][0]
    assert (top["movement_type"], top["ref_doc"], top["quantity"], top["balance_after"]) == (
        "sale",
        "INV-0001",
        -20,
        150,
    )
    assert top["created_by_name"] == "Test Sales"


def test_admin_can_confirm_too(client_as):
    admin = client_as("admin")
    order = _new_order(admin, lines=[("ARB-1KG", 20)])

    response = _confirm(admin, order["id"])

    assert response.status_code == 200
    assert response.json()["invoice"]["number"] == "INV-0001"


def test_invoice_numbers_are_sequential_across_orders(client_as, conn, test_company_id):
    sales = client_as("sales")
    first = _new_order(sales, lines=[("ARB-1KG", 20)])
    second = _new_order(sales, customer="Brew Lab Ari", lines=[("BLD-1KG", 10)])

    assert _confirm(sales, first["id"]).json()["invoice"]["number"] == "INV-0001"
    assert _confirm(sales, second["id"]).json()["invoice"]["number"] == "INV-0002"

    assert [i["number"] for i in _invoices(conn, test_company_id)] == ["INV-0001", "INV-0002"]
    assert _on_hand(conn, test_company_id)["BLD-1KG"] == 80


def test_a_cancelled_order_number_does_not_shift_invoice_numbers(client_as):
    sales = client_as("sales")
    cancelled = _new_order(sales, lines=[("ARB-1KG", 1)])
    assert sales.post(f"/api/sales-orders/{cancelled['id']}/cancel").status_code == 200
    order = _new_order(sales, lines=[("ARB-1KG", 20)])
    assert order["number"] == "SO-0002"

    body = _confirm(sales, order["id"]).json()

    assert body["number"] == "SO-0002"
    assert body["invoice"]["number"] == "INV-0001"  # SO and INV count separately


def test_the_invoice_amounts_and_stock_agree_with_the_order_detail(client_as, conn, test_company_id):
    sales = client_as("sales")
    order = _new_order(sales, lines=[("ARB-1KG", 20)])
    before = sales.get(f"/api/sales-orders/{order['id']}").json()

    after = _confirm(sales, order["id"]).json()

    [invoice] = _invoices(conn, test_company_id)
    assert (str(invoice["subtotal"]), str(invoice["vat"]), str(invoice["total"])) == (
        before["subtotal"],
        before["vat"],
        before["total"],
    )
    assert (after["subtotal"], after["vat"], after["total"]) == (
        before["subtotal"],
        before["vat"],
        before["total"],
    )


def test_a_later_price_change_leaves_the_confirmed_order_and_invoice_alone(client_as, conn, test_company_id):
    sales, admin = client_as("sales"), client_as("admin")
    order = _new_order(sales, lines=[("ARB-1KG", 20)])
    assert _confirm(sales, order["id"]).status_code == 200

    changed = admin.patch(f"/api/products/{_product(admin, 'ARB-1KG')['id']}", json={"price": "500.00"})
    assert changed.status_code == 200

    body = sales.get(f"/api/sales-orders/{order['id']}").json()
    assert body["lines"][0]["unit_price"] == "450.00"
    assert body["total"] == "9630.00"
    [invoice] = _invoices(conn, test_company_id)
    assert (str(invoice["subtotal"]), str(invoice["total"])) == ("9000.00", "9630.00")


# ------------------------------------------------------------- VAT agrees


def test_the_invoice_vat_rounds_half_up_like_the_order_vat(client_as, conn, test_company_id):
    """Subtotal 1.50: 7% is 0.105, which rounds UP to 0.11 (not 0.10); total 1.61."""
    sales = client_as("sales")
    support.insert_product(conn, test_company_id, "CHEAP-1", price="1.50", cost="1.00")
    cheap = conn.execute(
        "select id from public.products where company_id = %s and sku = 'CHEAP-1'", (test_company_id,)
    ).fetchone()["id"]
    support.insert_movement(conn, test_company_id, cheap, 10, "opening", ref_doc="OPENING")
    order = _new_order(sales)
    assert _add_line(sales, order["id"], "CHEAP-1", 1).status_code == 200
    draft = sales.get(f"/api/sales-orders/{order['id']}").json()
    assert (draft["subtotal"], draft["vat"], draft["total"]) == ("1.50", "0.11", "1.61")

    confirmed = _confirm(sales, order["id"])

    assert confirmed.status_code == 200
    [invoice] = _invoices(conn, test_company_id)
    assert (str(invoice["subtotal"]), str(invoice["vat"]), str(invoice["total"])) == ("1.50", "0.11", "1.61")
    assert (confirmed.json()["vat"], confirmed.json()["total"]) == ("0.11", "1.61")


def test_vat_is_rounded_on_the_whole_invoice_not_per_line(client_as, conn, test_company_id):
    """Two lines of 1.50 -> subtotal 3.00, VAT 0.21 (per-line rounding would give 0.22)."""
    sales = client_as("sales")
    for sku in ("CHEAP-1", "CHEAP-2"):
        support.insert_product(conn, test_company_id, sku, price="1.50", cost="1.00")
        product_id = conn.execute(
            "select id from public.products where company_id = %s and sku = %s", (test_company_id, sku)
        ).fetchone()["id"]
        support.insert_movement(conn, test_company_id, product_id, 10, "opening", ref_doc="OPENING")
    order = _new_order(sales)
    assert _add_line(sales, order["id"], "CHEAP-1", 1).status_code == 200
    assert _add_line(sales, order["id"], "CHEAP-2", 1).status_code == 200

    assert _confirm(sales, order["id"]).status_code == 200

    [invoice] = _invoices(conn, test_company_id)
    assert (str(invoice["subtotal"]), str(invoice["vat"]), str(invoice["total"])) == ("3.00", "0.21", "3.21")


# ----------------------------------------------- US-1: not enough stock


def test_us1_171_kg_when_170_is_on_hand_is_refused_and_nothing_changes(client_as, conn, test_company_id):
    client = client_as("sales")
    order = _new_order(client, lines=[("ARB-1KG", 171)])

    response = _confirm(client, order["id"])

    assert response.status_code == 409
    assert response.json() == {"detail": "Not enough stock for ARB-1KG"}
    _assert_nothing_changed(client, conn, test_company_id, order["id"])


def test_after_a_refused_confirm_the_next_success_still_gets_inv_0001(client_as, conn, test_company_id):
    client = client_as("sales")
    order = _new_order(client, lines=[("ARB-1KG", 171)])
    assert _confirm(client, order["id"]).status_code == 409
    assert _inv_counter(conn, test_company_id) is None

    # Fix the order (the Draft is still editable) and confirm again.
    line = client.get(f"/api/sales-orders/{order['id']}").json()["lines"][0]
    fixed = client.patch(f"/api/sales-orders/{order['id']}/lines/{line['id']}", json={"quantity": 20})
    assert fixed.status_code == 200
    response = _confirm(client, order["id"])

    assert response.status_code == 200
    assert response.json()["invoice"]["number"] == "INV-0001"
    assert _product(client, "ARB-1KG")["on_hand"] == 150


def test_exactly_the_whole_stock_can_be_sold(client_as, conn, test_company_id):
    client = client_as("sales")
    order = _new_order(client, lines=[("ARB-1KG", 170)])

    response = _confirm(client, order["id"])

    assert response.status_code == 200
    assert _on_hand(conn, test_company_id)["ARB-1KG"] == 0


def test_one_short_line_refuses_the_whole_order_and_no_line_is_taken(client_as, conn, test_company_id):
    client = client_as("sales")
    # ARB-1KG is fine (20 of 170), ROB-1KG is short (36 of 35).
    order = _new_order(client, lines=[("ARB-1KG", 20), ("ROB-1KG", 36)])

    response = _confirm(client, order["id"])

    assert response.status_code == 409
    assert response.json()["detail"] == "Not enough stock for ROB-1KG"
    _assert_nothing_changed(client, conn, test_company_id, order["id"])


def test_a_short_order_for_a_product_with_no_stock_at_all(client_as, conn, test_company_id):
    client = client_as("sales")
    support.insert_product(conn, test_company_id, "NEW-1KG")  # no movements: On Hand 0
    order = _new_order(client)
    assert _add_line(client, order["id"], "NEW-1KG", 1).status_code == 200

    response = _confirm(client, order["id"])

    assert response.status_code == 409
    assert response.json()["detail"] == "Not enough stock for NEW-1KG"


def test_stock_taken_out_after_the_draft_was_made_is_noticed_at_confirm(client_as):
    sales, warehouse = client_as("sales"), client_as("warehouse")
    order = _new_order(sales, lines=[("ARB-1KG", 100)])
    arb = next(p for p in warehouse.get("/api/stock/products").json() if p["sku"] == "ARB-1KG")
    out = warehouse.post(
        "/api/stock/movements",
        json={"product_id": arb["id"], "movement_type": "out", "quantity": 100, "reason": "damaged"},
    )
    assert out.status_code == 201  # 70 left

    response = _confirm(sales, order["id"])

    assert response.status_code == 409
    assert response.json()["detail"] == "Not enough stock for ARB-1KG"


# ------------------------------------------------------- empty and non-Draft


def test_a_draft_with_no_lines_is_refused_with_add_at_least_one_line(client_as, conn, test_company_id):
    client = client_as("sales")
    order = _new_order(client)

    response = _confirm(client, order["id"])

    assert response.status_code == 409
    assert response.json() == {"detail": "Add at least one line"}
    _assert_nothing_changed(client, conn, test_company_id, order["id"])


def test_confirming_twice_is_refused_and_makes_no_second_invoice(client_as, conn, test_company_id):
    client = client_as("sales")
    order = _new_order(client, lines=[("ARB-1KG", 20)])
    assert _confirm(client, order["id"]).status_code == 200

    again = _confirm(client, order["id"])

    assert again.status_code == 409
    assert again.json()["detail"] == "SO-0001 is confirmed and can't be changed"
    assert [i["number"] for i in _invoices(conn, test_company_id)] == ["INV-0001"]
    assert len(_sale_movements(conn, test_company_id)) == 1
    assert _on_hand(conn, test_company_id)["ARB-1KG"] == 150  # taken once, not twice
    assert _inv_counter(conn, test_company_id)["last_value"] == 1


def test_confirming_a_cancelled_order_is_refused(client_as, conn, test_company_id):
    client = client_as("sales")
    order = _new_order(client, lines=[("ARB-1KG", 20)])
    assert client.post(f"/api/sales-orders/{order['id']}/cancel").status_code == 200

    response = _confirm(client, order["id"])

    assert response.status_code == 409
    assert response.json()["detail"] == "SO-0001 is cancelled and can't be changed"
    assert client.get(f"/api/sales-orders/{order['id']}").json()["status"] == "cancelled"
    assert _invoices(conn, test_company_id) == []
    assert _on_hand(conn, test_company_id)["ARB-1KG"] == 170


def test_an_unknown_order_is_not_found(client_as):
    response = _confirm(client_as("sales"), 999999999)

    assert response.status_code == 404
    assert response.json()["detail"] == "Sales Order not found"


def test_an_order_of_another_company_is_not_found_and_stays_untouched(client_as, conn, company):
    other_customer = support.insert_customer(conn, company)
    other_product = support.insert_product(conn, company, "ARB-1KG")
    support.insert_movement(conn, company, other_product, 170, "opening", ref_doc="OPENING")
    other_order = conn.execute(
        "insert into public.sales_orders (company_id, number, customer_id) "
        "values (%s, 'SO-0001', %s) returning id",
        (company, other_customer),
    ).fetchone()["id"]
    conn.execute(
        "insert into public.order_items (company_id, order_id, product_id, quantity, unit_price, unit_cost) "
        "values (%s, %s, %s, 20, 450.00, 320.00)",
        (company, other_order, other_product),
    )

    response = _confirm(client_as("sales"), other_order)

    assert response.status_code == 404
    assert response.json()["detail"] == "Sales Order not found"
    assert _invoices(conn, company) == []
    assert support.on_hand(conn, other_product) == 170
    assert conn.execute(
        "select status from public.sales_orders where id = %s", (other_order,)
    ).fetchone()["status"] == "draft"


# ----------------------------------------------------- a Confirmed order is read-only

READ_ONLY_EDITS = {
    "change customer": lambda c, o, line: c.patch(
        f"/api/sales-orders/{o['id']}", json={"customer_id": o["customer"]["id"]}
    ),
    "add line": lambda c, o, line: c.post(
        f"/api/sales-orders/{o['id']}/lines", json={"product_id": line["product_id"], "quantity": 1}
    ),
    "change line": lambda c, o, line: c.patch(
        f"/api/sales-orders/{o['id']}/lines/{line['id']}", json={"quantity": 2}
    ),
    "remove line": lambda c, o, line: c.delete(f"/api/sales-orders/{o['id']}/lines/{line['id']}"),
    "cancel": lambda c, o, line: c.post(f"/api/sales-orders/{o['id']}/cancel"),
}


@pytest.mark.parametrize("edit", READ_ONLY_EDITS)
def test_a_really_confirmed_order_cannot_be_edited_or_cancelled(client_as, conn, test_company_id, edit):
    client = client_as("sales")
    order = _new_order(client, lines=[("ARB-1KG", 20)])
    confirmed = _confirm(client, order["id"]).json()

    response = READ_ONLY_EDITS[edit](client, confirmed, confirmed["lines"][0])

    assert response.status_code == 409
    assert response.json()["detail"] == "SO-0001 is confirmed and can't be changed"
    after = client.get(f"/api/sales-orders/{order['id']}").json()
    assert after["status"] == "confirmed"
    assert after["lines"][0]["quantity"] == 20
    assert after["total"] == "9630.00"
    assert [i["number"] for i in _invoices(conn, test_company_id)] == ["INV-0001"]


# ------------------------------------------------------------------ roles


@pytest.mark.parametrize("role", FORBIDDEN_ROLES)
def test_us3_warehouse_and_accountant_get_403_on_confirm_and_nothing_changes(
    client_as, conn, test_company_id, role
):
    sales = client_as("sales")
    order = _new_order(sales, lines=[("ARB-1KG", 20)])

    response = _confirm(client_as(role), order["id"])

    assert response.status_code == 403
    _assert_nothing_changed(sales, conn, test_company_id, order["id"])


@pytest.mark.parametrize("role", FORBIDDEN_ROLES)
def test_403_comes_before_the_order_is_looked_up(client_as, role):
    assert _confirm(client_as(role), 999999999).status_code == 403


def test_confirm_without_a_token_is_401(client_as, client):
    order = _new_order(client_as("sales"), lines=[("ARB-1KG", 20)])

    assert client.post(f"/api/sales-orders/{order['id']}/confirm").status_code == 401


# --------------------------------------------- the DB function on its own


def test_the_function_alone_refuses_a_short_order_and_leaves_no_trace(client_as, conn, test_company_id, api_company):
    """No other path (SQL editor, a script) can half-confirm an order (ADR-0002)."""
    sales = client_as("sales")
    order = _new_order(sales, lines=[("ARB-1KG", 20), ("ROB-1KG", 5)])
    conn.execute(
        "update public.order_items set quantity = 36 where order_id = %s and product_id = "
        "(select id from public.products where company_id = %s and sku = 'ROB-1KG')",
        (order["id"], test_company_id),
    )

    with pytest.raises(errors.RaiseException, match="Not enough stock for ROB-1KG"):
        conn.execute(
            "select public.confirm_sales_order(%s, %s)", (order["id"], api_company.users["sales"].id)
        )

    _assert_nothing_changed(sales, conn, test_company_id, order["id"])


def test_the_function_adds_up_a_product_that_is_on_two_lines(client_as, conn, test_company_id, api_company):
    """The API merges repeated Products, but the table allows two lines: 100 + 100 > 170."""
    sales = client_as("sales")
    order = _new_order(sales, lines=[("ARB-1KG", 100)])
    arb = _product(sales, "ARB-1KG")["id"]
    conn.execute(
        "insert into public.order_items (company_id, order_id, product_id, quantity, unit_price, unit_cost) "
        "values (%s, %s, %s, 100, 450.00, 320.00)",
        (test_company_id, order["id"], arb),
    )

    with pytest.raises(errors.RaiseException, match="Not enough stock for ARB-1KG"):
        conn.execute(
            "select public.confirm_sales_order(%s, %s)", (order["id"], api_company.users["sales"].id)
        )

    assert _on_hand(conn, test_company_id)["ARB-1KG"] == 170
    assert _invoices(conn, test_company_id) == []


def test_the_function_alone_refuses_an_empty_draft_and_a_non_draft(client_as, conn, test_company_id, api_company):
    sales = client_as("sales")
    user_id = api_company.users["sales"].id
    empty = _new_order(sales)
    cancelled = _new_order(sales, lines=[("ARB-1KG", 1)])
    assert sales.post(f"/api/sales-orders/{cancelled['id']}/cancel").status_code == 200

    with pytest.raises(errors.RaiseException, match="Add at least one line"):
        conn.execute("select public.confirm_sales_order(%s, %s)", (empty["id"], user_id))
    with pytest.raises(errors.RaiseException, match="SO-0002 is cancelled and can't be changed"):
        conn.execute("select public.confirm_sales_order(%s, %s)", (cancelled["id"], user_id))

    assert _invoices(conn, test_company_id) == []
    assert _inv_counter(conn, test_company_id) is None


def test_the_function_only_sees_orders_of_the_users_own_company(client_as, conn, company, api_company):
    other_customer = support.insert_customer(conn, company)
    other_order = conn.execute(
        "insert into public.sales_orders (company_id, number, customer_id) "
        "values (%s, 'SO-0001', %s) returning id",
        (company, other_customer),
    ).fetchone()["id"]

    with pytest.raises(errors.RaiseException, match="Sales Order not found"):
        conn.execute(
            "select public.confirm_sales_order(%s, %s)", (other_order, api_company.users["sales"].id)
        )
    with pytest.raises(errors.RaiseException, match="User not found"):
        conn.execute("select public.confirm_sales_order(%s, %s)", (other_order, uuid.uuid4()))


def test_the_function_is_security_invoker_pinned_and_closed_to_browser_roles(conn):
    row = conn.execute(
        """
        select p.prosecdef, p.proconfig,
               has_function_privilege('anon', p.oid, 'execute') as anon_can_run,
               has_function_privilege('authenticated', p.oid, 'execute') as authed_can_run,
               has_function_privilege('public', p.oid, 'execute') as public_can_run
        from pg_proc p
        where p.pronamespace = 'public'::regnamespace and p.proname = 'confirm_sales_order'
        """
    ).fetchone()
    assert row is not None, "confirm_sales_order does not exist"
    assert not row["prosecdef"]
    assert any(c.startswith("search_path=") for c in (row["proconfig"] or []))
    assert not row["anon_can_run"]
    assert not row["authed_can_run"]
    assert not row["public_can_run"]


# ------------------------------------------------------------ concurrency


def test_two_people_confirming_the_same_order_make_one_invoice(client_as, conn, test_company_id):
    first, second = client_as("sales"), client_as("admin")
    order = _new_order(first, lines=[("ARB-1KG", 20)])

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda c: _confirm(c, order["id"]), [first, second]))

    assert sorted(r.status_code for r in results) == [200, 409]
    assert [i["number"] for i in _invoices(conn, test_company_id)] == ["INV-0001"]
    assert _on_hand(conn, test_company_id)["ARB-1KG"] == 150  # taken once


def test_two_orders_fighting_for_the_same_stock_can_never_make_it_negative(client_as, conn, test_company_id):
    first, second = client_as("sales"), client_as("admin")
    order_a = _new_order(first, lines=[("ARB-1KG", 100)])
    order_b = _new_order(first, customer="Brew Lab Ari", lines=[("ARB-1KG", 100)])  # 200 > 170 together

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(
            pool.map(lambda args: _confirm(*args), [(first, order_a["id"]), (second, order_b["id"])])
        )

    assert sorted(r.status_code for r in results) == [200, 409]
    loser = next(r for r in results if r.status_code == 409)
    assert loser.json()["detail"] == "Not enough stock for ARB-1KG"
    assert _on_hand(conn, test_company_id)["ARB-1KG"] == 70
    assert [i["number"] for i in _invoices(conn, test_company_id)] == ["INV-0001"]
