"""Ticket 02: who is calling? `GET /api/me`, token checks and the Role lookup."""

from __future__ import annotations

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from tests.support import RUN_ID

NOT_LOGGED_IN = {"detail": "You are not logged in. Please sign in and try again."}
INVALID_LOGIN = {"detail": "Your login is not valid or has expired. Please sign in again."}
NO_ROLE = {"detail": "Your account has no role yet. Ask the owner to give you access."}


def test_me_without_a_token_is_401(client):
    response = client.get("/api/me")

    assert response.status_code == 401
    assert response.json() == NOT_LOGGED_IN


def test_me_with_a_garbage_token_is_401(client):
    response = client.get("/api/me", headers={"Authorization": "Bearer not-a-real-token"})

    assert response.status_code == 401
    assert response.json() == INVALID_LOGIN


def test_me_with_an_authorization_header_that_is_not_bearer_is_401(client):
    response = client.get("/api/me", headers={"Authorization": "Basic c29tZW9uZTpwdw=="})

    assert response.status_code == 401
    assert response.json() == NOT_LOGGED_IN


def _forged_token(real_token: str, how: str) -> str:
    """A token with a real user's claims but not signed by the project."""
    claims = jwt.decode(real_token, options={"verify_signature": False})
    kid = jwt.get_unverified_header(real_token)["kid"]
    if how == "unsigned":
        return jwt.encode(claims, key=None, algorithm="none")
    if how == "hs256_with_a_guessed_secret":
        return jwt.encode(claims, "x" * 32, algorithm="HS256", headers={"kid": kid})
    if how == "es256_with_another_key":
        return jwt.encode(
            claims, ec.generate_private_key(ec.SECP256R1()), algorithm="ES256", headers={"kid": kid}
        )
    raise AssertionError(how)


@pytest.mark.parametrize(
    "how", ["unsigned", "hs256_with_a_guessed_secret", "es256_with_another_key"]
)
def test_me_with_a_forged_token_is_401(client, api_company, how):
    forged = _forged_token(api_company.users["admin"].token, how)

    response = client.get("/api/me", headers={"Authorization": f"Bearer {forged}"})

    assert response.status_code == 401
    assert response.json() == INVALID_LOGIN


@pytest.mark.parametrize("role", ["admin", "sales", "warehouse", "accountant"])
def test_me_as_each_role_returns_that_user_and_company(client_as, api_company, role):
    response = client_as(role).get("/api/me")

    assert response.status_code == 200
    assert response.json() == {
        "id": api_company.users[role].id,
        "email": f"{role}-{RUN_ID}@siambean.test",
        "full_name": f"Test {role.title()}",
        "role": role,
        "company": {"id": api_company.id, "name": f"TEST-{RUN_ID}"},
    }


def test_a_logged_in_user_with_no_users_row_is_403(client, login_without_role):
    response = client.get("/api/me", headers=login_without_role)

    assert response.status_code == 403
    assert response.json() == NO_ROLE
