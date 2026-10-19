# 09: Confirm → stock out + Invoice in one transaction (US-1)

**What to build:** Confirming a Draft runs one DB function (`confirm_sales_order`, ADR-0002). In one transaction it:
1. checks every line has enough On Hand
2. writes one `sale` Stock Movement per line
3. takes the next `INV` number
4. writes the Invoice: Subtotal, VAT = round(Subtotal × 0.07, 2), Total, Invoice Date today in Bangkok, Due Date = date + the Customer's Payment Terms
5. sets the order to Confirmed

If any line is short, nothing changes and the API returns `409` "Not enough stock for <SKU>". Confirmed orders are read-only. Only Sales and the Admin may Confirm.

**Blocked by:** 07, 08

**Status:** done (pending merge by the orchestrator)

**Branch:** `feature/sales-orders`

- [x] US-1: with ARB-1KG at 170, confirming Café Lune's Draft of 20 × ARB-1KG at 450 → `200`.
  - On Hand is 150.
  - The response and `GET` of the Invoice show `INV-0001` with Subtotal 9,000.00, VAT 630.00 and Total 9,630.00.
  - The Due Date is invoice date + 30 days.
- [x] US-1: confirming a line of 171 × ARB-1KG → `409` "Not enough stock for ARB-1KG".
  - On Hand is still 170 and the order is still Draft.
  - No Invoice exists, and the next successful Confirm still gets `INV-0001`.
- [x] A Draft with no lines → `409` "Add at least one line". Confirming an already Confirmed or Cancelled order → `409`.
- [x] US-3: Warehouse calling the Confirm endpoint directly → `403`, and nothing changes. Accountant → `403`.
- [x] A Confirmed order can't be edited or cancelled (`409`).
- [x] Screen:
  - "Confirm order" primary button with a confirmation dialog showing the Total
  - on success, the screen shows the Invoice number with a link
  - on `409`, the API message is shown
  - Confirmed orders are read-only
  - (checked in jsdom screen tests and by reading the classes; not clicked in a real browser or at 375 px by eye: see `manual.md` 14)
- [ ] Section 1 of `testing-manual.md` (steps 3–6) is verified against the real screens. (Rewritten to match the screens as built, plus a new section 1b; NOT clicked through in a browser, because the agent cannot log in. Left open for the orchestrator: `manual.md` 14.)

## Progress notes

### Done (branch `feature/sales-orders`)
- Red commit `test(sales-orders): confirm order to invoice (red)`: `backend/tests/test_confirm_order.py` (new), two new tests in `backend/tests/test_dashboard.py` (the owed end-to-end US-1 dashboard test and a refused-confirm one), a `Confirm order (US-1)` block (6 tests) in `frontend/src/pages/sales-orders/screens.test.tsx`. Red: 44 backend failed, 5 frontend failed.
- Migration `supabase/migrations/20261019190250_confirm_sales_order.sql` (applied via MCP with the same SQL): `public.confirm_sales_order(p_order_id bigint, p_user_id uuid) returns bigint` (the Invoice id). Security advisor: INFO and the optional leaked-password WARN only.
- `POST /api/sales-orders/{id}/confirm` in `backend/app/modules/sales_orders/router.py`.
- UI in `frontend/src/pages/sales-orders/OrderActions.tsx`.
- Docs: `testing-manual.md` section 1 steps 3-6 and new 1b, `docs/er-diagram.md`, `manual.md` 14.

### Decisions and gotchas
- `ref_doc` of the `sale` movements is the **INV number** (the spec says so: "ref_doc = INV number"; the dashboard and schema tests already model it). The SO number is in the movement's `reason` ("Sales order SO-0001"). If the SO number is wanted instead, add a NEW migration that replaces the function (never edit the applied one) and change `test_confirm_order.py`.
- The function derives the Company from `p_user_id` (the users row) and only sees that Company's orders; an unknown user raises "User not found", another Company's order "Sales Order not found". The API checks first with `service.lock_draft` (404, and the "is confirmed and can't be changed" 409), then calls the function; the function repeats the Draft check for any other caller.
- Stock is checked per Product on the sum of its lines (the table allows two lines of one Product). The first short SKU by product id is named. The INV number is taken after the check.
- A Product or Customer deactivated after the line was added does not block Confirm (not in the scenario; not invented).
- Invoice endpoints belong to ticket 10: tests read `invoices` rows with SQL. The UI link `/invoices/<id>` opens the Invoices stub until then.
- The concurrency tests (same order twice; two orders for the same stock) run two TestClients in threads.
- One full-suite run failed with 340 errors "the connection is closed" (network timeouts to Supabase mid-run); the rerun was clean: 366 passed.
