"""Request and response shapes of the invoices module (Invoices, Payments, receivables)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

from app.core.money import Money

MAX_NOTE = 500

InvoiceStatus = Literal["open", "paid"]
# "overdue" is a filter, not a status: an Open Invoice whose Due Date has passed.
InvoiceFilter = Literal["open", "paid", "overdue"]
PaymentMethod = Literal["transfer", "cash", "cheque"]


# ----------------------------------------------------------------- input


class PaymentIn(BaseModel):
    amount: Annotated[Money, Field(gt=0)]  # "Amount must be greater than 0"
    method: PaymentMethod  # "Method must be transfer, cash or cheque"
    paid_on: date | None = None  # defaults to today in Bangkok
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=MAX_NOTE)] | None = None


# ---------------------------------------------------------------- output


class CustomerRef(BaseModel):
    id: int
    name: str


class CustomerOut(CustomerRef):
    tax_id: str
    address: str | None
    payment_terms_days: int


class OrderRef(BaseModel):
    id: int
    number: str


class InvoiceSummary(BaseModel):
    """One row of the Invoice list and of the receivables."""

    id: int
    number: str
    invoice_date: date
    due_date: date
    customer: CustomerRef
    total: Money
    paid: Money  # the sum of its Payments
    balance: Money  # total - paid
    status: InvoiceStatus
    overdue: bool  # Open and the Due Date is before today (Bangkok); a label, not a status
    days_overdue: int  # 0 unless overdue


class InvoicePage(BaseModel):
    items: list[InvoiceSummary]
    total: int  # how many Invoices match (not money)
    page: int
    page_size: int


class ReceivablesPage(InvoicePage):
    """Open Invoices, most overdue first. The three money/count totals cover ALL Open Invoices."""

    open_receivables: Money  # the sum of the Balances of every Open Invoice
    overdue_count: int
    overdue_receivables: Money  # the part of it that is Overdue


class LineOut(BaseModel):
    id: int
    sku: str
    name: str
    unit: str
    quantity: int
    unit_price: Money  # frozen on the Sales Order line (rule 6)
    amount: Money  # quantity x unit_price


class PaymentOut(BaseModel):
    id: int
    amount: Money
    paid_on: date
    method: PaymentMethod
    note: str | None
    recorded_by: str | None  # the User's name
    created_at: datetime


class InvoiceDetail(BaseModel):
    id: int
    number: str
    invoice_date: date
    due_date: date
    status: InvoiceStatus
    overdue: bool
    days_overdue: int
    customer: CustomerOut
    order: OrderRef  # the Sales Order it was issued from
    lines: list[LineOut]
    subtotal: Money
    vat: Money
    total: Money
    paid: Money
    balance: Money
    payments: list[PaymentOut]  # oldest first
