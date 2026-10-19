"""auth / me: who am I?"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.auth import CurrentUser, get_current_user

router = APIRouter(tags=["auth"])


class CompanyOut(BaseModel):
    id: int
    name: str


class MeOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: Literal["admin", "sales", "warehouse", "accountant"]
    company: CompanyOut


@router.get("/me")
def get_me(user: Annotated[CurrentUser, Depends(get_current_user)]) -> MeOut:
    """The caller's name, email, Role and Company. Any signed-in User with a Role may call it."""
    return MeOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        company=CompanyOut(id=user.company_id, name=user.company_name),
    )
