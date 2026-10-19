"""Ticket 06: customers (CRUD, search, pagination). Covers US-5 and business rules 7 and 9.

The clean test company starts with 3 customers: Café Lune (Tax ID 0105561000011, 30 days),
Brew Lab Ari (Cash) and Sukhumvit Corner Café.
"""

from __future__ import annotations

import time

import pytest

from tests import support

NEW_CUSTOMER = {
    "name": "Café Mali",
    "tax_id": "0105563000033",
    "payment_terms_days": 15,
    "address": "5 Soi Thonglor, Bangkok",
    "phone": "02-555-0199",
}


def _add_generated_cafes(conn, company_id: int, count: int) -> None:
    """Insert `count` extra customers whose names never contain 'lune'."""
    for number in range(1, count + 1):
        support.insert_customer(conn, company_id, name=f"Generated Roastery {number:03d}")


def _find(client, name: str) -> dict:
    items = client.get("/api/customers", params={"q": name}).json()["items"]
    return next(item for item in items if item["name"] == name)


# ------------------------------------------------------------------ list / US-5


def test_searching_lune_among_200_customers_finds_cafe_lune_fast(client_as, conn, test_company_id):
    _add_generated_cafes(conn, test_company_id, 197)  # 3 sample + 197 = 200
    client = client_as("sales")
    client.get("/api/customers", params={"page_size": 1})  # warm-up: opens the pool, fetches the JWKS

    started = time.perf_counter()
    response = client.get("/api/customers", params={"q": "lune"})
    elapsed = time.perf_counter() - started

    assert response.status_code == 200
    body = response.json()
    assert [item["name"] for item in body["items"]] == ["Café Lune"]
    assert body["total"] == 1
    assert elapsed < 1.0


def test_the_list_never_returns_more_than_20_items_and_reports_the_total(client_as, conn, test_company_id):
    _add_generated_cafes(conn, test_company_id, 197)
    client = client_as("sales")

    first = client.get("/api/customers").json()
    last = client.get("/api/customers", params={"page": 10}).json()
    beyond = client.get("/api/customers", params={"page": 11}).json()

    assert (first["total"], first["page"], first["page_size"]) == (200, 1, 20)
    assert len(first["items"]) == 20
    assert len(last["items"]) == 20
    assert last["page"] == 10
    assert beyond["items"] == []
    assert beyond["total"] == 200


def test_pages_do_not_overlap_and_are_ordered_by_name(client_as, conn, test_company_id):
    _add_generated_cafes(conn, test_company_id, 197)
    client = client_as("sales")

    names = []
    for page in (1, 2, 3):
        names += [c["name"] for c in client.get("/api/customers", params={"page": page}).json()["items"]]

    assert len(set(names)) == 60
    assert names == sorted(names)


def test_page_size_above_20_is_refused(client_as):
    response = client_as("sales").get("/api/customers", params={"page_size": 21})

    assert response.status_code == 422
    assert "Page size" in response.json()["detail"]


def test_a_customer_in_the_list_has_the_agreed_fields(client_as):
    item = _find(client_as("sales"), "Café Lune")

    assert item["tax_id"] == "0105561000011"
    assert item["payment_terms_days"] == 30
    assert item["active"] is True
    assert set(item) == {"id", "name", "tax_id", "payment_terms_days", "address", "phone", "active"}


def test_search_is_case_insensitive_and_matches_part_of_the_name(client_as):
    client = client_as("sales")

    for q in ("LUNE", "Caf", "ari"):
        names = [c["name"] for c in client.get("/api/customers", params={"q": q}).json()["items"]]
        assert names, q
    lune = [c["name"] for c in client.get("/api/customers", params={"q": "LUNE"}).json()["items"]]
    assert lune == ["Café Lune"]


def test_search_also_matches_the_tax_id(client_as):
    response = client_as("sales").get("/api/customers", params={"q": "0105562000022"})

    assert [c["name"] for c in response.json()["items"]] == ["Brew Lab Ari"]


def test_a_search_with_no_match_returns_an_empty_page(client_as):
    body = client_as("sales").get("/api/customers", params={"q": "xyz"}).json()

    assert body["items"] == []
    assert body["total"] == 0


def test_search_treats_percent_and_underscore_as_plain_text(client_as):
    body = client_as("sales").get("/api/customers", params={"q": "%"}).json()

    assert body["total"] == 0


def test_the_list_only_shows_the_callers_company(client_as, conn, company):
    support.insert_customer(conn, company, name="Other Company Café")

    names = [c["name"] for c in client_as("admin").get("/api/customers", params={"q": "Other"}).json()["items"]]

    assert names == []


def test_active_filter_excludes_deactivated_customers(client_as):
    client = client_as("sales")
    lune = _find(client, "Café Lune")
    assert client.patch(f"/api/customers/{lune['id']}", json={"active": False}).status_code == 200

    active = client.get("/api/customers", params={"active": "true"}).json()
    inactive = client.get("/api/customers", params={"active": "false"}).json()
    everyone = client.get("/api/customers").json()

    assert "Café Lune" not in [c["name"] for c in active["items"]]
    assert active["total"] == 2
    assert [c["name"] for c in inactive["items"]] == ["Café Lune"]
    assert everyone["total"] == 3


# ------------------------------------------------------------------ view one


def test_view_one_customer(client_as):
    lune = _find(client_as("sales"), "Café Lune")

    response = client_as("accountant").get(f"/api/customers/{lune['id']}")

    assert response.status_code == 200
    assert response.json() == lune


def test_a_customer_of_another_company_is_not_found(client_as, conn, company):
    other = support.insert_customer(conn, company, name="Other Company Café")

    assert client_as("admin").get(f"/api/customers/{other}").status_code == 404
    assert client_as("admin").patch(f"/api/customers/{other}", json={"name": "Hijacked"}).status_code == 404


def test_an_unknown_customer_is_not_found(client_as):
    response = client_as("sales").get("/api/customers/999999999")

    assert response.status_code == 404
    assert "detail" in response.json()


# ------------------------------------------------------------------ create


@pytest.mark.parametrize("role", ["admin", "sales"])
def test_admin_and_sales_create_a_customer(client_as, role):
    client = client_as(role)

    response = client.post("/api/customers", json=NEW_CUSTOMER)

    assert response.status_code == 201
    created = response.json()
    assert created["name"] == "Café Mali"
    assert created["tax_id"] == "0105563000033"
    assert created["payment_terms_days"] == 15
    assert created["address"] == "5 Soi Thonglor, Bangkok"
    assert created["phone"] == "02-555-0199"
    assert created["active"] is True
    assert client.get(f"/api/customers/{created['id']}").json() == created


def test_create_trims_text_and_defaults_to_cash(client_as):
    response = client_as("sales").post(
        "/api/customers", json={"name": "  Café Mali  ", "tax_id": " 0105563000033 ", "phone": "  "}
    )

    assert response.status_code == 201
    created = response.json()
    assert created["name"] == "Café Mali"
    assert created["tax_id"] == "0105563000033"
    assert created["payment_terms_days"] == 0
    assert created["phone"] is None


def test_create_without_a_tax_id_is_refused(client_as):
    client = client_as("sales")
    body = {"name": "Café Mali", "payment_terms_days": 30}

    missing = client.post("/api/customers", json=body)
    blank = client.post("/api/customers", json={**body, "tax_id": "   "})
    empty = client.post("/api/customers", json={**body, "tax_id": ""})

    for response in (missing, blank, empty):
        assert response.status_code == 422
        assert response.json() == {"detail": "Tax ID is required"}
    assert client.get("/api/customers", params={"q": "Mali"}).json()["total"] == 0


def test_create_without_a_name_is_refused(client_as):
    response = client_as("sales").post("/api/customers", json={"name": "  ", "tax_id": "0105563000033"})

    assert response.status_code == 422
    assert response.json() == {"detail": "Name is required"}


def test_create_with_negative_payment_terms_is_refused(client_as):
    response = client_as("sales").post("/api/customers", json={**NEW_CUSTOMER, "payment_terms_days": -1})

    assert response.status_code == 422
    assert response.json() == {"detail": "Payment terms days must be 0 or more"}


def test_the_tax_id_is_not_unique_because_branches_share_one(client_as):
    client = client_as("sales")

    first = client.post("/api/customers", json=NEW_CUSTOMER)
    branch = client.post("/api/customers", json={**NEW_CUSTOMER, "name": "Café Mali Thonglor"})

    assert first.status_code == 201
    assert branch.status_code == 201


# ------------------------------------------------------------------ edit / deactivate


@pytest.mark.parametrize("role", ["admin", "sales"])
def test_admin_and_sales_edit_a_customer(client_as, role):
    client = client_as(role)
    lune = _find(client, "Café Lune")

    response = client.patch(
        f"/api/customers/{lune['id']}",
        json={"name": " Café Lune Ari ", "payment_terms_days": 0, "address": "New address"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Café Lune Ari"
    assert body["payment_terms_days"] == 0
    assert body["address"] == "New address"
    assert body["tax_id"] == "0105561000011"  # untouched fields stay
    assert client.get(f"/api/customers/{lune['id']}").json() == body


def test_deactivate_and_reactivate(client_as):
    client = client_as("sales")
    lune = _find(client, "Café Lune")

    off = client.patch(f"/api/customers/{lune['id']}", json={"active": False})
    on = client.patch(f"/api/customers/{lune['id']}", json={"active": True})

    assert off.status_code == 200 and off.json()["active"] is False
    assert on.status_code == 200 and on.json()["active"] is True
    assert client.get("/api/customers", params={"active": "true", "q": "lune"}).json()["total"] == 1


def test_edit_cannot_remove_the_tax_id_or_use_negative_terms(client_as):
    client = client_as("sales")
    lune = _find(client, "Café Lune")

    blank = client.patch(f"/api/customers/{lune['id']}", json={"tax_id": " "})
    negative = client.patch(f"/api/customers/{lune['id']}", json={"payment_terms_days": -5})

    assert blank.status_code == 422
    assert blank.json() == {"detail": "Tax ID is required"}
    assert negative.status_code == 422
    assert negative.json() == {"detail": "Payment terms days must be 0 or more"}
    assert client.get(f"/api/customers/{lune['id']}").json() == lune


def test_there_is_no_delete_endpoint(client_as):
    lune = _find(client_as("admin"), "Café Lune")

    assert client_as("admin").delete(f"/api/customers/{lune['id']}").status_code == 405


# ------------------------------------------------------------------ Role matrix


@pytest.mark.parametrize(("role", "status"), [("admin", 200), ("sales", 200), ("accountant", 200), ("warehouse", 403)])
def test_who_may_list_and_view_customers(client_as, role, status):
    lune_id = _find(client_as("admin"), "Café Lune")["id"]
    client = client_as(role)

    assert client.get("/api/customers").status_code == status
    assert client.get(f"/api/customers/{lune_id}").status_code == status


@pytest.mark.parametrize(("role", "status"), [("admin", 201), ("sales", 201), ("accountant", 403), ("warehouse", 403)])
def test_who_may_create_customers(client_as, role, status):
    assert client_as(role).post("/api/customers", json=NEW_CUSTOMER).status_code == status


@pytest.mark.parametrize(("role", "status"), [("admin", 200), ("sales", 200), ("accountant", 403), ("warehouse", 403)])
def test_who_may_edit_customers(client_as, role, status):
    lune_id = _find(client_as("admin"), "Café Lune")["id"]

    response = client_as(role).patch(f"/api/customers/{lune_id}", json={"phone": "02-000-0000"})

    assert response.status_code == status


def test_a_refused_edit_changes_nothing(client_as):
    lune = _find(client_as("admin"), "Café Lune")

    client_as("accountant").patch(f"/api/customers/{lune['id']}", json={"active": False})

    assert client_as("admin").get(f"/api/customers/{lune['id']}").json() == lune


def test_customers_need_a_token(client):
    assert client.get("/api/customers").status_code == 401
    assert client.post("/api/customers", json=NEW_CUSTOMER).status_code == 401
    assert client.patch("/api/customers/1", json={"active": False}).status_code == 401
