"""Draw an Invoice as a one-page A4 PDF (ticket 12). Pure: data in, bytes out; no database here.

Everything printed comes from the stored Invoice and its frozen order lines, never from
the current Product price. Uses fpdf2's built-in Helvetica, so no font files are needed
(small, and fine in a Vercel function). Helvetica only knows Latin-1: any other character
(for example Thai in an address) is printed as "?" instead of crashing the download.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from fpdf import FPDF, FontFace
from fpdf.enums import Align, XPos, YPos

_INK = (33, 37, 41)
_MUTED = (108, 117, 125)
_LINE = (206, 212, 218)
_HEAD_FILL = (241, 243, 245)


@dataclass(frozen=True)
class PdfLine:
    sku: str
    name: str
    quantity: int
    unit: str
    unit_price: Decimal


@dataclass(frozen=True)
class PdfInvoice:
    number: str
    invoice_date: date
    due_date: date
    subtotal: Decimal
    vat: Decimal
    total: Decimal
    paid: Decimal
    company_name: str
    company_tax_id: str | None
    company_address: str | None
    customer_name: str
    customer_tax_id: str | None
    customer_address: str | None
    lines: list[PdfLine] = field(default_factory=list)

    @property
    def balance(self) -> Decimal:
        return self.total - self.paid


def money(value: Decimal) -> str:
    """`Decimal("9630")` -> "9,630.00 THB"."""
    return f"{value:,.2f} THB"


def day(value: date) -> str:
    """`date(2026, 10, 2)` -> "2 Oct 2026"."""
    return f"{value.day} {value:%b} {value.year}"


def _safe(text: str | None) -> str:
    """Helvetica is Latin-1 only; replace what it cannot draw."""
    return (text or "").encode("latin-1", "replace").decode("latin-1")


def render_invoice_pdf(invoice: PdfInvoice) -> bytes:
    pdf = FPDF(orientation="portrait", unit="mm", format="A4")
    pdf.set_margins(15, 15, 15)
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_title(_safe(f"Invoice {invoice.number}"))
    pdf.set_creator("Siam Bean Mini ERP")
    pdf.add_page()
    width = pdf.epw  # usable width

    def text(size: float, *, bold: bool = False, color=_INK) -> None:
        pdf.set_font("Helvetica", "B" if bold else "", size)
        pdf.set_text_color(*color)

    def write(h: float, value: str, *, w: float = 0) -> None:
        pdf.multi_cell(w, h, _safe(value), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # ---- title block: Seller on the left, document number on the right
    top = pdf.get_y()
    text(18, bold=True)
    write(8, invoice.company_name, w=width * 0.6)
    text(9, color=_MUTED)
    if invoice.company_address:
        write(4.5, invoice.company_address, w=width * 0.6)
    if invoice.company_tax_id:
        write(4.5, f"Tax ID: {invoice.company_tax_id}", w=width * 0.6)
    left_bottom = pdf.get_y()

    right = 15 + width * 0.6
    pdf.set_xy(right, top)
    text(20, bold=True)
    pdf.cell(width * 0.4, 9, "INVOICE", align=Align.R, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    for label, value in (
        ("Invoice No.", invoice.number),
        ("Invoice date", day(invoice.invoice_date)),
        ("Due date", day(invoice.due_date)),
    ):
        pdf.set_x(right)
        text(10, color=_MUTED)
        pdf.cell(width * 0.18, 5.5, label)
        text(10, bold=True)
        pdf.cell(width * 0.22, 5.5, _safe(value), align=Align.R, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_y(max(left_bottom, pdf.get_y()) + 6)

    # ---- bill to
    text(8, bold=True, color=_MUTED)
    write(4.5, "BILL TO")
    text(12, bold=True)
    write(6, invoice.customer_name)
    text(9, color=_MUTED)
    if invoice.customer_address:
        write(4.5, invoice.customer_address)
    write(4.5, f"Tax ID: {invoice.customer_tax_id or '-'}")
    pdf.ln(6)

    # ---- lines
    pdf.set_draw_color(*_LINE)
    text(9)
    col_widths = (28, width - 28 - 24 - 32 - 34, 24, 32, 34)
    with pdf.table(
        col_widths=col_widths,
        text_align=("LEFT", "LEFT", "RIGHT", "RIGHT", "RIGHT"),
        line_height=6,
        padding=(1.5, 2),
        borders_layout="HORIZONTAL_LINES",
        headings_style=FontFace(emphasis="BOLD", fill_color=_HEAD_FILL),
    ) as table:
        head = table.row()
        for title in ("SKU", "Description", "Quantity", "Unit price", "Amount"):
            head.cell(title)
        for line in invoice.lines:
            row = table.row()
            row.cell(_safe(line.sku))
            row.cell(_safe(line.name))
            row.cell(f"{line.quantity:,} {_safe(line.unit)}")
            row.cell(money(line.unit_price))
            row.cell(money(line.unit_price * line.quantity))
    pdf.ln(5)

    # ---- totals, right-aligned
    label_w, value_w = 40, 42
    left = 15 + width - label_w - value_w

    def total_row(label: str, value: Decimal, *, bold: bool = False, size: float = 10) -> None:
        pdf.set_x(left)
        text(size, bold=bold, color=_INK if bold else _MUTED)
        pdf.cell(label_w, 6.5, label)
        text(size, bold=bold)
        pdf.cell(value_w, 6.5, money(value), align=Align.R, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    total_row("Subtotal", invoice.subtotal)
    total_row("VAT 7%", invoice.vat)
    pdf.line(left, pdf.get_y() + 0.5, left + label_w + value_w, pdf.get_y() + 0.5)
    pdf.ln(1.5)
    total_row("Total", invoice.total, bold=True, size=12)
    pdf.ln(1.5)
    total_row("Paid", invoice.paid)
    total_row("Balance", invoice.balance, bold=True)

    return bytes(pdf.output())
