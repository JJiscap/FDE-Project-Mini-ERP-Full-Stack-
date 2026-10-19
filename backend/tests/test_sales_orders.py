"""Ticket 08: Draft Sales Orders (create, lines, change Customer, Cancel, list, detail).

Expected values come from the scenario, not from the code: Café Lune's first Draft is
SO-0001; 20 x ARB-1KG at 450.00 is 9,000.00, VAT 630.00, Total 9,630.00; a later
Product price of 500 leaves the line at 450.00. Stock is NOT checked or moved here:
that is Confirm (ticket 09).
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest

from tests import support

ALL_ROLES = ("admin", "sales", "warehouse", "accountant")
SALES_ROLES = ("admin", "sales")
FORBIDDEN_ROLES = ("warehouse", "accountant")

DETAIL_KEYS = {
    "id",
    "number",
    "order_date",
    "status",
    "confirmed_at",
    "customer",
    "lines",
    "subtotal",
    "vat",
    "total",
    "invoice",
}
LINE_KEYS = {"id", "product_id", "sku", "name", "unit", "quantity", "unit_price", "amount", "on_hand"}
LIST_ITEM_KEYS = {
    "id",
    "number",
    "order_date",
    "status",
    "customer",
    "line_count",
    "subtotal",
    "vat",
    "total",
}


# ---------------------------------------------------------------- helpers


def _customer(client, name: str) -> dict:
    items = client.get("/api/customers", params={"q": name}).json()["items"]
    return next(c for c in items if c["name"] == name)


def _product(client, sku: str) -> dict:
    items = client.get("/api/products", params={"q": sku}).json()["items"]
    return next(p for p in items if p["sku"] == sku)


def _new_order(client, customer: str = "Café Lune", lines: list[tuple[str, int]] | None = None) -> dict:
    """Create a Draft through the API; `lines` is [(sku, quantity), ...]."""
    body: dict = {"customer_id": _customer(client, customer)["id"]}
    if lines:
        body["lines"] = [
            {"product_id": _product(client, sku)["id"], "quantity": quantity}
            for sku, quantity in lines
        ]
    response = client.post("/api/sales-orders", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def _add_line(client, order_id: int, sku: str, quantity: int):
    return client.post(
        f"/api/sales-orders/{order_id}/lines",
        json={"product_id": _product(client, sku)["id"], "quantity": quantity},
    )


def _set_price(admin_client, sku: str, price: str) -> None:
    response = admin_client.patch(f"/api/products/{_product(admin_client, sku)['id']}", json={"price": price})
    assert response.status_code == 200, response.text


def _force_status(conn, order_id: int, status: str) -> None:
    """Arrange a Confirmed or Cancelled order directly: Confirm itself is ticket 09."""
    conn.execute(
        "update public.sales_orders set status = %s, "
        "confirmed_at = case when %s = 'confirmed' then now() end where id = %s",
        (status, status, order_id),
    )


# ------------------------------------------------- numbering and creation


def test_first_draft_for_cafe_lune_is_so_0001(client_as):
    client = client_as("sales")
    lune = _customer(client, "Café Lune")

    response = client.post("/api/sales-orders", json={"customer_id": lune["id"]})

    assert response.status_code == 201
    order = response.json()
    assert set(order) == DETAIL_KEYS
    assert order["number"] == "SO-0001"
    assert order["status"] == "draft"
    assert order["confirmed_at"] is None
    assert order["invoice"] is None
    assert order["order_date"] == datetime.now(ZoneInfo("Asia/Bangkok")).date().isoformat()
    assert order["customer"] == {
        "id": lune["id"],
        "name": "Café Lune",
        "tax_id": lune["tax_id"],
        "payment_terms_days": lune["payment_terms_days"],
    }
    assert order["lines"] == []
    assert (order["subtotal"], order["vat"], order["total"]) == ("0.00", "0.00", "0.00")


def test_next_draft_is_so_0002_even_after_so_0001_is_cancelled(client_as):
    client = client_as("sales")
    first = _new_order(client)
    assert first["number"] == "SO-0001"

    cancelled = client.post(f"/api/sales-orders/{first['id']}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert cancelled.json()["number"] == "SO-0001"  # a Cancelled Draft keeps its number

    second = _new_order(client)
    assert second["number"] == "SO-0002"  # and the number is never reused


@pytest.mark.parametrize("role", SALES_ROLES)
def test_admin_and_sales_can_create_and_read_a_draft(client_as, role):
    client = client_as(role)
    order = _new_order(client)

    assert client.get(f"/api/sales-orders/{order['id']}").json()["number"] == "SO-0001"


def test_a_draft_can_be_created_with_its_lines_in_one_call(client_as):
    client = client_as("sales")

    order = _new_order(client, lines=[("ARB-1KG", 20), ("ROB-1KG", 2)])

    assert [line["sku"] for line in order["lines"]] == ["ARB-1KG", "ROB-1KG"]
    # ARB 20 x 450.00 = 9,000.00; ROB 2 x 320.00 = 640.00
    assert order["lines"][1]["unit_price"] == "320.00"
    assert order["subtotal"] == "9640.00"
    assert order["vat"] == "674.80"
    assert order["total"] == "10314.80"


def test_creating_for_a_deactivated_customer_is_refused_and_burns_no_number(client_as):
    client = client_as("sales")
    lune = _customer(client, "Café Lune")
    assert client.patch(f"/api/customers/{lune['id']}", json={"active": False}).status_code == 200

    response = client.post("/api/sales-orders", json={"customer_id": lune["id"]})

    assert response.status_code == 409
    assert response.json()["detail"] == "Café Lune is deactivated"
    brew = _new_order(client, "Brew Lab Ari")
    assert brew["number"] == "SO-0001"  # the refused attempt left no gap


def test_creating_for_an_unknown_customer_is_not_found(client_as):
    response = client_as("sales").post("/api/sales-orders", json={"customer_id": 999999999})

    assert response.status_code == 404
    assert response.json()["detail"] == "Customer not found"


def test_creating_without_a_customer_is_refused_with_a_clear_message(client_as):
    response = client_as("sales").post("/api/sales-orders", json={})

    assert response.status_code == 422
    assert response.json()["detail"] == "Customer ID is required"


def test_creating_with_a_deactivated_product_in_the_lines_burns_no_number(client_as):
    admin, sales = client_as("admin"), client_as("sales")
    arb = _product(admin, "ARB-1KG")
    assert admin.patch(f"/api/products/{arb['id']}", json={"active": False}).status_code == 200

    response = sales.post(
        "/api/sales-orders",
        json={
            "customer_id": _customer(sales, "Café Lune")["id"],
            "lines": [{"product_id": arb["id"], "quantity": 1}],
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "ARB-1KG is deactivated"
    assert _new_order(sales)["number"] == "SO-0001"


def test_the_same_product_twice_in_the_create_call_is_one_line(client_as):
    client = client_as("sales")
    arb_id = _product(client, "ARB-1KG")["id"]

    response = client.post(
        "/api/sales-orders",
        json={
            "customer_id": _customer(client, "Café Lune")["id"],
            "lines": [
                {"product_id": arb_id, "quantity": 5},
                {"product_id": arb_id, "quantity": 7},
            ],
        },
    )

    assert response.status_code == 201
    lines = response.json()["lines"]
    assert len(lines) == 1
    assert lines[0]["quantity"] == 12


# ------------------------------------------------------- lines and totals


def test_twenty_arb_1kg_gives_the_scenario_totals(client_as):
    client = client_as("sales")
    order = _new_order(client)

    response = _add_line(client, order["id"], "ARB-1KG", 20)

    assert response.status_code == 200
    body = response.json()
    assert set(body) == DETAIL_KEYS
    assert len(body["lines"]) == 1
    line = body["lines"][0]
    assert set(line) == LINE_KEYS
    assert line["sku"] == "ARB-1KG"
    assert line["name"] == "Arabica, 1 kg bag"
    assert line["unit"] == "kg"
    assert line["quantity"] == 20
    assert line["unit_price"] == "450.00"
    assert line["amount"] == "9000.00"
    assert body["subtotal"] == "9000.00"
    assert body["vat"] == "630.00"
    assert body["total"] == "9630.00"


def test_the_line_shows_on_hand_but_does_not_check_or_move_stock(client_as, conn, test_company_id):
    client = client_as("sales")
    order = _new_order(client)

    response = _add_line(client, order["id"], "ARB-1KG", 500)  # 500 kg > 170 kg on hand

    assert response.status_code == 200  # stock is only enforced at Confirm
    assert response.json()["lines"][0]["on_hand"] == 170
    assert support.on_hand_by_sku(conn, test_company_id)["ARB-1KG"] == 170
    movements = conn.execute(
        "select count(*) as n from public.stock_movements where company_id = %s and movement_type <> 'opening'",
        (test_company_id,),
    ).fetchone()["n"]
    assert movements == 0


def test_a_later_price_change_leaves_the_draft_line_at_450(client_as):
    admin, sales = client_as("admin"), client_as("sales")
    order = _new_order(sales)
    _add_line(sales, order["id"], "ARB-1KG", 20)

    _set_price(admin, "ARB-1KG", "500.00")

    body = sales.get(f"/api/sales-orders/{order['id']}").json()
    assert body["lines"][0]["unit_price"] == "450.00"
    assert body["lines"][0]["amount"] == "9000.00"
    assert body["total"] == "9630.00"
    # a NEW order picks up the new price
    other = _new_order(sales)
    assert _add_line(sales, other["id"], "ARB-1KG", 1).json()["lines"][0]["unit_price"] == "500.00"


def test_changing_the_quantity_never_re_copies_the_price(client_as):
    admin, sales = client_as("admin"), client_as("sales")
    order = _new_order(sales)
    line = _add_line(sales, order["id"], "ARB-1KG", 20).json()["lines"][0]
    _set_price(admin, "ARB-1KG", "500.00")

    response = sales.patch(f"/api/sales-orders/{order['id']}/lines/{line['id']}", json={"quantity": 30})

    assert response.status_code == 200
    changed = response.json()["lines"][0]
    assert changed["quantity"] == 30
    assert changed["unit_price"] == "450.00"
    assert changed["amount"] == "13500.00"
    assert response.json()["subtotal"] == "13500.00"
    assert response.json()["vat"] == "945.00"
    assert response.json()["total"] == "14445.00"


def test_adding_the_same_product_again_adds_to_the_line_and_keeps_its_price(client_as):
    admin, sales = client_as("admin"), client_as("sales")
    order = _new_order(sales)
    _add_line(sales, order["id"], "ARB-1KG", 5)
    _set_price(admin, "ARB-1KG", "500.00")

    response = _add_line(sales, order["id"], "ARB-1KG", 7)

    assert response.status_code == 200
    lines = response.json()["lines"]
    assert len(lines) == 1  # no duplicate line
    assert lines[0]["quantity"] == 12
    assert lines[0]["unit_price"] == "450.00"  # frozen when the line was first added
    assert response.json()["subtotal"] == "5400.00"


def test_lines_come_back_in_the_order_they_were_added(client_as):
    client = client_as("sales")
    order = _new_order(client)
    _add_line(client, order["id"], "DRP-10", 1)
    _add_line(client, order["id"], "ARB-1KG", 1)

    lines = _add_line(client, order["id"], "BLD-1KG", 1).json()["lines"]

    assert [line["sku"] for line in lines] == ["DRP-10", "ARB-1KG", "BLD-1KG"]


def test_vat_is_rounded_half_up_on_the_whole_subtotal(client_as):
    admin, sales = client_as("admin"), client_as("sales")
    created = admin.post(
        "/api/products",
        json={"sku": "TEST-1", "name": "Rounding case", "unit": "kg", "price": "1.50", "cost": "1.00"},
    )
    assert created.status_code == 201
    order = _new_order(sales)

    body = _add_line(sales, order["id"], "TEST-1", 1).json()

    assert body["subtotal"] == "1.50"
    assert body["vat"] == "0.11"  # 1.50 x 7% = 0.105, rounded half up
    assert body["total"] == "1.61"


def test_removing_a_line_updates_the_totals(client_as):
    client = client_as("sales")
    order = _new_order(client, lines=[("ARB-1KG", 20), ("BLD-1KG", 1)])
    arb_line = next(line for line in order["lines"] if line["sku"] == "ARB-1KG")

    response = client.delete(f"/api/sales-orders/{order['id']}/lines/{arb_line['id']}")

    assert response.status_code == 200
    body = response.json()
    assert [line["sku"] for line in body["lines"]] == ["BLD-1KG"]
    assert body["subtotal"] == "380.00"
    assert body["vat"] == "26.60"
    assert body["total"] == "406.60"


def test_changing_the_customer_of_a_draft(client_as):
    client = client_as("sales")
    order = _new_order(client, "Café Lune", lines=[("ARB-1KG", 20)])
    brew = _customer(client, "Brew Lab Ari")

    response = client.patch(f"/api/sales-orders/{order['id']}", json={"customer_id": brew["id"]})

    assert response.status_code == 200
    body = response.json()
    assert body["customer"]["name"] == "Brew Lab Ari"
    assert body["number"] == "SO-0001"
    assert body["total"] == "9630.00"  # lines untouched


def test_changing_to_a_deactivated_customer_is_refused(client_as):
    client = client_as("sales")
    order = _new_order(client, "Café Lune")
    brew = _customer(client, "Brew Lab Ari")
    assert client.patch(f"/api/customers/{brew['id']}", json={"active": False}).status_code == 200

    response = client.patch(f"/api/sales-orders/{order['id']}", json={"customer_id": brew["id"]})

    assert response.status_code == 409
    assert response.json()["detail"] == "Brew Lab Ari is deactivated"
    assert client.get(f"/api/sales-orders/{order['id']}").json()["customer"]["name"] == "Café Lune"


# ------------------------------------------------------------ validation


@pytest.mark.parametrize("quantity", [0, -3])
def test_a_quantity_of_zero_or_less_is_refused_when_adding_a_line(client_as, quantity):
    client = client_as("sales")
    order = _new_order(client)

    response = _add_line(client, order["id"], "ARB-1KG", quantity)

    assert response.status_code == 422
    assert "Quantity must be greater than 0" in response.json()["detail"]
    assert client.get(f"/api/sales-orders/{order['id']}").json()["lines"] == []


def test_a_quantity_of_zero_is_refused_when_changing_a_line(client_as):
    client = client_as("sales")
    order = _new_order(client, lines=[("ARB-1KG", 20)])
    line = order["lines"][0]

    response = client.patch(f"/api/sales-orders/{order['id']}/lines/{line['id']}", json={"quantity": 0})

    assert response.status_code == 422
    assert "Quantity must be greater than 0" in response.json()["detail"]
    assert client.get(f"/api/sales-orders/{order['id']}").json()["lines"][0]["quantity"] == 20


def test_a_quantity_of_zero_is_refused_when_creating_with_lines(client_as):
    client = client_as("sales")

    response = client.post(
        "/api/sales-orders",
        json={
            "customer_id": _customer(client, "Café Lune")["id"],
            "lines": [{"product_id": _product(client, "ARB-1KG")["id"], "quantity": 0}],
        },
    )

    assert response.status_code == 422
    assert "Quantity must be greater than 0" in response.json()["detail"]


def test_a_fractional_quantity_is_refused(client_as):
    client = client_as("sales")
    order = _new_order(client)

    response = client.post(
        f"/api/sales-orders/{order['id']}/lines",
        json={"product_id": _product(client, "ARB-1KG")["id"], "quantity": 1.5},
    )

    assert response.status_code == 422
    assert "Quantity must be a whole number" in response.json()["detail"]


def test_a_deactivated_product_cannot_be_added(client_as):
    admin, sales = client_as("admin"), client_as("sales")
    order = _new_order(sales)
    arb = _product(admin, "ARB-1KG")
    assert admin.patch(f"/api/products/{arb['id']}", json={"active": False}).status_code == 200

    response = _add_line(sales, order["id"], "ARB-1KG", 1)

    assert response.status_code == 409
    assert response.json()["detail"] == "ARB-1KG is deactivated"
    assert sales.get(f"/api/sales-orders/{order['id']}").json()["lines"] == []


def test_an_unknown_product_cannot_be_added(client_as):
    client = client_as("sales")
    order = _new_order(client)

    response = client.post(
        f"/api/sales-orders/{order['id']}/lines", json={"product_id": 999999999, "quantity": 1}
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Product not found"


def test_a_line_that_is_not_on_the_order_is_not_found(client_as):
    client = client_as("sales")
    order = _new_order(client)
    other = _new_order(client, lines=[("ARB-1KG", 1)])
    foreign_line = other["lines"][0]["id"]

    patch = client.patch(f"/api/sales-orders/{order['id']}/lines/{foreign_line}", json={"quantity": 2})
    delete = client.delete(f"/api/sales-orders/{order['id']}/lines/{foreign_line}")

    assert patch.status_code == 404
    assert delete.status_code == 404
    assert client.get(f"/api/sales-orders/{other['id']}").json()["lines"][0]["quantity"] == 1


# ------------------------------------------- Cancelled and Confirmed orders

EDITS = {
    "change customer": lambda c, o, line: c.patch(
        f"/api/sales-orders/{o['id']}", json={"customer_id": o["customer"]["id"]}
    ),
    "add line": lambda c, o, line: c.post(
        f"/api/sales-orders/{o['id']}/lines",
        json={"product_id": line["product_id"], "quantity": 1},
    ),
    "change line": lambda c, o, line: c.patch(
        f"/api/sales-orders/{o['id']}/lines/{line['id']}", json={"quantity": 2}
    ),
    "remove line": lambda c, o, line: c.delete(f"/api/sales-orders/{o['id']}/lines/{line['id']}"),
    "cancel": lambda c, o, line: c.post(f"/api/sales-orders/{o['id']}/cancel"),
}


@pytest.mark.parametrize("edit", EDITS)
@pytest.mark.parametrize("status", ["cancelled", "confirmed"])
def test_a_non_draft_order_cannot_be_edited_or_cancelled(client_as, conn, status, edit):
    client = client_as("sales")
    order = _new_order(client, lines=[("ARB-1KG", 20)])
    _force_status(conn, order["id"], status)

    response = EDITS[edit](client, order, order["lines"][0])

    assert response.status_code == 409
    assert response.json()["detail"] == f"SO-0001 is {status} and can't be changed"
    after = client.get(f"/api/sales-orders/{order['id']}").json()
    assert after["status"] == status
    assert after["lines"][0]["quantity"] == 20  # nothing changed


def test_a_cancelled_draft_cannot_be_cancelled_again(client_as):
    client = client_as("sales")
    order = _new_order(client)
    assert client.post(f"/api/sales-orders/{order['id']}/cancel").status_code == 200

    again = client.post(f"/api/sales-orders/{order['id']}/cancel")

    assert again.status_code == 409
    assert again.json()["detail"] == "SO-0001 is cancelled and can't be changed"


def test_a_confirmed_order_shows_its_invoice(client_as, conn, test_company_id):
    """Ticket 09 creates the Invoice; the detail already reads it (`invoice: {id, number}`)."""
    client = client_as("sales")
    order = _new_order(client, lines=[("ARB-1KG", 20)])
    _force_status(conn, order["id"], "confirmed")
    invoice_id = conn.execute(
        """
        insert into public.invoices
            (company_id, number, order_id, customer_id, due_date, subtotal, vat, total)
        values (%s, 'INV-0001', %s, %s, (timezone('Asia/Bangkok', now()))::date, 9000, 630, 9630)
        returning id
        """,
        (test_company_id, order["id"], order["customer"]["id"]),
    ).fetchone()["id"]

    body = client.get(f"/api/sales-orders/{order['id']}").json()

    assert body["status"] == "confirmed"
    assert body["confirmed_at"] is not None
    assert body["invoice"] == {"id": invoice_id, "number": "INV-0001"}


# ------------------------------------------------------------------ list


def test_an_empty_list_has_the_page_envelope(client_as):
    body = client_as("sales").get("/api/sales-orders").json()

    assert body == {"items": [], "total": 0, "page": 1, "page_size": 20}


def test_the_list_is_newest_first_with_line_count_and_totals(client_as):
    client = client_as("sales")
    first = _new_order(client, "Café Lune", lines=[("ARB-1KG", 20)])
    second = _new_order(client, "Brew Lab Ari")

    body = client.get("/api/sales-orders").json()

    assert body["total"] == 2
    assert [item["number"] for item in body["items"]] == ["SO-0002", "SO-0001"]
    newest, oldest = body["items"]
    assert set(newest) == LIST_ITEM_KEYS
    assert newest["id"] == second["id"]
    assert newest["status"] == "draft"
    assert newest["customer"] == {"id": second["customer"]["id"], "name": "Brew Lab Ari"}
    assert newest["line_count"] == 0
    assert newest["total"] == "0.00"
    assert oldest["id"] == first["id"]
    assert oldest["line_count"] == 1
    assert (oldest["subtotal"], oldest["vat"], oldest["total"]) == ("9000.00", "630.00", "9630.00")


def test_the_list_filters_by_status(client_as):
    client = client_as("sales")
    kept = _new_order(client)
    dropped = _new_order(client)
    assert client.post(f"/api/sales-orders/{dropped['id']}/cancel").status_code == 200

    def numbers(status: str) -> list[str]:
        body = client.get("/api/sales-orders", params={"status": status}).json()
        return [item["number"] for item in body["items"]]

    assert numbers("draft") == [kept["number"]]
    assert numbers("cancelled") == [dropped["number"]]
    assert numbers("confirmed") == []


def test_an_unknown_status_filter_is_refused(client_as):
    response = client_as("sales").get("/api/sales-orders", params={"status": "paid"})

    assert response.status_code == 422


def test_the_list_searches_by_order_number_and_by_customer_name(client_as):
    client = client_as("sales")
    _new_order(client, "Café Lune")
    _new_order(client, "Brew Lab Ari")

    def numbers(q: str) -> list[str]:
        body = client.get("/api/sales-orders", params={"q": q}).json()
        return [item["number"] for item in body["items"]]

    assert numbers("SO-0002") == ["SO-0002"]
    assert numbers("so-0001") == ["SO-0001"]
    assert numbers("lune") == ["SO-0001"]
    assert numbers("BREW") == ["SO-0002"]
    assert numbers("nobody") == []


def test_the_list_pages_with_at_most_20_per_page(client_as):
    client = client_as("sales")
    for _ in range(3):
        _new_order(client)

    first = client.get("/api/sales-orders", params={"page_size": 2}).json()
    second = client.get("/api/sales-orders", params={"page_size": 2, "page": 2}).json()

    assert first["total"] == second["total"] == 3
    assert [i["number"] for i in first["items"]] == ["SO-0003", "SO-0002"]
    assert [i["number"] for i in second["items"]] == ["SO-0001"]
    assert second["page"] == 2 and second["page_size"] == 2
    assert client.get("/api/sales-orders", params={"page_size": 21}).status_code == 422


# ------------------------------------------------------ other companies


def test_orders_and_customers_of_another_company_are_invisible(client_as, conn, company):
    client = client_as("sales")
    foreign_customer = support.insert_customer(conn, company, "Foreign Café")
    foreign_order = conn.execute(
        "insert into public.sales_orders (company_id, number, customer_id) "
        "values (%s, 'SO-0001', %s) returning id",
        (company, foreign_customer),
    ).fetchone()["id"]
    mine = _new_order(client)

    assert client.get("/api/sales-orders").json()["total"] == 1
    assert client.get(f"/api/sales-orders/{foreign_order}").status_code == 404
    assert client.post(f"/api/sales-orders/{foreign_order}/cancel").status_code == 404
    assert _add_line(client, foreign_order, "ARB-1KG", 1).status_code == 404
    assert client.post("/api/sales-orders", json={"customer_id": foreign_customer}).status_code == 404
    patch = client.patch(f"/api/sales-orders/{mine['id']}", json={"customer_id": foreign_customer})
    assert patch.status_code == 404
    assert client.get("/api/sales-orders/999999999").json()["detail"] == "Sales Order not found"


# ----------------------------------------------------------------- roles


def _endpoints(order_id: int, line_id: int, customer_id: int, product_id: int):
    base = f"/api/sales-orders/{order_id}"
    return {
        "list": ("get", "/api/sales-orders", None),
        "create": ("post", "/api/sales-orders", {"customer_id": customer_id}),
        "detail": ("get", base, None),
        "change customer": ("patch", base, {"customer_id": customer_id}),
        "add line": ("post", f"{base}/lines", {"product_id": product_id, "quantity": 1}),
        "change line": ("patch", f"{base}/lines/{line_id}", {"quantity": 2}),
        "remove line": ("delete", f"{base}/lines/{line_id}", None),
        "cancel": ("post", f"{base}/cancel", None),
    }


@pytest.mark.parametrize("role", FORBIDDEN_ROLES)
@pytest.mark.parametrize(
    "name",
    ["list", "create", "detail", "change customer", "add line", "change line", "remove line", "cancel"],
)
def test_warehouse_and_accountant_get_403_on_every_sales_order_endpoint(client_as, role, name):
    sales = client_as("sales")
    order = _new_order(sales, lines=[("ARB-1KG", 5)])
    method, url, body = _endpoints(
        order["id"], order["lines"][0]["id"], order["customer"]["id"], order["lines"][0]["product_id"]
    )[name]

    response = getattr(client_as(role), method)(url, **({"json": body} if body is not None else {}))

    assert response.status_code == 403
    after = sales.get(f"/api/sales-orders/{order['id']}").json()
    assert after["status"] == "draft" and after["lines"][0]["quantity"] == 5  # nothing happened


def test_the_list_without_a_token_is_401(client):
    assert client.get("/api/sales-orders").status_code == 401


# ------------------------------------------------------------- vat_for


def test_vat_is_seven_percent_of_the_subtotal():
    from app.core.money import vat_for

    assert vat_for(Decimal("9000.00")) == Decimal("630.00")


def test_vat_rounds_half_up_to_two_decimals():
    from app.core.money import vat_for

    assert vat_for(Decimal("1.50")) == Decimal("0.11")  # 0.105 -> 0.11 (not 0.10)
    assert vat_for(Decimal("0.50")) == Decimal("0.04")  # 0.035 -> 0.04
    assert vat_for(Decimal("0.07")) == Decimal("0.00")  # 0.0049 -> 0.00


def test_vat_always_has_two_decimals():
    from app.core.money import vat_for

    assert str(vat_for(Decimal("100"))) == "7.00"
    assert str(vat_for(Decimal("0"))) == "0.00"
