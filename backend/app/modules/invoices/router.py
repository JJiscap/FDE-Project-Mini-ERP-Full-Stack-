"""invoices and payments, incl. the Accounting screen (tickets 10 and 12).

`router` (/invoices): GET /invoices, GET /invoices/{id}, GET /invoices/{id}/pdf,
POST /invoices/{id}/payments.
`accounting_router` (/accounting): GET /accounting/receivables.
Role matrix: see .scratch/mini-erp/spec.md. Guard with `require_roles(...)`.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/invoices", tags=["invoices"])
accounting_router = APIRouter(prefix="/accounting", tags=["accounting"])
