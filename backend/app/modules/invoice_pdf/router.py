"""GET /api/invoices/{id}/pdf: download an Invoice as a PDF (ticket 12, bonus).

Admin, Sales and Accountant may download it (the roles that view Invoices); Warehouse gets 403.
Reads straight from the database, filtered by the caller's Company, so an Invoice of
another Company is a plain 404. The numbers are the stored ones (Invoice subtotal/VAT/total,
the frozen unit price on each order line, the sum of Payments), never recomputed from the
current Product price.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response

from app.core.auth import CurrentUser, require_roles
from app.core.db import Conn
from app.modules.invoice_pdf.renderer import PdfInvoice, PdfLine, render_invoice_pdf

router = APIRouter(tags=["invoices"])

Viewer = Annotated[CurrentUser, Depends(require_roles("admin", "sales", "accountant"))]


@router.get(
    "/invoices/{invoice_id}/pdf",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def download_invoice_pdf(invoice_id: int, user: Viewer, conn: Conn) -> Response:
    row = conn.execute(
        """
        select i.id, i.number, i.order_id, i.invoice_date, i.due_date,
               i.subtotal, i.vat, i.total,
               co.name as company_name, co.tax_id as company_tax_id, co.address as company_address,
               cu.name as customer_name, cu.tax_id as customer_tax_id, cu.address as customer_address,
               (select coalesce(sum(p.amount), 0) from public.payments p
                 where p.invoice_id = i.id and p.company_id = i.company_id) as paid
          from public.invoices i
          join public.companies co on co.id = i.company_id
          join public.customers cu on cu.id = i.customer_id
         where i.id = %s and i.company_id = %s
        """,
        (invoice_id, user.company_id),
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Invoice not found.")

    lines = conn.execute(
        """
        select p.sku, p.name, p.unit, oi.quantity, oi.unit_price
          from public.order_items oi
          join public.products p on p.id = oi.product_id
         where oi.order_id = %s and oi.company_id = %s
         order by oi.id
        """,
        (row["order_id"], user.company_id),
    ).fetchall()

    pdf = render_invoice_pdf(
        PdfInvoice(
            number=row["number"],
            invoice_date=row["invoice_date"],
            due_date=row["due_date"],
            subtotal=row["subtotal"],
            vat=row["vat"],
            total=row["total"],
            paid=row["paid"],
            company_name=row["company_name"],
            company_tax_id=row["company_tax_id"],
            company_address=row["company_address"],
            customer_name=row["customer_name"],
            customer_tax_id=row["customer_tax_id"],
            customer_address=row["customer_address"],
            lines=[
                PdfLine(
                    sku=r["sku"],
                    name=r["name"],
                    quantity=r["quantity"],
                    unit=r["unit"],
                    unit_price=r["unit_price"],
                )
                for r in lines
            ],
        )
    )
    safe_number = "".join(c for c in row["number"] if c.isalnum() or c in "-_") or "invoice"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_number}.pdf"',
            "Cache-Control": "private, no-store",
        },
    )
