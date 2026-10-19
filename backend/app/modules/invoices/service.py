"""Invoice logic: the summary query shared by the list and the receivables, the detail, the lookups.

Every query filters by the caller's company_id. Money stays `Decimal` until the response models
turn it into a string with 2 decimals. Balance = Total minus the sum of the Payments.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from fastapi import HTTPException

from app.modules.invoices.schemas import (
    CustomerOut,
    CustomerRef,
    InvoiceDetail,
    InvoiceFilter,
    InvoicePage,
    InvoiceSummary,
    LineOut,
    OrderRef,
    PaymentOut,
    ReceivablesPage,
)
from app.modules.sales_orders.service import like_pattern

ZERO = Decimal("0.00")

# "Today" is the Bangkok calendar day (the database server runs in UTC).
TODAY = "(now() at time zone 'Asia/Bangkok')::date"

# One row per Invoice with what it has been paid so far, who it was issued to and whether it is Overdue.
_SUMMARY_FROM = """
    from public.invoices i
    join public.customers c on c.id = i.customer_id
    left join (select invoice_id, sum(amount) as paid
                 from public.payments
                where company_id = %(company)s
                group by invoice_id) p on p.invoice_id = i.id
"""
_SUMMARY_COLUMNS = f"""
    i.id, i.number, i.invoice_date, i.due_date, i.total, i.status,
    c.id as customer_id, c.name as customer_name,
    coalesce(p.paid, 0) as paid,
    i.total - coalesce(p.paid, 0) as balance,
    (i.status = 'open' and i.due_date < {TODAY}) as overdue,
    case when i.status = 'open' and i.due_date < {TODAY} then {TODAY} - i.due_date else 0 end as days_overdue
"""

_FILTERS = {
    "open": "i.status = 'open'",
    "paid": "i.status = 'paid'",
    "overdue": f"i.status = 'open' and i.due_date < {TODAY}",
}


def _summary(row: dict[str, Any]) -> InvoiceSummary:
    return InvoiceSummary(
        id=row["id"],
        number=row["number"],
        invoice_date=row["invoice_date"],
        due_date=row["due_date"],
        customer=CustomerRef(id=row["customer_id"], name=row["customer_name"]),
        total=row["total"],
        paid=row["paid"],
        balance=row["balance"],
        status=row["status"],
        overdue=row["overdue"],
        days_overdue=row["days_overdue"],
    )


def search_page(
    conn,
    company_id: int,
    *,
    flt: InvoiceFilter | None,
    q: str | None,
    page: int,
    page_size: int,
    order_by: str,
) -> InvoicePage:
    """Invoices of this Company matching a filter and a search (`q`: Invoice number or Customer name)."""
    where = ["i.company_id = %(company)s"]
    params: dict[str, Any] = {"company": company_id}
    if flt:
        where.append(_FILTERS[flt])
    if q and q.strip():
        where.append("(i.number ilike %(like)s or c.name ilike %(like)s)")
        params["like"] = like_pattern(q.strip())
    clause = " and ".join(where)

    total = conn.execute(f"select count(*) as n {_SUMMARY_FROM} where {clause}", params).fetchone()["n"]
    rows = conn.execute(
        f"""
        select {_SUMMARY_COLUMNS}
        {_SUMMARY_FROM}
        where {clause}
        order by {order_by}
        limit %(limit)s offset %(offset)s
        """,
        {**params, "limit": page_size, "offset": (page - 1) * page_size},
    ).fetchall()
    return InvoicePage(items=[_summary(r) for r in rows], total=total, page=page, page_size=page_size)


def receivables(conn, company_id: int, *, q: str | None, page: int, page_size: int) -> ReceivablesPage:
    """Open Invoices, most overdue first (Due Date, then the older Invoice), plus the company-wide totals."""
    listing = search_page(
        conn, company_id, flt="open", q=q, page=page, page_size=page_size, order_by="i.due_date, i.id"
    )
    sums = conn.execute(
        f"""
        select coalesce(sum(s.balance), 0) as open_receivables,
               count(*) filter (where s.overdue) as overdue_count,
               coalesce(sum(s.balance) filter (where s.overdue), 0) as overdue_receivables
          from (select {_SUMMARY_COLUMNS}
                {_SUMMARY_FROM}
                where i.company_id = %(company)s and i.status = 'open') s
        """,
        {"company": company_id},
    ).fetchone()
    return ReceivablesPage(
        **listing.model_dump(),
        open_receivables=sums["open_receivables"],
        overdue_count=sums["overdue_count"],
        overdue_receivables=sums["overdue_receivables"],
    )


def lock_invoice(conn, company_id: int, invoice_id: int) -> dict[str, Any]:
    """Load one Invoice of this Company and lock its row until the request ends (404 if none)."""
    invoice = conn.execute(
        "select id, number, status from public.invoices where company_id = %s and id = %s for update",
        (company_id, invoice_id),
    ).fetchone()
    if invoice is None:
        raise HTTPException(404, "Invoice not found")
    return invoice


def fetch_detail(conn, company_id: int, invoice_id: int) -> InvoiceDetail:
    """The whole Invoice: Customer with Tax ID, lines, totals, Payments and Balance."""
    row = conn.execute(
        f"""
        select {_SUMMARY_COLUMNS},
               i.subtotal, i.vat, i.order_id, o.number as order_number,
               c.tax_id, c.address, c.payment_terms_days
        {_SUMMARY_FROM}
        join public.sales_orders o on o.id = i.order_id
        where i.company_id = %(company)s and i.id = %(invoice)s
        """,
        {"company": company_id, "invoice": invoice_id},
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Invoice not found")

    lines = conn.execute(
        """
        select l.id, p.sku, p.name, p.unit, l.quantity, l.unit_price, l.quantity * l.unit_price as amount
          from public.order_items l
          join public.products p on p.id = l.product_id
         where l.company_id = %s and l.order_id = %s
         order by l.id
        """,
        (company_id, row["order_id"]),
    ).fetchall()
    payments = conn.execute(
        """
        select p.id, p.amount, p.paid_on, p.method, p.note, p.created_at, u.full_name as recorded_by
          from public.payments p
          left join public.users u on u.id = p.created_by
         where p.company_id = %s and p.invoice_id = %s
         order by p.paid_on, p.id
        """,
        (company_id, invoice_id),
    ).fetchall()

    return InvoiceDetail(
        id=row["id"],
        number=row["number"],
        invoice_date=row["invoice_date"],
        due_date=row["due_date"],
        status=row["status"],
        overdue=row["overdue"],
        days_overdue=row["days_overdue"],
        customer=CustomerOut(
            id=row["customer_id"],
            name=row["customer_name"],
            tax_id=row["tax_id"],
            address=row["address"],
            payment_terms_days=row["payment_terms_days"],
        ),
        order=OrderRef(id=row["order_id"], number=row["order_number"]),
        lines=[LineOut(**line) for line in lines],
        subtotal=row["subtotal"],
        vat=row["vat"],
        total=row["total"],
        paid=row["paid"],
        balance=row["balance"],
        payments=[PaymentOut(**payment) for payment in payments],
    )
