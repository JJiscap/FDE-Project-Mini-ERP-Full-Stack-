# 08: Draft Sales Orders

**What to build:** Sales and the Admin create a Draft Sales Order for an active Customer, numbered `SO-0001` onward. They add, change and remove Order Lines by picking an active Product and a whole quantity. The Unit Price (and Unit Cost) is copied from the Product, read-only. The order shows line amounts, Subtotal, VAT 7% and Total. While Draft, the Customer and lines can change. A Draft can be Cancelled and keeps its number. There is a list of Sales Orders filterable by status. Covers rule 6.

**Blocked by:** 05, 06

**Status:** ready-for-agent

**Branch:** `feature/sales-orders` (shared with ticket 09)

- [x] Creating a Draft for Café Lune → `SO-0001`. The next Draft is `SO-0002`, even if `SO-0001` was Cancelled.
- [x] Adding 20 × ARB-1KG gives Unit Price 450.00, line amount 9,000.00, Subtotal 9,000.00, VAT 630.00 and Total 9,630.00.
- [x] Changing the Product Price to 500 afterwards leaves the Draft's line at 450.00.
- [x] Quantity 0 → refused with "Quantity must be greater than 0". A deactivated Product or Customer → refused.
- [x] A Cancelled Draft can't be edited. Editing a non-Draft → `409`.
- [x] Warehouse and Accountant → `403` on every Sales Order endpoint.
- [ ] Screens:
  - order list with an empty state
  - "New order" flow usable by Nok without training: Customer search box, Product picker showing On Hand, quantity, live totals
  - Draft detail with Cancel
  - works on a phone

## Progress notes

(Read by the ticket 09 agent. Updated after every commit.)

### Backend: DONE (commits `test(sales-orders) ... (red)`, `feat(sales-orders): ...`)

Files: `backend/app/modules/sales_orders/{router,service,schemas}.py`, `backend/app/core/money.py` (`vat_for`), tests in `backend/tests/test_sales_orders.py` (67 tests).

API (all under `/api`, Admin and Sales only, Warehouse/Accountant get 403 on every endpoint, everything filtered by `company_id`):

| Endpoint | Notes |
|---|---|
| `GET /sales-orders?status&q&page&page_size` | newest first (`o.id desc`), `page_size` max 20. `{items, total, page, page_size}`; item = `{id, number, order_date, status, customer:{id,name}, line_count, subtotal, vat, total}` |
| `POST /sales-orders` `{customer_id, lines?:[{product_id,quantity}]}` | 201 + detail. Customer must be active, else 409 `"<name> is deactivated"`; unknown/other-company Customer 404. Number from `next_doc_number(company,'SO')` in the same transaction (a refused request burns no number) |
| `GET /sales-orders/{id}` | detail (below); 404 `"Sales Order not found"` |
| `PATCH /sales-orders/{id}` `{customer_id}` | Draft only |
| `POST /sales-orders/{id}/lines` `{product_id, quantity}` | Draft only, returns 200 + detail. Copies Product `price`/`cost` to `unit_price`/`unit_cost` NOW. Same Product again: quantity is added to the existing line, price stays frozen (no duplicate line) |
| `PATCH /sales-orders/{id}/lines/{line_id}` `{quantity}` | sets the quantity (never re-copies the price) |
| `DELETE /sales-orders/{id}/lines/{line_id}` | 200 + detail |
| `POST /sales-orders/{id}/cancel` | Draft -> Cancelled, keeps number |

Detail shape: `{id, number, order_date, status, confirmed_at, customer:{id,name,tax_id,payment_terms_days}, lines:[{id,product_id,sku,name,unit,quantity,unit_price,amount,on_hand}], subtotal, vat, total, invoice: null | {id, number}}`. Money is a string with 2 decimals. Any edit/cancel on a non-Draft: 409 `"SO-0001 is confirmed and can't be changed"` (or `cancelled`). Quantity: whole number, > 0 (422 `"Quantity must be greater than 0"`), max 1,000,000. Deactivated Product 409 `"ARB-1KG is deactivated"`, unknown Product 404 `"Product not found"`.

Totals: line amount = quantity x unit_price; subtotal = sum; VAT = `app.core.money.vat_for(subtotal)` (7%, ROUND_HALF_UP, 2 dp); total = subtotal + VAT. Draft totals are computed on read, not stored. No stock check and no stock movement in this ticket (`on_hand` per line is shown only).

Gotchas:
- `order_items` has NO unique (order_id, product_id); the merge is done in `service.put_line`. Every line edit first runs `service.lock_draft` (`select ... for update` on the order row), which serialises concurrent edits and Confirm.
- `invoices.due_date >= invoice_date`, and `invoice_date` defaults to the Bangkok date: don't use `current_date` (the DB server is UTC) when arranging invoices in tests.
- Tests arrange Confirmed orders directly with `update sales_orders set status='confirmed'` (`_force_status` in the test file); one test also inserts an invoice row and checks `invoice: {id, number}`.

### Where ticket 09 plugs in (backend)
- Add `POST /sales-orders/{id}/confirm` in `router.py`: `service.lock_order(...)`, call the `confirm_sales_order` DB function (ADR-0002) with the order and `user.id`, return `service.fetch_detail(...)`. `fetch_detail` already reads `invoice` from the `invoices` table and `confirmed_at`, so no change is needed there.
- The DB function must compute VAT the same way as `vat_for` (`round(subtotal * 0.07, 2)`; Postgres `round` on numeric is half away from zero, which is half up for positive numbers). Add a test that the Invoice VAT equals the order detail VAT.
- `service.describe_unchangeable(order)` gives the "is confirmed and can't be changed" message; `service.totals(subtotal)` gives `(subtotal, vat, total)`.

### Next
- UI in `frontend/src/pages/sales-orders/` (list, new, detail), then `testing-manual.md` section 1a, then tick the UI checkbox and set Status done.
