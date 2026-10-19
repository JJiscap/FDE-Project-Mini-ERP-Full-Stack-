"""sales orders: Drafts, order lines and Cancel (ticket 08). Confirm is ticket 09.

    GET    /sales-orders                        list (status, q, page, page_size), newest first
    POST   /sales-orders                        create a Draft {customer_id, lines?}, numbered SO-0001...
    GET    /sales-orders/{id}                   detail with lines, totals and `invoice` (null until Confirmed)
    PATCH  /sales-orders/{id}                   {customer_id}  (Draft only)
    POST   /sales-orders/{id}/lines             {product_id, quantity}  (Draft only)
    PATCH  /sales-orders/{id}/lines/{line_id}   {quantity}  (Draft only)
    DELETE /sales-orders/{id}/lines/{line_id}   (Draft only)
    POST   /sales-orders/{id}/cancel            Draft -> Cancelled, keeps its number

Admin and Sales only; Warehouse and Accountant get 403 on every endpoint. Every query
filters by the caller's company_id. Orders are cancelled, never deleted (rule 7).
Every endpoint returns the detail shape, except the list.

Ticket 09 adds `POST /sales-orders/{id}/confirm` here: `service.lock_order`, call the
`confirm_sales_order` DB function (ADR-0002), return `service.fetch_detail`, which already
fills `invoice` from the invoices table. The stock check is NOT done here.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.core.auth import CurrentUser, require_roles
from app.core.db import Conn
from app.modules.sales_orders import service
from app.modules.sales_orders.schemas import (
    CustomerChange,
    CustomerRef,
    LineIn,
    OrderDetail,
    OrderIn,
    OrderPage,
    OrderStatus,
    OrderSummary,
    QuantityChange,
)

router = APIRouter(prefix="/sales-orders", tags=["sales orders"])

SalesStaff = Annotated[CurrentUser, Depends(require_roles("admin", "sales"))]

PAGE_SIZE = 20


@router.get("")
def list_orders(
    user: SalesStaff,
    conn: Conn,
    status: OrderStatus | None = None,
    q: str | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=PAGE_SIZE)] = PAGE_SIZE,
) -> OrderPage:
    """Sales Orders, newest first. `q` matches the order number or the Customer's name."""
    where = ["o.company_id = %s"]
    params: list[Any] = [user.company_id]
    if status:
        where.append("o.status = %s")
        params.append(status)
    if q and q.strip():
        where.append("(o.number ilike %s or c.name ilike %s)")
        params += [service.like_pattern(q.strip())] * 2
    clause = " and ".join(where)

    total = conn.execute(
        f"""
        select count(*) as n
        from public.sales_orders o join public.customers c on c.id = o.customer_id
        where {clause}
        """,
        params,
    ).fetchone()["n"]
    rows = conn.execute(
        f"""
        select o.id, o.number, o.order_date, o.status, c.id as customer_id, c.name as customer_name,
               count(i.id)::int as line_count,
               coalesce(sum(i.quantity * i.unit_price), 0) as subtotal
        from public.sales_orders o
        join public.customers c on c.id = o.customer_id
        left join public.order_items i on i.order_id = o.id
        where {clause}
        group by o.id, c.id
        order by o.id desc
        limit %s offset %s
        """,
        [*params, page_size, (page - 1) * page_size],
    ).fetchall()

    items = []
    for row in rows:
        subtotal, vat, total_amount = service.totals(row["subtotal"])
        items.append(
            OrderSummary(
                id=row["id"],
                number=row["number"],
                order_date=row["order_date"],
                status=row["status"],
                customer=CustomerRef(id=row["customer_id"], name=row["customer_name"]),
                line_count=row["line_count"],
                subtotal=subtotal,
                vat=vat,
                total=total_amount,
            )
        )
    return OrderPage(items=items, total=total, page=page, page_size=page_size)


@router.post("", status_code=201)
def create_order(body: OrderIn, user: SalesStaff, conn: Conn) -> OrderDetail:
    """Create a Draft for an active Customer, optionally with its first lines.

    The number is taken inside this request's transaction, so a refused request
    (deactivated Customer or Product...) rolls the counter back and leaves no gap.
    """
    service.active_customer(conn, user.company_id, body.customer_id)
    wanted = service.merge_lines(body.lines)
    products = {pid: service.active_product(conn, user.company_id, pid) for pid in wanted}

    number = conn.execute(
        "select public.next_doc_number(%s, 'SO') as number", (user.company_id,)
    ).fetchone()["number"]
    order_id = conn.execute(
        """
        insert into public.sales_orders (company_id, number, customer_id, created_by)
        values (%s, %s, %s, %s)
        returning id
        """,
        (user.company_id, number, body.customer_id, user.id),
    ).fetchone()["id"]
    for product_id, quantity in wanted.items():
        service.put_line(conn, user, order_id, products[product_id], quantity)
    return service.fetch_detail(conn, user.company_id, order_id)


@router.get("/{order_id}")
def get_order(order_id: int, user: SalesStaff, conn: Conn) -> OrderDetail:
    return service.fetch_detail(conn, user.company_id, order_id)


@router.patch("/{order_id}")
def change_customer(order_id: int, body: CustomerChange, user: SalesStaff, conn: Conn) -> OrderDetail:
    """Change the Customer of a Draft. The new Customer must be active."""
    service.lock_draft(conn, user.company_id, order_id)
    service.active_customer(conn, user.company_id, body.customer_id)
    conn.execute(
        "update public.sales_orders set customer_id = %s where company_id = %s and id = %s",
        (body.customer_id, user.company_id, order_id),
    )
    return service.fetch_detail(conn, user.company_id, order_id)


@router.post("/{order_id}/lines")
def add_line(order_id: int, body: LineIn, user: SalesStaff, conn: Conn) -> OrderDetail:
    """Add a Product to a Draft. The Product's current price and cost are copied onto the line.

    A Product already on the order adds to that line's quantity and keeps its frozen price.
    Stock is not checked here: Confirm does that.
    """
    service.lock_draft(conn, user.company_id, order_id)
    product = service.active_product(conn, user.company_id, body.product_id)
    service.put_line(conn, user, order_id, product, body.quantity)
    return service.fetch_detail(conn, user.company_id, order_id)


@router.patch("/{order_id}/lines/{line_id}")
def change_line(
    order_id: int, line_id: int, body: QuantityChange, user: SalesStaff, conn: Conn
) -> OrderDetail:
    """Set a line's quantity. The Unit Price is never re-copied from the Product."""
    service.lock_draft(conn, user.company_id, order_id)
    service.find_line(conn, user.company_id, order_id, line_id)
    conn.execute(
        "update public.order_items set quantity = %s where company_id = %s and id = %s",
        (body.quantity, user.company_id, line_id),
    )
    return service.fetch_detail(conn, user.company_id, order_id)


@router.delete("/{order_id}/lines/{line_id}")
def remove_line(order_id: int, line_id: int, user: SalesStaff, conn: Conn) -> OrderDetail:
    """Remove a line from a Draft (the order itself is never deleted)."""
    service.lock_draft(conn, user.company_id, order_id)
    service.find_line(conn, user.company_id, order_id, line_id)
    conn.execute(
        "delete from public.order_items where company_id = %s and id = %s",
        (user.company_id, line_id),
    )
    return service.fetch_detail(conn, user.company_id, order_id)


@router.post("/{order_id}/cancel")
def cancel_order(order_id: int, user: SalesStaff, conn: Conn) -> OrderDetail:
    """Draft -> Cancelled. The order keeps its number, which is never reused."""
    service.lock_draft(conn, user.company_id, order_id)
    conn.execute(
        "update public.sales_orders set status = 'cancelled' where company_id = %s and id = %s",
        (user.company_id, order_id),
    )
    return service.fetch_detail(conn, user.company_id, order_id)
