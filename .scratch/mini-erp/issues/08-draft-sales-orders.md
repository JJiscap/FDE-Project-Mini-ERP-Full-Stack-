# 08: Draft Sales Orders

**What to build:** Sales and the Admin create a Draft Sales Order for an active Customer, numbered `SO-0001` onward. They add, change and remove Order Lines by picking an active Product and a whole quantity. The Unit Price (and Unit Cost) is copied from the Product, read-only. The order shows line amounts, Subtotal, VAT 7% and Total. While Draft, the Customer and lines can change. A Draft can be Cancelled and keeps its number. There is a list of Sales Orders filterable by status. Covers rule 6.

**Blocked by:** 05, 06

**Status:** ready-for-agent

**Branch:** `feature/sales-orders` (shared with ticket 09)

- [ ] Creating a Draft for Café Lune → `SO-0001`. The next Draft is `SO-0002`, even if `SO-0001` was Cancelled.
- [ ] Adding 20 × ARB-1KG gives Unit Price 450.00, line amount 9,000.00, Subtotal 9,000.00, VAT 630.00 and Total 9,630.00.
- [ ] Changing the Product Price to 500 afterwards leaves the Draft's line at 450.00.
- [ ] Quantity 0 → refused with "Quantity must be greater than 0". A deactivated Product or Customer → refused.
- [ ] A Cancelled Draft can't be edited. Editing a non-Draft → `409`.
- [ ] Warehouse and Accountant → `403` on every Sales Order endpoint.
- [ ] Screens:
  - order list with an empty state
  - "New order" flow usable by Nok without training: Customer search box, Product picker showing On Hand, quantity, live totals
  - Draft detail with Cancel
  - works on a phone
