"""Ticket 02: errors are always `{"detail": "<human message>"}`; money is a 2-decimal string.

The endpoints under /api/_test (tests/support_routes.py) stand in for real modules.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tests.support import on_hand_by_sku

VALID = {
    "sku": "ARB-1KG",
    "tax_id": "0105561000011",
    "price": "450.00",
    "quantity": 20,
    "unit": "kg",
}


def post_validate(client_as, **changes):
    body = {**VALID, **changes}
    body = {k: v for k, v in body.items() if v is not ...}  # `field=...` removes the field
    return client_as("sales").post("/api/_test/validate", json=body)


# ------------------------------------------------------------- validation


def test_a_valid_body_is_accepted(client_as):
    assert post_validate(client_as).status_code == 200


@pytest.mark.parametrize(
    ("changes", "message"),
    [
        ({"price": "-1"}, "Price must be 0 or more"),
        ({"quantity": 0}, "Quantity must be greater than 0"),
        ({"quantity": -5}, "Quantity must be greater than 0"),
        ({"tax_id": ...}, "Tax ID is required"),
        ({"tax_id": ""}, "Tax ID is required"),
        ({"sku": ""}, "SKU is required"),
        ({"unit": "bag"}, "Unit must be kg or box"),
        ({"quantity": 1.5}, "Quantity must be a whole number"),
        ({"quantity": "abc"}, "Quantity must be a whole number"),
        ({"price": "abc"}, "Price must be a number"),
        ({"price": "450.123"}, "Price can have at most 2 decimal places"),
    ],
)
def test_a_bad_field_comes_back_as_one_readable_sentence(client_as, changes, message):
    response = post_validate(client_as, **changes)

    assert response.status_code == 422
    assert response.json() == {"detail": message}


def test_each_wrong_field_gets_its_own_message_in_one_detail(client_as):
    response = post_validate(client_as, tax_id=..., price="-1", quantity=0)

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Tax ID is required; Price must be 0 or more; Quantity must be greater than 0"
    }


def test_a_wrong_field_on_a_line_says_which_line(client_as):
    response = post_validate(client_as, lines=[{"quantity": 5}, {"quantity": 0}])

    assert response.status_code == 422
    assert response.json() == {"detail": "Line 2: Quantity must be greater than 0"}


def test_a_body_that_is_not_json_is_explained(client_as):
    response = client_as("sales").post(
        "/api/_test/validate", content="{oops", headers={"Content-Type": "application/json"}
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "The request body is not valid JSON"}


def test_a_missing_body_is_explained(client_as):
    response = client_as("sales").post("/api/_test/validate")

    assert response.status_code == 422
    assert response.json() == {"detail": "The request body is required"}


# ------------------------------------------------------------------ money


@pytest.mark.parametrize(
    ("sent", "shown"),
    [("9000", "9000.00"), (630, "630.00"), (450.5, "450.50"), ("9630.00", "9630.00"), ("0", "0.00")],
)
def test_money_is_returned_as_a_string_with_two_decimals(client_as, sent, shown):
    response = client_as("admin").post("/api/_test/money", json={"amount": sent})

    assert response.status_code == 200
    assert response.json() == {"amount": shown}


def test_money_with_more_than_two_decimals_is_refused(client_as):
    response = client_as("admin").post("/api/_test/money", json={"amount": "1.005"})

    assert response.status_code == 422
    assert response.json() == {"detail": "Amount can have at most 2 decimal places"}


def test_money_too_big_for_the_database_is_refused(client_as):
    response = client_as("admin").post("/api/_test/money", json={"amount": "12345678901.00"})

    assert response.status_code == 422
    assert response.json() == {"detail": "Amount is too large"}


def test_money_rounds_half_up_when_it_has_to_round(client_as):
    response = client_as("admin").get("/api/_test/money-rounding")

    assert response.json() == {"amount": "0.13"}


# --------------------------------------------- transaction and database errors


def test_a_stock_trigger_refusal_becomes_409_with_its_own_message(client_as, conn, test_company_id):
    response = client_as("admin").post(
        "/api/_test/stock-moves", json={"sku": "ARB-1KG", "quantities": [-171]}
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Not enough stock for ARB-1KG"}
    assert on_hand_by_sku(conn, test_company_id)["ARB-1KG"] == 170


def test_a_request_that_fails_halfway_changes_nothing(client_as, conn, test_company_id):
    # The first -100 would be fine (170 -> 70); the second fails (70 -> -30).
    response = client_as("admin").post(
        "/api/_test/stock-moves", json={"sku": "ARB-1KG", "quantities": [-100, -100]}
    )

    assert response.status_code == 409
    assert on_hand_by_sku(conn, test_company_id)["ARB-1KG"] == 170


def test_a_successful_request_is_saved_before_the_response_arrives(client_as, conn, test_company_id):
    response = client_as("admin").post(
        "/api/_test/stock-moves", json={"sku": "ARB-1KG", "quantities": [-20]}
    )

    assert response.status_code == 200
    assert on_hand_by_sku(conn, test_company_id)["ARB-1KG"] == 150


def test_a_duplicate_value_becomes_409(client_as):
    response = client_as("admin").post("/api/_test/duplicate-sku")

    assert response.status_code == 409
    assert response.json() == {"detail": "That already exists. Check for a duplicate and try again."}


def test_an_unplanned_error_still_answers_with_a_detail(app, clean_company):
    quiet = TestClient(
        app, raise_server_exceptions=False, headers=clean_company.users["admin"].headers
    )

    response = quiet.get("/api/_test/boom")

    assert response.status_code == 500
    assert response.json() == {"detail": "Something went wrong on our side. Please try again."}
