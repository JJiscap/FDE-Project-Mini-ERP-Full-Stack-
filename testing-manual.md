# Testing manual

How to test the Mini ERP by hand and what success looks like. Feature agents fill in their sections as features land. A section marked _(pending)_ isn't built yet.

## 0. Setup

- **Production URL:** _(added after the first deploy)_
- **Demo accounts:** created by `cd backend && uv run python -m scripts.seed` (safe to run again). They all share one demo password. The seed resets it to `SiamBean-Demo-2026`, or to the value of the `DEMO_PASSWORD` environment variable if set.

| Role | Person | Email | Password |
| --- | --- | --- | --- |
| Admin | Khun Somchai | `somchai@siambean.test` | `SiamBean-Demo-2026` |
| Sales | Nok | `nok@siambean.test` | `SiamBean-Demo-2026` |
| Sales | Ploy | `ploy@siambean.test` | `SiamBean-Demo-2026` |
| Warehouse | Lek | `lek@siambean.test` | `SiamBean-Demo-2026` |
| Accountant | Fon | `fon@siambean.test` | `SiamBean-Demo-2026` |

- **Demo data after the seed:** Siam Bean Co. has 4 products (ARB-1KG 170 kg, ROB-1KG 35 kg, BLD-1KG 90 kg, DRP-10 240 boxes), 200 customers (Café Lune, Brew Lab Ari and Sukhumvit Corner Café plus 197 generated cafés) and no orders yet.

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

### 3.1 Get a token

Every API call (except the docs page) needs `Authorization: Bearer <access token>`. Two ways to get a token:

**A. With curl** (works before the frontend exists). Run from the repo root, where `.env` lives. Nothing here is printed to the screen except the token you ask for:

```bash
set -a; source .env; set +a                    # loads SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY
TOKEN=$(curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "Content-Type: application/json" \
  -d '{"email":"nok@siambean.test","password":"SiamBean-Demo-2026"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
```

Change the email to log in as another person (table in section 0). If the variable stays empty, the email or password is wrong. The token lasts one hour.

**B. From the browser** (once the app is deployed or running locally): log in, open DevTools → Application → Local Storage → the `sb-…-auth-token` entry → copy the `access_token` value.

### 3.2 Call `/api/me`

Start the API locally with `cd backend && uv run fastapi dev app/main.py` (it listens on http://127.0.0.1:8000), or use the deployed URL instead.

| Try | Command | Success looks like |
| --- | --- | --- |
| No token | `curl -i http://127.0.0.1:8000/api/me` | **401** and `{"detail":"You are not logged in. Please sign in and try again."}` |
| Garbage token | `curl -i http://127.0.0.1:8000/api/me -H "Authorization: Bearer abc"` | **401** and `{"detail":"Your login is not valid or has expired. Please sign in again."}` |
| Real token | `curl -i http://127.0.0.1:8000/api/me -H "Authorization: Bearer $TOKEN"` | **200** and `{"id":"…","email":"nok@siambean.test","full_name":"Nok","role":"sales","company":{"id":…,"name":"Siam Bean Co."}}` |
| Login but no role | Create a user in the Supabase dashboard (Authentication → Users → Add user, auto-confirm) without a `users` row, log in as them, call `/api/me` | **403** and `{"detail":"Your account has no role yet. Ask the owner to give you access."}` |

The interactive API docs are at `/api/docs` (use **Authorize** and paste the token).

### 3.3 The Role matrix (walk it as each user)

Every row must hold on the server, not just in the menu. `403` means "wrong Role", `401` means "no or bad token". Each feature ticket adds its own curl lines here as it lands.

| Action | Admin | Sales | Warehouse | Accountant |
| --- | --- | --- | --- | --- |
| View products (on hand, low stock) | ✓ | ✓ | ✓ | ✓ |
| Create / edit / deactivate products | ✓ | 403 | 403 | 403 |
| View customers | ✓ | ✓ | 403 | ✓ |
| Create / edit / deactivate customers | ✓ | ✓ | 403 | 403 |
| Sales orders (view, create, edit Draft, cancel, confirm) | ✓ | ✓ | 403 | 403 |
| Stock-in / stock-out / adjustment, movement history | ✓ | 403 | ✓ | 403 |
| View invoices | ✓ | ✓ | 403 | ✓ |
| Accounting screen, record payment | ✓ | 403 | 403 | ✓ |
| Dashboard | ✓ | ✓ | ✓ | ✓ |

Error messages you should see in the API: `Your role (warehouse) is not allowed to do this.` for a wrong Role, and one plain sentence per wrong field for bad input (for example `Price must be 0 or more`).

### 3.4 Automated tests and cleanup

`cd backend && uv run pytest` creates a throwaway company `TEST-<runid>` with four users (one per Role), runs every test from a clean copy of the sample data, and deletes everything at the end. It never touches Siam Bean Co. After a crashed run you can check for leftovers in the Supabase SQL editor with `select id, name from public.companies where name like 'TEST-%';` (they are safe to delete).

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
