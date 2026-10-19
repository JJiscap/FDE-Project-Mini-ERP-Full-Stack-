"""products: master data with On Hand and Low Stock (ticket 05).

    GET   /products          any Role   list (q, active, low_stock, page, page_size)
    GET   /products/{id}     any Role
    POST  /products          Admin only
    PATCH /products/{id}     Admin only (fields, and `active` to deactivate/reactivate)

On Hand comes from the `stock_on_hand` view (sum of stock movements); nobody types it.
Low Stock = active and On Hand strictly below the Reorder Level.
Products are deactivated, never deleted (rule 7), so there is no DELETE.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

import psycopg.errors
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, StringConstraints

from app.core.auth import CurrentUser, get_current_user, require_roles
from app.core.db import Conn
from app.core.money import Money

router = APIRouter(prefix="/products", tags=["products"])

Admin = Annotated[CurrentUser, Depends(require_roles("admin"))]
AnyRole = Annotated[CurrentUser, Depends(get_current_user)]

PAGE_SIZE = 20

Sku = Annotated[str, StringConstraints(strip_whitespace=True, to_upper=True, min_length=1, max_length=40)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Unit = Literal["kg", "box"]
NonNegativeMoney = Annotated[Money, Field(ge=0)]
ReorderLevel = Annotated[int, Field(ge=0, le=1_000_000)]


class ProductIn(BaseModel):
    sku: Sku
    name: Name
    unit: Unit
    price: NonNegativeMoney
    cost: NonNegativeMoney
    reorder_level: ReorderLevel = 0


class ProductPatch(BaseModel):
    """Only the fields that are sent change. An explicit null is refused like a wrong value."""

    sku: Sku = None  # type: ignore[assignment]
    name: Name = None  # type: ignore[assignment]
    unit: Unit = None  # type: ignore[assignment]
    price: NonNegativeMoney = None  # type: ignore[assignment]
    cost: NonNegativeMoney = None  # type: ignore[assignment]
    reorder_level: ReorderLevel = None  # type: ignore[assignment]
    active: bool = None  # type: ignore[assignment]


class ProductOut(BaseModel):
    id: int
    sku: str
    name: str
    unit: str
    price: Money
    cost: Money
    reorder_level: int
    active: bool
    on_hand: int
    low_stock: bool


class ProductPage(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    page_size: int


_SELECT = """
    select product_id as id, sku, name, unit, price, cost, reorder_level, active,
           on_hand::int as on_hand,
           (active and on_hand < reorder_level) as low_stock
    from public.stock_on_hand
"""


def _like(text: str) -> str:
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _fetch(conn, company_id: int, product_id: int) -> ProductOut:
    row = conn.execute(
        f"{_SELECT} where company_id = %s and product_id = %s", (company_id, product_id)
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Product not found")
    return ProductOut(**row)


def _sku_taken(sku: str) -> HTTPException:
    return HTTPException(409, f"SKU {sku} already exists")


@router.get("")
def list_products(
    user: AnyRole,
    conn: Conn,
    q: str | None = None,
    active: bool | None = None,
    low_stock: bool | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=PAGE_SIZE)] = PAGE_SIZE,
) -> ProductPage:
    """Products ordered by SKU, with On Hand and the Low Stock flag."""
    where = ["company_id = %s"]
    params: list[Any] = [user.company_id]
    if q and q.strip():
        where.append("(sku ilike %s or name ilike %s)")
        params += [_like(q.strip())] * 2
    if active is not None:
        where.append("active = %s")
        params.append(active)
    if low_stock is not None:
        where.append("(active and on_hand < reorder_level) = %s")
        params.append(low_stock)
    clause = " and ".join(where)

    total = conn.execute(
        f"select count(*) as n from public.stock_on_hand where {clause}", params
    ).fetchone()["n"]
    rows = conn.execute(
        f"{_SELECT} where {clause} order by sku limit %s offset %s",
        [*params, page_size, (page - 1) * page_size],
    ).fetchall()
    return ProductPage(
        items=[ProductOut(**r) for r in rows], total=total, page=page, page_size=page_size
    )


@router.get("/{product_id}")
def get_product(product_id: int, user: AnyRole, conn: Conn) -> ProductOut:
    return _fetch(conn, user.company_id, product_id)


@router.post("", status_code=201)
def create_product(body: ProductIn, user: Admin, conn: Conn) -> ProductOut:
    """Create a Product. It starts with On Hand 0: stock only comes from stock movements."""
    try:
        row = conn.execute(
            """
            insert into public.products
                (company_id, sku, name, unit, price, cost, reorder_level, created_by)
            values (%s, %s, %s, %s, %s, %s, %s, %s)
            returning id
            """,
            (
                user.company_id,
                body.sku,
                body.name,
                body.unit,
                body.price,
                body.cost,
                body.reorder_level,
                user.id,
            ),
        ).fetchone()
    except psycopg.errors.UniqueViolation:
        raise _sku_taken(body.sku) from None
    return _fetch(conn, user.company_id, row["id"])


@router.patch("/{product_id}")
def update_product(product_id: int, body: ProductPatch, user: Admin, conn: Conn) -> ProductOut:
    """Change the fields that are sent. `{"active": false}` deactivates, `true` reactivates."""
    _fetch(conn, user.company_id, product_id)  # 404 if it is not in this Company
    changes = body.model_dump(exclude_unset=True)
    if changes:
        # Column names come from the model's own field names, never from the request.
        assignments = ", ".join(f"{column} = %s" for column in changes)
        try:
            conn.execute(
                f"update public.products set {assignments} where company_id = %s and id = %s",
                [*changes.values(), user.company_id, product_id],
            )
        except psycopg.errors.UniqueViolation:
            raise _sku_taken(changes["sku"]) from None
    return _fetch(conn, user.company_id, product_id)
