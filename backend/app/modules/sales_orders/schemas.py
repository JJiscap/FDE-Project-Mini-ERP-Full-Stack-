"""Request and response shapes of the sales orders module."""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.core.money import Money

MAX_QUANTITY = 1_000_000
MAX_LINES = 100

OrderStatus = Literal["draft", "confirmed", "cancelled"]
# A whole number above 0 ("Quantity must be greater than 0" / "...a whole number").
Quantity = Annotated[int, Field(gt=0, le=MAX_QUANTITY)]


# ----------------------------------------------------------------- input


class LineIn(BaseModel):
    product_id: int
    quantity: Quantity


class OrderIn(BaseModel):
    customer_id: int
    lines: list[LineIn] = Field(default_factory=list, max_length=MAX_LINES)


class CustomerChange(BaseModel):
    customer_id: int


class QuantityChange(BaseModel):
    quantity: Quantity


# ---------------------------------------------------------------- output


class CustomerRef(BaseModel):
    id: int
    name: str


class CustomerOut(CustomerRef):
    tax_id: str
    payment_terms_days: int


class LineOut(BaseModel):
    id: int
    product_id: int
    sku: str
    name: str
    unit: str
    quantity: int
    unit_price: Money  # frozen when the line was added (rule 6)
    amount: Money  # quantity x unit_price
    on_hand: int  # for Sales to see; stock is only enforced at Confirm


class InvoiceRef(BaseModel):
    id: int
    number: str


class OrderDetail(BaseModel):
    id: int
    number: str
    order_date: date
    status: OrderStatus
    confirmed_at: datetime | None
    customer: CustomerOut
    lines: list[LineOut]
    subtotal: Money
    vat: Money
    total: Money
    invoice: InvoiceRef | None  # filled once the order is Confirmed (ticket 09)


class OrderSummary(BaseModel):
    id: int
    number: str
    order_date: date
    status: OrderStatus
    customer: CustomerRef
    line_count: int
    subtotal: Money
    vat: Money
    total: Money


class OrderPage(BaseModel):
    items: list[OrderSummary]
    total: int
    page: int
    page_size: int
