"""Ticket 05: Products (list with On Hand and Low Stock, Admin-only create/edit/deactivate).

Expected values come from the scenario: ARB-1KG 170 kg (reorder 50), ROB-1KG 35 kg
(reorder 40, so Low Stock), BLD-1KG 90, DRP-10 240 boxes.
"""

from __future__ import annotations

import pytest

from tests import support

NON_ADMIN_ROLES = ("sales", "warehouse", "accountant")
ALL_ROLES = ("admin", "sales", "warehouse", "accountant")

NEW_PRODUCT = {
    "sku": "NEW-1KG",
    "name": "New bean, 1 kg bag",
    "unit": "kg",
    "price": "500.00",
    "cost": "350.00",
    "reorder_level": 20,
}


def _by_sku(client, **params) -> dict[str, dict]:
    response = client.get("/api/products", params=params)
    assert response.status_code == 200, response.text
    return {item["sku"]: item for item in response.json()["items"]}


def _product_id(client, sku: str) -> int:
    return _by_sku(client)[sku]["id"]


# ------------------------------------------------------------------- list


def test_list_shows_on_hand_and_flags_only_rob_1kg_as_low_stock(client_as):
    response = client_as("sales").get("/api/products")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 4
    assert body["page"] == 1
    assert body["page_size"] == 20
    assert [item["sku"] for item in body["items"]] == ["ARB-1KG", "BLD-1KG", "DRP-10", "ROB-1KG"]
    arb, bld, drp, rob = body["items"]
    assert arb["on_hand"] == 170 and arb["low_stock"] is False  # 170 >= 50
    assert rob["on_hand"] == 35 and rob["low_stock"] is True  # 35 < 40
    assert bld["on_hand"] == 90 and bld["low_stock"] is False
    assert drp["on_hand"] == 240 and drp["low_stock"] is False


def test_list_item_has_the_documented_shape_with_money_as_strings(client_as):
    items = _by_sku(client_as("sales"))

    assert items["ARB-1KG"] == {
        "id": items["ARB-1KG"]["id"],
        "sku": "ARB-1KG",
        "name": "Arabica, 1 kg bag",
        "unit": "kg",
        "price": "450.00",
        "cost": "320.00",
        "reorder_level": 50,
        "active": True,
        "on_hand": 170,
        "low_stock": False,
    }
    assert items["DRP-10"]["unit"] == "box"


@pytest.mark.parametrize("role", ALL_ROLES)
def test_every_role_can_list_products(client_as, role):
    assert client_as(role).get("/api/products").status_code == 200


def test_list_without_a_token_is_401(client):
    assert client.get("/api/products").status_code == 401


def test_stock_exactly_at_reorder_level_is_not_low_stock(client_as, conn, test_company_id):
    # ROB-1KG: 35 on hand, reorder level 40. Add 5 -> 40 == reorder level: not below.
    admin = client_as("admin")
    rob_id = _product_id(admin, "ROB-1KG")
    support.insert_movement(conn, test_company_id, rob_id, 5, "in", ref_doc="IN-T1")

    rob = _by_sku(admin)["ROB-1KG"]

    assert rob["on_hand"] == 40
    assert rob["low_stock"] is False


def test_inactive_product_is_never_low_stock(client_as):
    admin = client_as("admin")
    rob_id = _product_id(admin, "ROB-1KG")
    admin.patch(f"/api/products/{rob_id}", json={"active": False})

    rob = _by_sku(admin)["ROB-1KG"]

    assert rob["active"] is False
    assert rob["on_hand"] == 35
    assert rob["low_stock"] is False


def test_low_stock_filter_returns_only_low_stock_products(client_as):
    body = client_as("warehouse").get("/api/products", params={"low_stock": "true"}).json()

    assert [item["sku"] for item in body["items"]] == ["ROB-1KG"]
    assert body["total"] == 1


def test_low_stock_false_filter_returns_the_rest(client_as):
    items = _by_sku(client_as("warehouse"), low_stock="false")

    assert sorted(items) == ["ARB-1KG", "BLD-1KG", "DRP-10"]


def test_search_matches_sku_or_name_ignoring_case(client_as):
    sales = client_as("sales")

    assert sorted(_by_sku(sales, q="arb")) == ["ARB-1KG"]  # SKU, lower case
    assert sorted(_by_sku(sales, q="DRIP")) == ["DRP-10"]  # name, upper case
    assert sorted(_by_sku(sales, q="1 kg")) == ["ARB-1KG", "BLD-1KG", "ROB-1KG"]
    assert _by_sku(sales, q="xyz") == {}


def test_search_with_no_match_returns_an_empty_page(client_as):
    body = client_as("sales").get("/api/products", params={"q": "xyz"}).json()

    assert body["items"] == []
    assert body["total"] == 0


def test_active_filter_splits_active_and_inactive(client_as):
    admin = client_as("admin")
    admin.patch(f"/api/products/{_product_id(admin, 'DRP-10')}", json={"active": False})

    assert sorted(_by_sku(admin, active="true")) == ["ARB-1KG", "BLD-1KG", "ROB-1KG"]
    assert sorted(_by_sku(admin, active="false")) == ["DRP-10"]
    assert len(_by_sku(admin)) == 4  # no filter: all


def test_list_is_paged_at_20_in_sku_order(client_as, conn, test_company_id):
    for number in range(25):
        support.insert_product(conn, test_company_id, f"PG-{number:02d}")
    sales = client_as("sales")

    first = sales.get("/api/products").json()
    second = sales.get("/api/products", params={"page": 2}).json()

    assert first["total"] == 29  # 4 samples + 25
    assert first["page"] == 1 and len(first["items"]) == 20
    assert second["page"] == 2 and len(second["items"]) == 9
    skus = [item["sku"] for item in first["items"] + second["items"]]
    assert skus == sorted(skus)
    assert len(set(skus)) == 29


def test_page_size_above_20_is_refused(client_as):
    response = client_as("sales").get("/api/products", params={"page_size": 50})

    assert response.status_code == 422
    assert "20" in response.json()["detail"]


def test_page_size_can_be_smaller(client_as):
    body = client_as("sales").get("/api/products", params={"page_size": 2}).json()

    assert len(body["items"]) == 2
    assert body["page_size"] == 2
    assert body["total"] == 4


def test_list_only_shows_the_callers_company(client_as, conn, company):
    support.insert_product(conn, company, "OTHER-1")

    assert "OTHER-1" not in _by_sku(client_as("admin"))


# --------------------------------------------------------------------- get


@pytest.mark.parametrize("role", ALL_ROLES)
def test_every_role_can_get_one_product(client_as, role):
    admin = client_as("admin")
    product_id = _product_id(admin, "ARB-1KG")

    response = client_as(role).get(f"/api/products/{product_id}")

    assert response.status_code == 200
    assert response.json()["sku"] == "ARB-1KG"
    assert response.json()["on_hand"] == 170


def test_get_unknown_product_is_404(client_as):
    assert client_as("sales").get("/api/products/999999999").status_code == 404


def test_get_product_of_another_company_is_404(client_as, conn, company):
    other_id = support.insert_product(conn, company, "OTHER-1")

    assert client_as("admin").get(f"/api/products/{other_id}").status_code == 404


def test_patch_product_of_another_company_is_404(client_as, conn, company):
    other_id = support.insert_product(conn, company, "OTHER-1")

    response = client_as("admin").patch(f"/api/products/{other_id}", json={"price": "1.00"})

    assert response.status_code == 404
    row = conn.execute("select price from public.products where id = %s", (other_id,)).fetchone()
    assert str(row["price"]) == "450.00"  # untouched


# ------------------------------------------------------------------ create


def test_admin_creates_a_product_that_starts_with_zero_on_hand(client_as, conn, test_company_id):
    admin = client_as("admin")

    response = admin.post("/api/products", json=NEW_PRODUCT)

    assert response.status_code == 201, response.text
    created = response.json()
    assert created["sku"] == "NEW-1KG"
    assert created["price"] == "500.00"
    assert created["cost"] == "350.00"
    assert created["active"] is True
    assert created["on_hand"] == 0
    listed = _by_sku(admin)["NEW-1KG"]
    assert listed["on_hand"] == 0
    assert listed["low_stock"] is True  # 0 < reorder level 20
    moves = conn.execute(
        "select count(*) as n from public.stock_movements where product_id = %s", (created["id"],)
    ).fetchone()
    assert moves["n"] == 0  # creating a Product never creates stock


def test_create_trims_and_uppercases_the_sku(client_as):
    admin = client_as("admin")

    response = admin.post("/api/products", json={**NEW_PRODUCT, "sku": "  new-1kg "})

    assert response.status_code == 201
    assert response.json()["sku"] == "NEW-1KG"


def test_create_records_who_created_it(client_as, conn, api_company):
    created = client_as("admin").post("/api/products", json=NEW_PRODUCT).json()

    row = conn.execute(
        "select company_id, created_by from public.products where id = %s", (created["id"],)
    ).fetchone()
    assert row["company_id"] == api_company.id
    assert str(row["created_by"]) == api_company.users["admin"].id


def test_duplicate_sku_is_409_with_a_clear_message(client_as):
    response = client_as("admin").post("/api/products", json={**NEW_PRODUCT, "sku": "ARB-1KG"})

    assert response.status_code == 409
    assert response.json() == {"detail": "SKU ARB-1KG already exists"}


def test_duplicate_sku_ignores_case_and_spaces(client_as):
    response = client_as("admin").post("/api/products", json={**NEW_PRODUCT, "sku": " arb-1kg "})

    assert response.status_code == 409
    assert response.json() == {"detail": "SKU ARB-1KG already exists"}


def test_same_sku_in_another_company_is_allowed(client_as, conn, company):
    support.insert_product(conn, company, "NEW-1KG")

    assert client_as("admin").post("/api/products", json=NEW_PRODUCT).status_code == 201


def test_negative_price_is_refused(client_as):
    response = client_as("admin").post("/api/products", json={**NEW_PRODUCT, "price": "-1"})

    assert response.status_code == 422
    assert response.json()["detail"] == "Price must be 0 or more"


def test_negative_cost_is_refused(client_as):
    response = client_as("admin").post("/api/products", json={**NEW_PRODUCT, "cost": "-1"})

    assert response.status_code == 422
    assert response.json()["detail"] == "Cost must be 0 or more"


def test_zero_price_and_cost_are_allowed(client_as):
    response = client_as("admin").post(
        "/api/products", json={**NEW_PRODUCT, "price": "0", "cost": "0.00"}
    )

    assert response.status_code == 201
    assert response.json()["price"] == "0.00"


def test_unit_must_be_kg_or_box(client_as):
    response = client_as("admin").post("/api/products", json={**NEW_PRODUCT, "unit": "lb"})

    assert response.status_code == 422
    assert "Unit must be" in response.json()["detail"]


def test_negative_reorder_level_is_refused(client_as):
    response = client_as("admin").post("/api/products", json={**NEW_PRODUCT, "reorder_level": -1})

    assert response.status_code == 422
    assert response.json()["detail"] == "Reorder level must be 0 or more"


@pytest.mark.parametrize("field", ["sku", "name"])
def test_blank_sku_or_name_is_refused(client_as, field):
    response = client_as("admin").post("/api/products", json={**NEW_PRODUCT, field: "   "})

    assert response.status_code == 422
    assert response.json()["detail"].lower().startswith(field)
    assert "required" in response.json()["detail"]


def test_missing_fields_are_refused_with_one_message_each(client_as):
    response = client_as("admin").post("/api/products", json={"sku": "ONLY-SKU"})

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "Name is required" in detail
    assert "Price is required" in detail


def test_reorder_level_defaults_to_zero(client_as):
    body = {k: v for k, v in NEW_PRODUCT.items() if k != "reorder_level"}

    response = client_as("admin").post("/api/products", json=body)

    assert response.status_code == 201
    assert response.json()["reorder_level"] == 0


# -------------------------------------------------------------------- edit


def test_admin_edits_a_price(client_as):
    admin = client_as("admin")
    arb_id = _product_id(admin, "ARB-1KG")

    response = admin.patch(f"/api/products/{arb_id}", json={"price": "500.00"})

    assert response.status_code == 200, response.text
    assert response.json()["price"] == "500.00"
    assert response.json()["cost"] == "320.00"  # untouched
    assert admin.get(f"/api/products/{arb_id}").json()["price"] == "500.00"


def test_admin_edits_name_cost_unit_and_reorder_level(client_as):
    admin = client_as("admin")
    bld_id = _product_id(admin, "BLD-1KG")

    response = admin.patch(
        f"/api/products/{bld_id}",
        json={"name": "House Blend 2", "cost": "270.00", "unit": "box", "reorder_level": 95},
    )

    assert response.status_code == 200
    edited = response.json()
    assert edited["name"] == "House Blend 2"
    assert edited["cost"] == "270.00"
    assert edited["unit"] == "box"
    assert edited["reorder_level"] == 95
    assert edited["low_stock"] is True  # 90 on hand < 95 now


def test_edit_refuses_a_negative_price_and_cost(client_as):
    admin = client_as("admin")
    arb_id = _product_id(admin, "ARB-1KG")

    price = admin.patch(f"/api/products/{arb_id}", json={"price": "-1"})
    cost = admin.patch(f"/api/products/{arb_id}", json={"cost": "-1"})

    assert (price.status_code, price.json()["detail"]) == (422, "Price must be 0 or more")
    assert (cost.status_code, cost.json()["detail"]) == (422, "Cost must be 0 or more")
    assert admin.get(f"/api/products/{arb_id}").json()["price"] == "450.00"


def test_edit_to_another_products_sku_is_409(client_as):
    admin = client_as("admin")
    rob_id = _product_id(admin, "ROB-1KG")

    response = admin.patch(f"/api/products/{rob_id}", json={"sku": "arb-1kg"})

    assert response.status_code == 409
    assert response.json() == {"detail": "SKU ARB-1KG already exists"}


def test_edit_can_keep_the_same_sku(client_as):
    admin = client_as("admin")
    arb_id = _product_id(admin, "ARB-1KG")

    response = admin.patch(f"/api/products/{arb_id}", json={"sku": "ARB-1KG", "name": "Arabica"})

    assert response.status_code == 200
    assert response.json()["name"] == "Arabica"


def test_edit_cannot_null_a_required_field(client_as):
    admin = client_as("admin")
    arb_id = _product_id(admin, "ARB-1KG")

    response = admin.patch(f"/api/products/{arb_id}", json={"price": None})

    assert response.status_code == 422


def test_deactivate_hides_from_active_results_but_keeps_the_product(client_as):
    admin = client_as("admin")
    arb_id = _product_id(admin, "ARB-1KG")

    response = admin.patch(f"/api/products/{arb_id}", json={"active": False})

    assert response.status_code == 200
    assert response.json()["active"] is False
    assert "ARB-1KG" not in _by_sku(admin, active="true")
    assert "ARB-1KG" in _by_sku(admin, active="false")
    assert admin.get(f"/api/products/{arb_id}").status_code == 200  # still exists, with its stock
    assert admin.get(f"/api/products/{arb_id}").json()["on_hand"] == 170


def test_reactivate_brings_the_product_back(client_as):
    admin = client_as("admin")
    arb_id = _product_id(admin, "ARB-1KG")
    admin.patch(f"/api/products/{arb_id}", json={"active": False})

    response = admin.patch(f"/api/products/{arb_id}", json={"active": True})

    assert response.status_code == 200
    assert "ARB-1KG" in _by_sku(admin, active="true")


def test_there_is_no_delete_endpoint(client_as):
    admin = client_as("admin")
    arb_id = _product_id(admin, "ARB-1KG")

    assert admin.delete(f"/api/products/{arb_id}").status_code == 405


def test_changing_a_price_leaves_existing_order_lines_unchanged(client_as, conn, test_company_id):
    admin = client_as("admin")
    arb_id = _product_id(admin, "ARB-1KG")
    order_id = conn.execute(
        "insert into public.sales_orders (company_id, number, customer_id) "
        "select %s, 'SO-0001', id from public.customers where company_id = %s limit 1 returning id",
        (test_company_id, test_company_id),
    ).fetchone()["id"]
    conn.execute(
        "insert into public.order_items (company_id, order_id, product_id, quantity, unit_price, unit_cost) "
        "values (%s, %s, %s, 20, 450.00, 320.00)",
        (test_company_id, order_id, arb_id),
    )

    response = admin.patch(f"/api/products/{arb_id}", json={"price": "500.00", "cost": "400.00"})

    assert response.status_code == 200
    line = conn.execute(
        "select unit_price, unit_cost from public.order_items where order_id = %s", (order_id,)
    ).fetchone()
    assert str(line["unit_price"]) == "450.00"
    assert str(line["unit_cost"]) == "320.00"
    assert admin.get(f"/api/products/{arb_id}").json()["price"] == "500.00"


# ------------------------------------------------------------------- roles


@pytest.mark.parametrize("role", NON_ADMIN_ROLES)
def test_non_admin_cannot_create_a_product(client_as, role):
    admin = client_as("admin")

    response = client_as(role).post("/api/products", json=NEW_PRODUCT)

    assert response.status_code == 403
    assert "NEW-1KG" not in _by_sku(admin)


@pytest.mark.parametrize("role", NON_ADMIN_ROLES)
def test_non_admin_cannot_edit_a_product(client_as, role):
    admin = client_as("admin")
    arb_id = _product_id(admin, "ARB-1KG")

    response = client_as(role).patch(f"/api/products/{arb_id}", json={"price": "1.00"})

    assert response.status_code == 403
    assert admin.get(f"/api/products/{arb_id}").json()["price"] == "450.00"


@pytest.mark.parametrize("role", NON_ADMIN_ROLES)
def test_non_admin_cannot_deactivate_a_product(client_as, role):
    admin = client_as("admin")
    arb_id = _product_id(admin, "ARB-1KG")

    response = client_as(role).patch(f"/api/products/{arb_id}", json={"active": False})

    assert response.status_code == 403
    assert admin.get(f"/api/products/{arb_id}").json()["active"] is True


def test_writes_without_a_token_are_401(client):
    assert client.post("/api/products", json=NEW_PRODUCT).status_code == 401
    assert client.patch("/api/products/1", json={"price": "1.00"}).status_code == 401
