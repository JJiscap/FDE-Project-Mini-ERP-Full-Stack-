# Testing manual

How to test the Mini ERP by hand and what success looks like. Feature agents fill in their sections as features land. A section marked _(pending)_ isn't built yet.

## 0. Setup

- **Production URL:** _(added after the first deploy)_
- **Demo accounts:** _(added by the seed ticket)_

| Role | Person | Email | Password |
| --- | --- | --- | --- |
| Admin | Khun Somchai | | |
| Sales | Nok | | |
| Sales | Ploy | | |
| Warehouse | Lek | | |
| Accountant | Fon | | |

- **Fresh state:** reset the demo data first (`cd backend && uv run python -m scripts.reset_demo`). Every expected number below assumes a fresh reset.
- **Automated tests:** `cd backend && uv run pytest` must be all green.

## 1. Golden path: US-1 → US-4 → dashboard (the demo story)

| Step | Who | Do | Success looks like |
| --- | --- | --- | --- |
| 1 | Anyone | Open the dashboard | Low-stock count **1** (ROB-1KG: 35 < 40). Stock value **107,100.00 THB**. Sales today **0.00 THB**. Open invoices **0 · 0.00 THB** |
| 2 | Nok (Sales) | Products list | ARB-1KG on hand **170 kg**. ROB-1KG shows a **Low stock** badge |
| 3 | Nok (Sales) | New order for Café Lune: 20 × ARB-1KG | Unit price pre-filled **450.00 THB**. Line total **9,000.00 THB**. Order number **SO-0001** |
| 4 | Nok (Sales) | Confirm the order | Status **Confirmed**. Invoice **INV-0001** created |
| 5 | Nok (Sales) | Products list | ARB-1KG on hand **150 kg** |
| 6 | Nok (Sales) | Open INV-0001 | Subtotal **9,000.00 THB**, VAT 7% **630.00 THB**, total **9,630.00 THB**. Due date = invoice date + 30 days |
| 7 | Anyone | Dashboard | Sales today **9,630.00 THB**. Open invoices **1 · 9,630.00 THB**. Stock value **100,700.00 THB** |
| 8 | Fon (Accountant) | Accounting → INV-0001 → record payment 9,630.00 | Status **Paid**. Balance **0.00 THB** |
| 9 | Anyone | Dashboard | Open invoices **0 · 0.00 THB** (dropped by 9,630.00) |

The numbers must agree on every screen. Any screen that disagrees is a bug.

## 2. Business rules (bad input is rejected with a clear message)

| Try | Success looks like |
| --- | --- |
| Confirm an order for 200 × ARB-1KG (only 170 on hand) | Message **"Not enough stock for ARB-1KG"**. Stock, order status and invoice numbers are unchanged; the next successful invoice is still the next number |
| Product price −1 | "Price must be 0 or more" |
| Product with an existing SKU (ARB-1KG) | Message saying the SKU already exists |
| Customer without a tax ID | "Tax ID is required" |
| Order line quantity 0 | "Quantity must be greater than 0" |
| Stock-out larger than on hand | Rejected, and on hand unchanged |
| Change ARB-1KG price to 500, then reopen INV-0001 | INV-0001 still shows 450.00 and 9,630.00 |
| Deactivate a product or customer, then start a new order | It can't be picked. Old documents still show it |

## 3. Roles (US-3): walk the matrix as each user

_(Filled in by the auth ticket: per-role screen checklist and curl commands for the 403 checks.)_

### 3a. App shell (ticket 03: login, menu, Access denied)

Run `cd frontend && npm run dev`, open http://localhost:5173 (start the backend on :8000 for `/api/me`).

| Check | Do | Success looks like |
| --- | --- | --- |
| Login | Open `/products` logged out. Log in as Nok | You land back on **Products**. Header shows **Nok** and a **Sales** badge |
| Wrong password | Log in with a wrong password | Red box: "Email or password is incorrect. Check them and try again." Nothing else changes |
| Empty fields | Press **Log in** with both fields empty | "Enter your email" and "Enter your password" under the fields |
| Stay logged in | Reload the page | Still logged in |
| Logout | Press **Log out** (sidebar, or menu on a phone) | Back on the Login page. Back button does not show data |
| Menu per Role | Log in as each demo user | Admin: all 7. Sales: Dashboard, Products, Customers, Sales Orders, Invoices. Warehouse: Dashboard, Products, Stock. Accountant: Dashboard, Products, Customers, Invoices, Accounting |
| Access denied by URL | As Nok open `/accounting`; as Lek open `/customers` | "You do not have access to this page", names the Roles that may open it, **Back to Dashboard** link works |
| API 403 | As Nok call a forbidden API from any screen | Same Access denied page (not a blank screen or raw error) |
| Phone | DevTools device 375 px wide: Login, Dashboard, every menu item | No horizontal scroll. The menu button opens a drawer, tapping an item closes it |
| Unknown URL | Open `/nope` | "We could not find that page" with a link back |

## 4. Search (US-5)

_(pending: customers ticket)_

## 5. Low stock (US-2)

_(pending: products ticket)_

## 6. Bonus: PDF invoice

_(pending: PDF ticket)_

## 7. Non-functional checks

- [ ] Phone width: every screen usable, no horizontal scroll
- [ ] DevTools console: no errors on any screen
- [ ] Every empty list says so (e.g. "No invoices yet")
- [ ] Money always looks like `9,630.00 THB`
- [ ] No secrets in git: `git log -p | grep -iE "sb_secret|service_role|eyJhbGci"` prints nothing
- [ ] No secret key in the browser bundle: `cd frontend && npm run build && npm run check:bundle` prints "not in dist/" for every secret. (A plain `grep sb_secret frontend/dist` matches once: supabase-js's own key-prefix check, not a key.)

## 8. Demo rehearsal (7 minutes + 3 Q&A)

_(Filled in by the docs and polish ticket.)_
