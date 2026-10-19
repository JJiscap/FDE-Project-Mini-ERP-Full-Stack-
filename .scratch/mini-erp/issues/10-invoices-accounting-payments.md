# 10: Invoices, Accounting screen and Payments (US-4)

**What to build:**
- **Invoice list** (Sales, Accountant, Admin): number, date, Customer, Total, Balance, Open/Paid, and an Overdue badge.
- **Invoice detail**: Customer with Tax ID, lines, Subtotal, VAT 7%, Total, Due Date, Payments and Balance.
- **Accounting screen** (Accountant and Admin only): Open Invoices with Balances, Overdue first, and the Open Receivables total.
- **Record Payment** (amount defaulting to the Balance, date, method transfer/cash/cheque, note), through a DB function (`record_payment`) that locks the Invoice, refuses overpayment, and sets Paid when the Balance reaches 0.00.

**Blocked by:** 09

**Status:** done on `feature/invoices-payments` (waiting for the orchestrator's merge and a browser check)

**Branch:** `feature/invoices-payments`

- [x] US-4: after confirming the US-1 order, `GET /api/accounting/receivables` shows 9,630.00. Recording a Payment of 9,630.00 on `INV-0001` makes it Paid with Balance 0.00, and receivables show 0.00.
- [x] A partial Payment of 5,000.00 leaves it Open with Balance 4,630.00. A Payment of 4,631.00 next → refused with a message naming the Balance.
- [x] A Payment on a Paid Invoice → `409`. Amount 0 or negative → refused.
- [x] US-3: Sales `GET /api/accounting/receivables` → `403`, and `POST` a Payment → `403`. Admin → `200`. Warehouse → `403` on all Invoice endpoints.
- [x] An Open Invoice whose Due Date is before today (Bangkok) is marked Overdue.
- [ ] Screens (built and covered by jsdom screen tests, typecheck and build; NOT yet clicked through in a real browser or checked by eye at 375 px: see `manual.md` step 15):
  - Invoice list and detail, Accounting screen, Payment dialog
  - Sales opening `/accounting` sees Access denied
  - money as `9,630.00 THB`, empty states
  - works on a phone
- [x] Section 1 of `testing-manual.md` (steps 8–9) and the role rows for Accounting in section 3 are filled in.


## Progress notes

(Written by the ticket 10 agent.)

### Done (branch `feature/invoices-payments`)
- Red `test(invoices): ... (red)`: `backend/tests/test_invoices.py` and `test_payments.py`, 64 tests, all failed against the stubs. Green: 64 passed.
- Migration `supabase/migrations/20261019193207_record_payment.sql` (applied via MCP with the same SQL). Security advisor: INFO (RLS without policies, by design) and the known leaked-password WARN only.
- API in `backend/app/modules/invoices/{router,schemas,service}.py`; `errors.py` explains a bad date ("Paid on must be a date like 2026-10-22").
- Red `test(invoices-ui): ... (red)` (4 test files), then the screens: `frontend/src/pages/invoices/*` (list, detail, helpers) and `frontend/src/pages/accounting/*` (receivables, `PaymentDialog`, `payment.ts`).
- Docs: `testing-manual.md` golden path steps 6, 8, 9, new section 1c, the Payment rows in sections 2 and 3.3; `manual.md` step 15.

### Decisions and gotchas
- `record_payment(p_invoice_id bigint, p_amount numeric, p_paid_on date, p_method text, p_note text, p_user_id uuid) returns bigint` (the Payment id). Company comes from `p_user_id`. It repeats the amount, method and note checks of the API for any other caller. Messages: `Payment is more than the balance of 4,630.00 THB`, `INV-0001 is already paid`, `Invoice not found`, `Amount must be greater than 0`.
- Overpayment and a Paid Invoice are **409** (business-rule conflicts, from the DB function via the RaiseException handler). A bad amount, method, date or note is **422** from pydantic (checked before the DB is touched). The router first locks the Invoice row (404 `Invoice not found` for another Company's id) and then calls the function, which locks it again: two people paying at once are serialised (tests: one 201 and one 409).
- `POST /api/invoices/{id}/payments` body `{amount, method, paid_on?, note?}` answers **201** with the whole Invoice (`InvoiceDetail`). `method` is required (`transfer|cash|cheque`). No rule about the payment date being in the future was invented.
- Balance = Total minus the sum of Payments (the honest definition). Overdue = Open and `due_date < today` in Bangkok (computed in SQL, `(now() at time zone 'Asia/Bangkok')::date`); due today is not Overdue. `GET /api/invoices?status=open|paid|overdue` ("overdue" is a filter, not a status).
- Receivables are ordered by Due Date, then Invoice id, which puts the most overdue first. `open_receivables`, `overdue_count` and `overdue_receivables` cover every Open Invoice of the Company even when `q` or paging is used; `total` counts the rows that match `q`.
- Tests that need an old Invoice insert it straight into the database with `tests.test_dashboard.insert_sale_state(days_ago=...)` because Confirm always dates an Invoice today.
- No new table. Nothing for `reset_demo` to delete beyond what it already deletes (`payments` is already in its list).
- UI: the Record payment dialog is one step (the submit button is the confirmation, and it shows the Balance after the payment). It is used from the Accounting row buttons and from the Invoice detail (Admin and Accountant, Open only). The Accounting rows are not whole-row links (they hold a button): the Invoice number is the link. No shared component, `permissions.ts` or dependency was changed.
- The agent could not log in, so nothing was clicked in a real browser.
