"""Ticket 07: Stock-in, Stock-out, Adjustment and the movement history, through the HTTP API.

Starting state of every test (from the harness): ARB-1KG 170, ROB-1KG 35, BLD-1KG 90,
DRP-10 240, as Opening Stock. Expected numbers come from the scenario, not from the code.
"""

from __future__ import annotations

import pytest

from tests import support

MOVEMENTS = "/api/stock/movements"
PRODUCTS = "/api/stock/products"


def product_id(client, sku: str = "ARB-1KG") -> int:
    items = client.get(PRODUCTS).json()
    return next(p["id"] for p in items if p["sku"] == sku)


def on_hand(client, sku: str = "ARB-1KG") -> int:
    items = client.get(PRODUCTS).json()
    return next(p["on_hand"] for p in items if p["sku"] == sku)


def record(client, movement_type: str, quantity, *, sku: str = "ARB-1KG", reason=None):
    body = {
        "product_id": product_id(client, sku),
        "movement_type": movement_type,
        "quantity": quantity,
    }
    if reason is not None:
        body["reason"] = reason
    return client.post(MOVEMENTS, json=body)


# ----------------------------------------------------------------- Stock-in


def test_stock_in_of_30_on_170_gives_200_and_is_numbered_in_0001(client_as):
    warehouse = client_as("warehouse")

    response = record(warehouse, "in", 30)

    assert response.status_code == 201
    body = response.json()
    assert body["ref_doc"] == "IN-0001"
    assert body["movement_type"] == "in"
    assert body["quantity"] == 30
    assert body["on_hand"] == 200
    assert on_hand(warehouse) == 200


def test_stock_in_note_is_optional_and_kept(client_as):
    warehouse = client_as("warehouse")

    response = record(warehouse, "in", 10, reason="Delivery from Chiang Mai farm")

    assert response.status_code == 201
    assert response.json()["reason"] == "Delivery from Chiang Mai farm"


def test_stock_ins_are_numbered_one_after_another(client_as):
    admin = client_as("admin")

    first = record(admin, "in", 1)
    second = record(admin, "in", 1, sku="ROB-1KG")

    assert first.json()["ref_doc"] == "IN-0001"
    assert second.json()["ref_doc"] == "IN-0002"


# ---------------------------------------------------------------- Stock-out


def test_stock_out_is_entered_positive_and_lowers_on_hand(client_as):
    warehouse = client_as("warehouse")

    response = record(warehouse, "out", 5, reason="Samples for Café Lune")

    assert response.status_code == 201
    body = response.json()
    assert body["ref_doc"] == "OUT-0001"
    assert body["quantity"] == -5
    assert body["on_hand"] == 165
    assert on_hand(warehouse) == 165


def test_stock_out_of_171_from_170_is_refused_and_changes_nothing(client_as):
    warehouse = client_as("warehouse")

    response = record(warehouse, "out", 171, reason="Too many")

    assert response.status_code == 409
    assert response.json() == {"detail": "Not enough stock for ARB-1KG"}
    assert on_hand(warehouse) == 170


def test_a_refused_movement_does_not_burn_a_document_number(client_as):
    warehouse = client_as("warehouse")
    record(warehouse, "out", 171, reason="Too many")

    next_out = record(warehouse, "out", 1, reason="Sample")
    next_in = record(warehouse, "in", 1)

    assert next_out.json()["ref_doc"] == "OUT-0001"
    assert next_in.json()["ref_doc"] == "IN-0001"


def test_stock_out_without_a_reason_is_refused(client_as):
    warehouse = client_as("warehouse")

    response = record(warehouse, "out", 5)

    assert response.status_code == 422
    assert response.json() == {"detail": "Reason is required for a stock-out or adjustment"}
    assert on_hand(warehouse) == 170


def test_stock_out_with_a_blank_reason_is_refused(client_as):
    response = record(client_as("warehouse"), "out", 5, reason="   ")

    assert response.status_code == 422
    assert response.json() == {"detail": "Reason is required for a stock-out or adjustment"}


# --------------------------------------------------------------- Adjustment


def test_adjustment_of_minus_3_for_damaged_bags_gives_167_and_adj_0001(client_as):
    warehouse = client_as("warehouse")

    response = record(warehouse, "adjust", -3, reason="damaged bags")

    assert response.status_code == 201
    body = response.json()
    assert body["ref_doc"] == "ADJ-0001"
    assert body["quantity"] == -3
    assert body["reason"] == "damaged bags"
    assert body["on_hand"] == 167
    assert on_hand(warehouse) == 167


def test_adjustment_can_add_stock_after_a_count(client_as):
    warehouse = client_as("warehouse")

    response = record(warehouse, "adjust", 4, reason="count found 4 extra")

    assert response.status_code == 201
    assert response.json()["on_hand"] == 174


def test_adjustment_without_a_reason_is_refused(client_as):
    warehouse = client_as("warehouse")

    response = record(warehouse, "adjust", -3)

    assert response.status_code == 422
    assert response.json() == {"detail": "Reason is required for a stock-out or adjustment"}
    assert on_hand(warehouse) == 170


def test_adjustment_below_zero_is_refused_and_changes_nothing(client_as):
    warehouse = client_as("warehouse")

    response = record(warehouse, "adjust", -171, reason="miscount")

    assert response.status_code == 409
    assert response.json() == {"detail": "Not enough stock for ARB-1KG"}
    assert on_hand(warehouse) == 170
    assert record(warehouse, "adjust", -1, reason="ok").json()["ref_doc"] == "ADJ-0001"


# ---------------------------------------------------------- bad quantities


@pytest.mark.parametrize("movement_type", ["in", "out", "adjust"])
def test_quantity_zero_is_refused(client_as, movement_type):
    warehouse = client_as("warehouse")

    response = record(warehouse, movement_type, 0, reason="x")

    assert response.status_code == 422
    assert response.json() == {"detail": "Quantity can't be 0"}
    assert on_hand(warehouse) == 170


@pytest.mark.parametrize("movement_type", ["in", "out", "adjust"])
def test_a_non_whole_quantity_is_refused(client_as, movement_type):
    warehouse = client_as("warehouse")

    response = record(warehouse, movement_type, 2.5, reason="x")

    assert response.status_code == 422
    assert response.json() == {"detail": "Quantity must be a whole number"}
    assert on_hand(warehouse) == 170


@pytest.mark.parametrize("movement_type", ["in", "out"])
def test_in_and_out_quantities_must_be_positive(client_as, movement_type):
    response = record(client_as("warehouse"), movement_type, -5, reason="x")

    assert response.status_code == 422
    assert response.json() == {"detail": "Quantity must be greater than 0"}


def test_an_unknown_movement_type_is_refused(client_as):
    response = record(client_as("warehouse"), "sale", 5, reason="x")

    assert response.status_code == 422


# ---------------------------------------------------------------- products


def test_a_deactivated_product_is_refused(client_as, conn, test_company_id):
    warehouse = client_as("warehouse")
    pid = product_id(warehouse, "ROB-1KG")
    conn.execute("update public.products set active = false where id = %s", (pid,))

    response = warehouse.post(MOVEMENTS, json={"product_id": pid, "movement_type": "in", "quantity": 5})

    assert response.status_code == 409
    assert response.json() == {"detail": "ROB-1KG is deactivated. Reactivate it before moving stock."}
    assert pid not in {p["id"] for p in warehouse.get(PRODUCTS).json()}


def test_a_product_of_another_company_is_not_found(client_as, conn):
    other = support.create_test_company(conn, "other")
    try:
        foreign = support.insert_product(conn, other, "FOREIGN-1")
        support.insert_movement(conn, other, foreign, 50, "opening")

        response = client_as("warehouse").post(
            MOVEMENTS, json={"product_id": foreign, "movement_type": "in", "quantity": 5}
        )

        assert response.status_code == 404
        assert response.json() == {"detail": "Product not found"}
        assert support.on_hand(conn, foreign) == 50
        history = client_as("warehouse").get(MOVEMENTS, params={"product_id": foreign})
        assert history.status_code == 404
    finally:
        support.drop_company(conn, other)


def test_the_product_picker_lists_active_products_with_on_hand_and_low_stock(client_as):
    response = client_as("warehouse").get(PRODUCTS)

    assert response.status_code == 200
    by_sku = {p["sku"]: p for p in response.json()}
    assert set(by_sku) == {"ARB-1KG", "ROB-1KG", "BLD-1KG", "DRP-10"}
    arabica = by_sku["ARB-1KG"]
    assert set(arabica) == {"id", "sku", "name", "unit", "on_hand", "reorder_level", "low_stock"}
    assert arabica["on_hand"] == 170
    assert arabica["unit"] == "kg"
    assert arabica["low_stock"] is False
    # ROB-1KG: 35 On Hand, Reorder Level 40
    assert by_sku["ROB-1KG"]["on_hand"] == 35
    assert by_sku["ROB-1KG"]["low_stock"] is True
    assert by_sku["DRP-10"]["unit"] == "box"


# ----------------------------------------------------------------- history


def test_history_lists_opening_stock_and_new_movements_newest_first_with_running_balance(client_as):
    warehouse = client_as("warehouse")
    record(warehouse, "in", 30)
    record(warehouse, "out", 20, reason="Samples")
    record(warehouse, "adjust", -3, reason="damaged bags")

    response = warehouse.get(MOVEMENTS, params={"product_id": product_id(warehouse)})

    assert response.status_code == 200
    page = response.json()
    assert (page["total"], page["page"], page["page_size"]) == (4, 1, 20)
    rows = [
        (m["movement_type"], m["ref_doc"], m["quantity"], m["balance_after"])
        for m in page["items"]
    ]
    assert rows == [
        ("adjust", "ADJ-0001", -3, 177),
        ("out", "OUT-0001", -20, 180),
        ("in", "IN-0001", 30, 200),
        ("opening", "OPENING", 170, 170),
    ]


def test_history_items_carry_the_documented_fields_and_who(client_as, api_company):
    warehouse = client_as("warehouse")
    record(warehouse, "adjust", -3, reason="damaged bags")

    items = warehouse.get(MOVEMENTS, params={"product_id": product_id(warehouse)}).json()["items"]

    adjust = items[0]
    assert set(adjust) == {
        "id", "created_at", "movement_type", "ref_doc", "quantity", "reason",
        "balance_after", "created_by_name",
    }
    assert adjust["reason"] == "damaged bags"
    assert adjust["created_by_name"] == api_company.users["warehouse"].full_name
    assert items[-1]["movement_type"] == "opening"
    assert items[-1]["created_by_name"] is None


def test_history_is_paginated_20_per_page(client_as):
    admin = client_as("admin")
    for _ in range(24):
        assert record(admin, "in", 1).status_code == 201  # 24 + opening = 25 movements

    pid = product_id(admin)
    first = admin.get(MOVEMENTS, params={"product_id": pid}).json()
    second = admin.get(MOVEMENTS, params={"product_id": pid, "page": 2}).json()

    assert first["total"] == 25
    assert len(first["items"]) == 20
    assert len(second["items"]) == 5
    assert first["items"][0]["balance_after"] == 194
    assert second["items"][-1]["movement_type"] == "opening"
    assert second["items"][-1]["balance_after"] == 170


def test_history_only_shows_the_chosen_product(client_as):
    warehouse = client_as("warehouse")
    record(warehouse, "in", 5, sku="ROB-1KG")

    items = warehouse.get(MOVEMENTS, params={"product_id": product_id(warehouse)}).json()["items"]

    assert [m["movement_type"] for m in items] == ["opening"]


def test_history_for_an_unknown_product_is_not_found(client_as):
    response = client_as("warehouse").get(MOVEMENTS, params={"product_id": 999999999})

    assert response.status_code == 404


def test_history_needs_a_product(client_as):
    response = client_as("warehouse").get(MOVEMENTS)

    assert response.status_code == 422
    assert response.json() == {"detail": "Product ID is required"}


# ------------------------------------------------------------------- roles


@pytest.mark.parametrize("role", ["admin", "warehouse"])
def test_admin_and_warehouse_may_use_stock(client_as, role):
    client = client_as(role)

    assert client.get(PRODUCTS).status_code == 200
    assert record(client, "in", 1).status_code == 201
    assert client.get(MOVEMENTS, params={"product_id": product_id(client)}).status_code == 200


@pytest.mark.parametrize("role", ["sales", "accountant"])
def test_sales_and_accountant_are_refused_on_every_stock_endpoint(client_as, client_as_admin_ids, role):
    client = client_as(role)
    pid = client_as_admin_ids["ARB-1KG"]

    post = client.post(MOVEMENTS, json={"product_id": pid, "movement_type": "in", "quantity": 5})
    history = client.get(MOVEMENTS, params={"product_id": pid})
    picker = client.get(PRODUCTS)

    assert (post.status_code, history.status_code, picker.status_code) == (403, 403, 403)
    assert on_hand(client_as_admin_ids["client"]) == 170  # nothing was written


@pytest.fixture
def client_as_admin_ids(client_as):
    """Product ids by SKU, read as the Admin, plus that client (sales/accountant cannot list them)."""
    admin = client_as("admin")
    ids = {p["sku"]: p["id"] for p in admin.get(PRODUCTS).json()}
    return {**ids, "client": admin}


def test_no_token_is_401(client):
    assert client.get(PRODUCTS).status_code == 401
    assert client.get(MOVEMENTS, params={"product_id": 1}).status_code == 401
    assert (
        client.post(MOVEMENTS, json={"product_id": 1, "movement_type": "in", "quantity": 1}).status_code
        == 401
    )
