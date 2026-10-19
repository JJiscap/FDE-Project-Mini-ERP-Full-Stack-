"""Who is calling, and may they? (ADR-0004)

Every data request carries `Authorization: Bearer <Supabase access token>`.
We verify the token's signature against the project's public keys (JWKS), then
load the User's Role and Company from `public.users`.

    - no token, a broken token or a forged one -> 401
    - a valid login with no `users` row         -> 403
    - a Role that is not allowed here           -> 403

Guard an endpoint with `require_roles`, which also hands you the caller:

    @router.get("/things")
    def list_things(user: Annotated[CurrentUser, Depends(require_roles("admin", "sales"))],
                    conn: Conn):
        ... filter every query by user.company_id ...
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError, PyJWTError

from app.core.config import get_settings
from app.core.db import Conn

NOT_LOGGED_IN = "You are not logged in. Please sign in and try again."
INVALID_LOGIN = "Your login is not valid or has expired. Please sign in again."
NO_ROLE = "Your account has no role yet. Ask the owner to give you access."

_bearer = HTTPBearer(auto_error=False)  # we answer with our own 401 message


@dataclass(frozen=True)
class CurrentUser:
    """The signed-in User: who they are, their Role and the Company all their data belongs to."""

    id: str
    email: str
    full_name: str
    role: str  # admin | sales | warehouse | accountant
    company_id: int
    company_name: str


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    # Keys are cached in memory; an unknown key id triggers one refetch (key rotation).
    return PyJWKClient(
        get_settings().supabase_jwks_url, cache_keys=True, cache_jwk_set=True, lifespan=600
    )


def verify_token(token: str) -> dict:
    """Check the token's signature, expiry, audience and issuer; return its claims."""
    settings = get_settings()
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience=settings.jwt_audience,
            issuer=f"{settings.supabase_url}/auth/v1",
            options={"require": ["exp", "sub"]},
        )
    except PyJWKClientConnectionError:
        raise HTTPException(503, "Cannot check your login right now. Please try again.") from None
    except PyJWTError:
        raise HTTPException(401, INVALID_LOGIN, headers={"WWW-Authenticate": "Bearer"}) from None


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    conn: Conn,
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(401, NOT_LOGGED_IN, headers={"WWW-Authenticate": "Bearer"})
    claims = verify_token(credentials.credentials)
    try:
        user_id = str(uuid.UUID(claims["sub"]))
    except ValueError:
        raise HTTPException(401, INVALID_LOGIN, headers={"WWW-Authenticate": "Bearer"}) from None

    row = conn.execute(
        """
        select u.id, u.email, u.full_name, u.role, u.company_id, c.name as company_name
          from public.users u
          join public.companies c on c.id = u.company_id
         where u.id = %s
        """,
        (user_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(403, NO_ROLE)
    return CurrentUser(
        id=str(row["id"]),
        email=row["email"],
        full_name=row["full_name"],
        role=row["role"],
        company_id=row["company_id"],
        company_name=row["company_name"],
    )


def require_roles(*roles: str):
    """Dependency that lets only the listed Roles through and returns the `CurrentUser`.

    `require_roles("admin", "sales")` -> 401 without a token, 403 for any other Role.
    List every allowed Role explicitly (the Admin is not added automatically).
    """
    allowed = frozenset(roles)

    def dependency(user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        if user.role not in allowed:
            raise HTTPException(403, f"Your role ({user.role}) is not allowed to do this.")
        return user

    return dependency
