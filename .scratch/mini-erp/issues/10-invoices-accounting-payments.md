# 10: Invoices, Accounting screen and Payments (US-4)

**What to build:**
- **Invoice list** (Sales, Accountant, Admin): number, date, Customer, Total, Balance, Open/Paid, and an Overdue badge.
- **Invoice detail**: Customer with Tax ID, lines, Subtotal, VAT 7%, Total, Due Date, Payments and Balance.
- **Accounting screen** (Accountant and Admin only): Open Invoices with Balances, Overdue first, and the Open Receivables total.
- **Record Payment** (amount defaulting to the Balance, date, method transfer/cash/cheque, note), through a DB function (`record_payment`) that locks the Invoice, refuses overpayment, and sets Paid when the Balance reaches 0.00.

**Blocked by:** 09

**Status:** ready-for-agent

**Branch:** `feature/invoices-payments`

- [ ] US-4: after confirming the US-1 order, `GET /api/accounting/receivables` shows 9,630.00. Recording a Payment of 9,630.00 on `INV-0001` makes it Paid with Balance 0.00, and receivables show 0.00.
- [ ] A partial Payment of 5,000.00 leaves it Open with Balance 4,630.00. A Payment of 4,631.00 next → refused with a message naming the Balance.
- [ ] A Payment on a Paid Invoice → `409`. Amount 0 or negative → refused.
- [ ] US-3: Sales `GET /api/accounting/receivables` → `403`, and `POST` a Payment → `403`. Admin → `200`. Warehouse → `403` on all Invoice endpoints.
- [ ] An Open Invoice whose Due Date is before today (Bangkok) is marked Overdue.
- [ ] Screens:
  - Invoice list and detail, Accounting screen, Payment dialog
  - Sales opening `/accounting` sees Access denied
  - money as `9,630.00 THB`, empty states
  - works on a phone
- [ ] Section 1 of `testing-manual.md` (steps 8–9) and the role rows for Accounting in section 3 are filled in.
