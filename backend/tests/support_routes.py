"""Routes that exist only in the test suite (mounted at /api/_test by the `app` fixture).

They exercise the shared mechanisms every module relies on: the role guard,
validation messages, money serialisation, the transaction per request, and the
mapping of database errors. The production app never includes this router.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.auth import CurrentUser, require_roles
from app.core.db import Conn
from app.core.money import Money

router = APIRouter()

AdminUser = Annotated[CurrentUser, Depends(require_roles("admin"))]
AdminOrSales = Annotated[CurrentUser, Depends(require_roles("admin", "sales"))]


# ------------------------------------------------------------- role guard


@router.get("/admin-only")
def admin_only(user: AdminUser):
    return {"email": user.email, "role": user.role}


@router.get("/admin-or-sales")
def admin_or_sales(user: AdminOrSales):
    return {"email": user.email, "role": user.role}


# ------------------------------------------------------------- validation


class LineIn(BaseModel):
    quantity: int = Field(gt=0)


class ProductLikeIn(BaseModel):
    sku: str = Field(min_length=1)
    tax_id: str = Field(min_length=1)
    price: Annotated[Money, Field(ge=0)]
    quantity: int = Field(gt=0)
    unit: Literal["kg", "box"]
    lines: list[LineIn] = []


@router.post("/validate")
def validate(body: ProductLikeIn, user: AdminOrSales):
    return {"ok": True}


# ------------------------------------------------------------------ money


class AmountBody(BaseModel):
    amount: Money


@router.post("/money")
def echo_money(body: AmountBody, user: AdminUser) -> AmountBody:
    return body


@router.get("/money-rounding")
def money_rounding(user: AdminUser) -> AmountBody:
    # A value with more than 2 decimals, built without validation: 0.125 must show as 0.13.
    return AmountBody.model_construct(amount=Decimal("0.125"))


# ------------------------------------------- transaction and database errors


class StockMovesBody(BaseModel):
    sku: str
    quantities: list[int]


@router.post("/stock-moves")
def stock_moves(body: StockMovesBody, user: AdminUser, conn: Conn):
    """Apply several stock movements in ONE request: all of them or none."""
    product = conn.execute(
        "select id from public.products where company_id = %s and sku = %s",
        (user.company_id, body.sku),
    ).fetchone()
    for quantity in body.quantities:
        conn.execute(
            """
            insert into public.stock_movements
                (company_id, product_id, quantity, movement_type, reason, created_by)
            values (%s, %s, %s, %s, 'test', %s)
            """,
            (user.company_id, product["id"], quantity, "in" if quantity > 0 else "out", user.id),
        )
    return {"applied": len(body.quantities)}


@router.post("/duplicate-sku")
def duplicate_sku(user: AdminUser, conn: Conn):
    # ARB-1KG already exists in the clean test company.
    conn.execute(
        "insert into public.products (company_id, sku, name, unit, price, cost) "
        "values (%s, 'ARB-1KG', 'Duplicate', 'kg', 1, 1)",
        (user.company_id,),
    )
    return {"ok": True}


@router.get("/boom")
def boom(user: AdminUser):
    raise RuntimeError("a bug nobody planned for")
