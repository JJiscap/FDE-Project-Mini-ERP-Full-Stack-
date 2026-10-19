"""Sales order logic: lookups, the Draft-only rule, lines and totals.

Ticket 09 (Confirm) reuses these: `fetch_detail` for the response, `lock_order` to
load and lock the order, `describe_unchangeable` for the "can't be changed" message.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from fastapi import HTTPException

from app.core.auth import CurrentUser
from app.core.money import vat_for
from app.modules.sales_orders.schemas import (
    MAX_QUANTITY,
    CustomerOut,
    InvoiceRef,
    LineIn,
    LineOut,
    OrderDetail,
)

ZERO = Decimal("0.00")


def like_pattern(text: str) -> str:
    """`%text%` for ILIKE, with `%`, `_` and `\\` in the text taken literally."""
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def totals(subtotal: Decimal) -> tuple[Decimal, Decimal, Decimal]:
    """(subtotal, vat, total). The VAT rule lives in `app.core.money.vat_for`."""
    vat = vat_for(subtotal)
    return subtotal, vat, subtotal + vat


# ---------------------------------------------------------------- lookups


def lock_order(conn, company_id: int, order_id: int) -> dict[str, Any]:
    """Load one order of this Company and lock its row until the request ends (404 if none).

    The lock serialises two people editing the same Draft, and Confirm, so a line can't
    appear in the middle of a Confirm.
    """
    order = conn.execute(
        """
        select id, number, status, customer_id
        from public.sales_orders
        where company_id = %s and id = %s
        for update
        """,
        (company_id, order_id),
    ).fetchone()
    if order is None:
        raise HTTPException(404, "Sales Order not found")
    return order


def describe_unchangeable(order: dict[str, Any]) -> str:
    return f"{order['number']} is {order['status']} and can't be changed"


def lock_draft(conn, company_id: int, order_id: int) -> dict[str, Any]:
    """`lock_order`, then 409 unless the order is still a Draft."""
    order = lock_order(conn, company_id, order_id)
    if order["status"] != "draft":
        raise HTTPException(409, describe_unchangeable(order))
    return order


def active_customer(conn, company_id: int, customer_id: int) -> dict[str, Any]:
    customer = conn.execute(
        "select id, name, active from public.customers where company_id = %s and id = %s",
        (company_id, customer_id),
    ).fetchone()
    if customer is None:
        raise HTTPException(404, "Customer not found")
    if not customer["active"]:
        raise HTTPException(409, f"{customer['name']} is deactivated")
    return customer


def active_product(conn, company_id: int, product_id: int) -> dict[str, Any]:
    product = conn.execute(
        "select id, sku, price, cost, active from public.products where company_id = %s and id = %s",
        (company_id, product_id),
    ).fetchone()
    if product is None:
        raise HTTPException(404, "Product not found")
    if not product["active"]:
        raise HTTPException(409, f"{product['sku']} is deactivated")
    return product


# ------------------------------------------------------------------ lines


def merge_lines(lines: list[LineIn]) -> dict[int, int]:
    """{product_id: quantity}: one entry per Product, quantities added up, first-seen order."""
    merged: dict[int, int] = {}
    for line in lines:
        merged[line.product_id] = merged.get(line.product_id, 0) + line.quantity
    return merged


def put_line(conn, user: CurrentUser, order_id: int, product: dict[str, Any], quantity: int) -> None:
    """Add `quantity` of an (already checked) Product to a Draft.

    A new line copies the Product's current price and cost: that is the Unit Price,
    frozen from now on (rule 6). A Product already on the order gets its quantity
    increased and keeps the price it was added at, so there is never a duplicate line.
    The caller holds the order's lock.
    """
    existing = conn.execute(
        """
        select id, quantity from public.order_items
        where company_id = %s and order_id = %s and product_id = %s
        order by id limit 1
        """,
        (user.company_id, order_id, product["id"]),
    ).fetchone()
    if existing is None:
        _check_quantity(quantity)
        conn.execute(
            """
            insert into public.order_items
                (company_id, order_id, product_id, quantity, unit_price, unit_cost, created_by)
            values (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user.company_id,
                order_id,
                product["id"],
                quantity,
                product["price"],
                product["cost"],
                user.id,
            ),
        )
        return
    new_quantity = existing["quantity"] + quantity
    _check_quantity(new_quantity)
    conn.execute(
        "update public.order_items set quantity = %s where id = %s",
        (new_quantity, existing["id"]),
    )


def _check_quantity(quantity: int) -> None:
    if quantity > MAX_QUANTITY:
        raise HTTPException(422, f"Quantity must be {MAX_QUANTITY} or less")


def find_line(conn, company_id: int, order_id: int, line_id: int) -> dict[str, Any]:
    line = conn.execute(
        "select id from public.order_items where company_id = %s and order_id = %s and id = %s",
        (company_id, order_id, line_id),
    ).fetchone()
    if line is None:
        raise HTTPException(404, "Order line not found")
    return line


# ----------------------------------------------------------------- detail


def fetch_detail(conn, company_id: int, order_id: int) -> OrderDetail:
    """The full order: Customer, lines (with On Hand), computed totals and its Invoice, if any.

    Draft totals are computed from the lines, never stored.
    """
    order = conn.execute(
        """
        select o.id, o.number, o.order_date, o.status, o.confirmed_at,
               c.id as customer_id, c.name as customer_name, c.tax_id, c.payment_terms_days
        from public.sales_orders o
        join public.customers c on c.id = o.customer_id
        where o.company_id = %s and o.id = %s
        """,
        (company_id, order_id),
    ).fetchone()
    if order is None:
        raise HTTPException(404, "Sales Order not found")

    rows = conn.execute(
        """
        select i.id, i.product_id, p.sku, p.name, p.unit, i.quantity, i.unit_price,
               i.quantity * i.unit_price as amount,
               s.on_hand::int as on_hand
        from public.order_items i
        join public.products p on p.id = i.product_id
        join public.stock_on_hand s on s.product_id = i.product_id
        where i.company_id = %s and i.order_id = %s
        order by i.id
        """,
        (company_id, order_id),
    ).fetchall()
    lines = [LineOut(**row) for row in rows]
    subtotal, vat, total = totals(sum((line.amount for line in lines), ZERO))

    invoice = conn.execute(
        "select id, number from public.invoices where company_id = %s and order_id = %s",
        (company_id, order_id),
    ).fetchone()

    return OrderDetail(
        id=order["id"],
        number=order["number"],
        order_date=order["order_date"],
        status=order["status"],
        confirmed_at=order["confirmed_at"],
        customer=CustomerOut(
            id=order["customer_id"],
            name=order["customer_name"],
            tax_id=order["tax_id"],
            payment_terms_days=order["payment_terms_days"],
        ),
        lines=lines,
        subtotal=subtotal,
        vat=vat,
        total=total,
        invoice=InvoiceRef(**invoice) if invoice else None,
    )
