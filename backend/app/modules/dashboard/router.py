"""dashboard: live numbers for every Role (ticket 11).

    GET /dashboard   any Role   Sales Today, Low Stock count, Open Invoices, Stock Value

Everything is computed from the data on each request: no cache, no stored totals.
Every figure is filtered by the caller's company_id.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.auth import CurrentUser, get_current_user
from app.core.db import Conn
from app.core.money import Money

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

AnyRole = Annotated[CurrentUser, Depends(get_current_user)]


class OpenInvoices(BaseModel):
    count: int
    amount: Money  # Open Receivables: total minus payments, over Open Invoices


class DashboardOut(BaseModel):
    sales_today: Money  # Totals including VAT of Invoices dated today in Bangkok
    low_stock_count: int  # active Products with On Hand strictly below Reorder Level
    open_invoices: OpenInvoices
    stock_value: Money  # sum of On Hand x Cost over active Products
    as_of: date  # today in Asia/Bangkok


_SQL = """
    select
        (now() at time zone 'Asia/Bangkok')::date as as_of,
        (select coalesce(sum(i.total), 0) from public.invoices i
          where i.company_id = %(c)s
            and i.invoice_date = (now() at time zone 'Asia/Bangkok')::date) as sales_today,
        (select count(*) from public.stock_on_hand s
          where s.company_id = %(c)s and s.active and s.on_hand < s.reorder_level) as low_stock_count,
        (select coalesce(sum(s.on_hand * s.cost), 0) from public.stock_on_hand s
          where s.company_id = %(c)s and s.active) as stock_value,
        (select count(*) from public.invoices i
          where i.company_id = %(c)s and i.status = 'open') as open_count,
        (select coalesce(sum(i.total - coalesce(p.paid, 0)), 0)
           from public.invoices i
           left join (select invoice_id, sum(amount) as paid
                        from public.payments where company_id = %(c)s
                       group by invoice_id) p on p.invoice_id = i.id
          where i.company_id = %(c)s and i.status = 'open') as open_amount
"""


@router.get("")
def get_dashboard(user: AnyRole, conn: Conn) -> DashboardOut:
    """The four Dashboard numbers for the caller's Company, as of this moment."""
    row = conn.execute(_SQL, {"c": user.company_id}).fetchone()
    return DashboardOut(
        sales_today=row["sales_today"],
        low_stock_count=row["low_stock_count"],
        open_invoices=OpenInvoices(count=row["open_count"], amount=row["open_amount"]),
        stock_value=row["stock_value"],
        as_of=row["as_of"],
    )
