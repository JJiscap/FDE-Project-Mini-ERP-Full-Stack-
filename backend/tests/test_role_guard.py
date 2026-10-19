"""Ticket 02: the `require_roles` guard every module uses (wrong Role -> 403, no token -> 401)."""

from __future__ import annotations

import pytest


@pytest.mark.parametrize(
    ("role", "status"),
    [("admin", 200), ("sales", 403), ("warehouse", 403), ("accountant", 403)],
)
def test_an_admin_only_endpoint_lets_only_the_admin_in(client_as, role, status):
    response = client_as(role).get("/api/_test/admin-only")

    assert response.status_code == status


@pytest.mark.parametrize(
    ("role", "status"),
    [("admin", 200), ("sales", 200), ("warehouse", 403), ("accountant", 403)],
)
def test_an_endpoint_for_admin_and_sales_refuses_the_others(client_as, role, status):
    response = client_as(role).get("/api/_test/admin-or-sales")

    assert response.status_code == status


def test_an_allowed_role_gets_through_as_the_current_user(client_as, api_company):
    response = client_as("sales").get("/api/_test/admin-or-sales")

    assert response.json() == {"email": api_company.users["sales"].email, "role": "sales"}


def test_a_refused_role_is_told_which_role_it_has(client_as):
    response = client_as("warehouse").get("/api/_test/admin-or-sales")

    assert response.status_code == 403
    assert response.json() == {"detail": "Your role (warehouse) is not allowed to do this."}


def test_a_guarded_endpoint_without_a_token_is_401_not_403(client):
    response = client.get("/api/_test/admin-only")

    assert response.status_code == 401


def test_a_guarded_endpoint_refuses_a_user_with_no_users_row(client, login_without_role):
    response = client.get("/api/_test/admin-only", headers=login_without_role)

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Your account has no role yet. Ask the owner to give you access."
    }


def test_login_is_checked_before_the_body_is_validated(client):
    # A stranger must not learn what the validation rules are.
    response = client.post("/api/_test/validate", json={"price": -1})

    assert response.status_code == 401
