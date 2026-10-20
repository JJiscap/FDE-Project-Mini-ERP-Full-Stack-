"""Supabase Auth admin API (create, update and delete users), for scripts.

The new-style secret key is not a JWT: it goes in the `apikey` header only.
It bypasses RLS, so this module must never be used from the browser and the
key must never be logged.
"""

from __future__ import annotations

import httpx

from app.core.config import ConfigError, get_settings

_TIMEOUT = 30.0


def _admin(method: str, path: str, **kwargs) -> httpx.Response:
    settings = get_settings()
    if not settings.supabase_secret_key:
        raise ConfigError("Environment variable SUPABASE_SECRET_KEY is not set. See README.md (Setup).")
    response = httpx.request(
        method,
        f"{settings.supabase_url}/auth/v1/admin{path}",
        headers={"apikey": settings.supabase_secret_key},
        timeout=_TIMEOUT,
        **kwargs,
    )
    response.raise_for_status()
    return response


def create_user(email: str, password: str, *, full_name: str | None = None) -> str:
    """Create a confirmed auth user (no confirmation email) and return its id."""
    body: dict = {"email": email, "password": password, "email_confirm": True}
    if full_name:
        body["user_metadata"] = {"full_name": full_name}
    return _admin("POST", "/users", json=body).json()["id"]


def set_password(user_id: str, password: str) -> None:
    """Set a user's password (used to make a re-run of the seed predictable)."""
    _admin("PUT", f"/users/{user_id}", json={"password": password, "email_confirm": True})
