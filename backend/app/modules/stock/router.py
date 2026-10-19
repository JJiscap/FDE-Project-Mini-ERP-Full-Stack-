"""stock: Stock-in, Stock-out, Adjustment and movement history (ticket 07).

Roles: Admin and Warehouse only (spec role matrix). Every query filters by the
caller's company. One request is one transaction (see `app.core.db`), so a
movement the database refuses ("Not enough stock for ARB-1KG") also rolls back
the document number taken for it.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import CurrentUser, require_roles
from app.core.db import Conn
from app.modules.stock.schemas import (
    HistoryPage,
    MovementIn,
    MovementOut,
    StockProduct,
)

router = APIRouter(prefix="/stock", tags=["stock"])

StockUser = Annotated[CurrentUser, Depends(require_roles("admin", "warehouse"))]

# movement_type -> Document Number prefix
_DOC_TYPE = {"in": "IN", "out": "OUT", "adjust": "ADJ"}
_REASON_REQUIRED = "Reason is required for a stock-out or adjustment"


def _stored_quantity(body: MovementIn) -> int:
    """Validate the entered quantity for its type and return the signed quantity to store."""
    if body.quantity == 0:
        raise HTTPException(422, "Quantity can't be 0")
    if body.movement_type != "adjust" and body.quantity < 0:
        raise HTTPException(422, "Quantity must be greater than 0")
    return -body.quantity if body.movement_type == "out" else body.quantity


def _find_product(conn, company_id: int, product_id: int) -> dict:
    product = conn.execute(
        "select id, sku, active from public.products where id = %s and company_id = %s",
        (product_id, company_id),
    ).fetchone()
    if product is None:
        raise HTTPException(404, "Product not found")
    return product


@router.get("/products")
def list_stock_products(user: StockUser, conn: Conn) -> list[StockProduct]:
    """Active Products with their On Hand, for the Product picker of the stock forms."""
    rows = conn.execute(
        """
        select product_id as id, sku, name, unit, on_hand::int as on_hand, reorder_level
          from public.stock_on_hand
         where company_id = %s and active
         order by sku
        """,
        (user.company_id,),
    ).fetchall()
    return [StockProduct(**r, low_stock=r["on_hand"] < r["reorder_level"]) for r in rows]


@router.post("/movements", status_code=201)
def record_movement(body: MovementIn, user: StockUser, conn: Conn) -> MovementOut:
    """Record a Stock-in, Stock-out or Adjustment and number it (IN-, OUT-, ADJ-)."""
    quantity = _stored_quantity(body)
    reason = (body.reason or "").strip() or None
    if body.movement_type != "in" and reason is None:
        raise HTTPException(422, _REASON_REQUIRED)

    product = _find_product(conn, user.company_id, body.product_id)
    if not product["active"]:
        raise HTTPException(
            409, f"{product['sku']} is deactivated. Reactivate it before moving stock."
        )

    ref_doc = conn.execute(
        "select public.next_doc_number(%s, %s) as number",
        (user.company_id, _DOC_TYPE[body.movement_type]),
    ).fetchone()["number"]
    # The no-negative-stock trigger may refuse this insert; the 409 handler then
    # rolls the whole request back, including the number taken above.
    movement = conn.execute(
        """
        insert into public.stock_movements
            (company_id, product_id, quantity, movement_type, ref_doc, reason, created_by)
        values (%s, %s, %s, %s, %s, %s, %s)
        returning id, product_id, created_at, movement_type, ref_doc, quantity, reason
        """,
        (user.company_id, product["id"], quantity, body.movement_type, ref_doc, reason, user.id),
    ).fetchone()
    on_hand = conn.execute(
        "select on_hand::int as on_hand from public.stock_on_hand where product_id = %s",
        (product["id"],),
    ).fetchone()["on_hand"]
    return MovementOut(**movement, on_hand=on_hand)


@router.get("/movements")
def movement_history(
    user: StockUser,
    conn: Conn,
    product_id: int,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=20)] = 20,
) -> HistoryPage:
    """One Product's movements, newest first, each with the running balance after it."""
    _find_product(conn, user.company_id, product_id)
    total = conn.execute(
        "select count(*) as n from public.stock_movements where product_id = %s and company_id = %s",
        (product_id, user.company_id),
    ).fetchone()["n"]
    # The window runs over the whole history before the page is cut out of it.
    rows = conn.execute(
        """
        select * from (
            select m.id, m.created_at, m.movement_type, m.ref_doc, m.quantity, m.reason,
                   (sum(m.quantity) over (order by m.created_at, m.id))::int as balance_after,
                   u.full_name as created_by_name
              from public.stock_movements m
              left join public.users u on u.id = m.created_by
             where m.product_id = %s and m.company_id = %s
        ) h
        order by h.created_at desc, h.id desc
        limit %s offset %s
        """,
        (product_id, user.company_id, page_size, (page - 1) * page_size),
    ).fetchall()
    return HistoryPage(items=rows, total=total, page=page, page_size=page_size)
