"""invoices and payments, incl. the Accounting screen (ticket 10; the PDF is ticket 12).

    GET  /invoices                    list (status open|paid|overdue, q, page, page_size), newest first
    GET  /invoices/{id}               detail: Customer with Tax ID, lines, totals, Payments, Balance, order link
    POST /invoices/{id}/payments      record a Payment {amount, method, paid_on?, note?} -> 201 + the Invoice
    GET  /accounting/receivables      Open Invoices with Balances, most overdue first, and Open Receivables

Role matrix (spec): Admin, Sales and Accountant view Invoices; Warehouse gets 403 on every one.
The Accounting screen (receivables, record a Payment) is Admin and Accountant only: Sales gets 403 (US-3).
Every query filters by the caller's company_id.

Recording a Payment is the DB function `record_payment` (ADR-0002 style): it locks the Invoice, refuses a
Payment above the Balance or on a Paid Invoice, inserts the Payment and sets the Invoice Paid when the
Balance reaches 0.00, all in one transaction. This module checks the Role and that the Invoice is this
Company's (404), calls it, and maps its refusals to 409 (the app's RaiseException handler).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.auth import CurrentUser, require_roles
from app.core.db import Conn
from app.modules.invoices import service
from app.modules.invoices.schemas import (
    InvoiceDetail,
    InvoiceFilter,
    InvoicePage,
    PaymentIn,
    ReceivablesPage,
)

router = APIRouter(prefix="/invoices", tags=["invoices"])
accounting_router = APIRouter(prefix="/accounting", tags=["accounting"])

InvoiceViewer = Annotated[CurrentUser, Depends(require_roles("admin", "sales", "accountant"))]
AccountingStaff = Annotated[CurrentUser, Depends(require_roles("admin", "accountant"))]

PAGE_SIZE = 20


@router.get("")
def list_invoices(
    user: InvoiceViewer,
    conn: Conn,
    status: InvoiceFilter | None = None,
    q: str | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=PAGE_SIZE)] = PAGE_SIZE,
) -> InvoicePage:
    """Invoices, newest first. `q` matches the Invoice number or the Customer's name.

    `status=overdue` means Open with the Due Date before today (Bangkok); Overdue is a label, not a status.
    """
    return service.search_page(
        conn, user.company_id, flt=status, q=q, page=page, page_size=page_size, order_by="i.id desc"
    )


@router.get("/{invoice_id}")
def get_invoice(invoice_id: int, user: InvoiceViewer, conn: Conn) -> InvoiceDetail:
    return service.fetch_detail(conn, user.company_id, invoice_id)


@router.post("/{invoice_id}/payments", status_code=201)
def record_payment(invoice_id: int, body: PaymentIn, user: AccountingStaff, conn: Conn) -> InvoiceDetail:
    """Record a Payment. Partial Payments are fine; the Invoice becomes Paid when its Balance reaches 0.00.

    422 for a bad amount, method, date or note. 409 `Payment is more than the balance of 4,630.00 THB`
    or `INV-0001 is already paid` (raised by the DB function, with nothing changed). 404 for an Invoice
    that is not in the caller's Company. The response is the whole updated Invoice.
    """
    service.lock_invoice(conn, user.company_id, invoice_id)  # 404
    conn.execute(
        "select public.record_payment(%s::bigint, %s::numeric, %s::date, %s::text, %s::text, %s::uuid)",
        (invoice_id, body.amount, body.paid_on, body.method, body.note, user.id),
    )
    return service.fetch_detail(conn, user.company_id, invoice_id)


@accounting_router.get("/receivables")
def get_receivables(
    user: AccountingStaff,
    conn: Conn,
    q: str | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=PAGE_SIZE)] = PAGE_SIZE,
) -> ReceivablesPage:
    """Open Invoices with their Balances, Overdue first (oldest Due Date first), 20 per page.

    `open_receivables`, `overdue_count` and `overdue_receivables` cover every Open Invoice of the Company,
    not just this page or this search.
    """
    return service.receivables(conn, user.company_id, q=q, page=page, page_size=page_size)
