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

### 1a. Draft Sales Orders (ticket 08)

Step 3 of the golden path, in detail. Sign in as **Nok** (`nok@siambean.test`) after a fresh reset (`scripts.reset_demo`), so the first order is `SO-0001`. Confirm is ticket 09; until then an order stays Draft or becomes Cancelled.

| Step | Do | Success looks like |
| --- | --- | --- |
| 1 | Menu → **Sales Orders** | Empty list: **"No sales orders yet"** and a **New order** button. Filter buttons All / Draft / Confirmed / Cancelled and a search box |
| 2 | **New order** → in **1. Customer** type `lune` | Café Lune is listed with its Tax ID and Payment Terms. Click it: the box turns into a card with **Change customer** |
| 3 | In **2. Products** the list shows `ARB-1KG · Arabica, 1 kg bag · 450.00 THB · 170 kg on hand` (and the other active products). Click ARB-1KG, type **20**, **Add to order** | One line: `ARB-1KG`, **450.00 THB per kg**, quantity 20 kg, amount **9,000.00 THB**. Totals: Subtotal **9,000.00 THB**, VAT 7% **630.00 THB**, Total **9,630.00 THB**. The Unit Price is not editable |
| 4 | Add ARB-1KG again with quantity **5** | Still one line, quantity now **25** (no duplicate line) |
| 5 | Still on New order: change the line quantity to **200** and tab out | An amber warning **"Only 170 kg on hand"** shows on the line. It does not block anything (the server checks stock at Confirm). Set it back to **20** and the warning goes away |
| 6 | Try quantity **0**, then **1.5** | **"Quantity must be greater than 0"**, then **"Quantity must be a whole number"**. Nothing is added or changed |
| 7 | Click **Save as Draft** | Opens the order **SO-0001**, status **Draft**, today's date (Bangkok), Café Lune, the line and the same totals **9,630.00 THB**. Toast "SO-0001 saved as a Draft" |
| 8 | On SO-0001: change the quantity to **30**, tab out | Line amount **13,500.00 THB**, Subtotal 13,500.00, VAT **945.00**, Total **14,445.00 THB**. Unit price still **450.00 THB per kg** |
| 9 | **Change customer** → search `brew` → pick Brew Lab Ari | The card shows Brew Lab Ari; the lines and totals are unchanged |
| 10 | Under **Add a product** add 1 × ROB-1KG, then remove it with the bin button | The line appears (320.00 THB), then goes; totals return to 14,445.00 THB |
| 11 | As **Somchai (Admin)** open Products → ARB-1KG → set the price to **500.00**. Back as Nok, reopen SO-0001 | The line still shows **450.00 THB per kg** and Total **14,445.00 THB**. A **new** order picks up 500.00 |
| 12 | Menu → Sales Orders | SO-0001 is listed (Draft, Brew Lab Ari, 14,445.00 THB). Search `SO-0001` and `brew` both find it. **Draft** filter shows it; **Confirmed** shows "No confirmed sales orders" |
| 13 | On SO-0001 click **Cancel order** | A dialog "Cancel SO-0001?" says it keeps its number. Press **Keep order**: nothing changes. Click **Cancel order** again and, in the dialog, the red **Cancel order** button: status **Cancelled**, a grey notice, no edit controls |
| 14 | **New order** for any customer and save it | The number is **SO-0002**, not SO-0001 again |
| 15 | Open the cancelled SO-0001 by its address (`/sales-orders/<id>`) | Read-only. API check: `PATCH /api/sales-orders/<id>/lines/<line>` answers **409** `"SO-0001 is cancelled and can't be changed"` |
| 16 | Somchai: deactivate the customer Brew Lab Ari (Customers), then as Nok start a new order and search `brew` | It is not offered (only active customers). Through the API, `POST /api/sales-orders` with that customer answers **409** `"Brew Lab Ari is deactivated"` and no number is used. Same for a deactivated Product: `"ARB-1KG is deactivated"` |
| 17 | Phone width (375 px, or the browser's device mode) | No sideways scroll on the list (cards), New order and the order screen; buttons and inputs are easy to tap |
| 18 | Roles: sign in as **Lek (Warehouse)** and **Fon (Accountant)** | **Sales Orders** is not in their menu; opening `/sales-orders` directly shows **Access denied**. With their tokens every `/api/sales-orders...` call answers **403** |

Automated: `cd backend && uv run pytest -q tests/test_sales_orders.py` (67 tests) and `cd frontend && npm test` (screen tests in `src/pages/sales-orders/`).

## 2. Business rules (bad input is rejected with a clear message)

| Try | Success looks like |
| --- | --- |
| Confirm an order for 200 × ARB-1KG (only 170 on hand) | Message **"Not enough stock for ARB-1KG"**. Stock, order status and invoice numbers are unchanged; the next successful invoice is still the next number |
| Product price −1 | "Price must be 0 or more" |
| Product with an existing SKU (ARB-1KG) | Message saying the SKU already exists |
| Customer without a tax ID (New customer form, leave Tax ID empty or spaces) | "Tax ID is required". Nothing is saved. Same message from the API (`422`) |
| Customer with Payment Terms −1 (or `payment_terms_days: -1` in the API) | Refused: the form says "Payment Terms must be 0 or more whole days (0 means Cash)"; the API says "Payment terms days must be 0 or more" |
| Customer with the same Tax ID as another (a branch) | Accepted: Tax ID is not unique |
| Open a customer as Nok → **Deactivate customer** → confirm | Badge changes to **Inactive**. List filter **Active** hides it, **Inactive** and **All** show it. **Reactivate customer** brings it back. There is no delete anywhere |
| Order line quantity 0 | "Quantity must be greater than 0" |
| Stock-out larger than on hand | Rejected, and on hand unchanged |
| Change ARB-1KG price to 500, then reopen INV-0001 | INV-0001 still shows 450.00 and 9,630.00 |
| Deactivate a product or customer, then start a new order | It can't be picked. Old documents still show it |

### 2.1 Stock (ticket 07)

Log in as Lek (Warehouse) or Somchai (Admin) and open **Stock**. Start from a fresh reset. The Product picker reads like `ARB-1KG · Arabica, 1 kg bag · 170 kg`. Use ARB-1KG unless stated.

| Try | Success looks like |
| --- | --- |
| Stock-in tab: ARB-1KG, quantity 30, no note | Toast **"IN-0001 recorded: ARB-1KG now 200 kg"**. The picker now shows 200 kg. History's top row is **IN-0001, +30 kg, balance 200 kg**, by Lek |
| Stock-out tab: quantity 171, reason "too many" (On Hand 170) | Red message **"Not enough stock for ARB-1KG"** under the form. On Hand still 170 kg. The next Stock-out of 1 (reason "sample") is still **OUT-0001** (no number is burned) |
| Stock-out tab: quantity 5, reason empty | **"Reason is required for a stock-out or adjustment"**. Nothing is recorded |
| Adjustment tab: quantity -3, reason "damaged bags" | **"ADJ-0001 recorded: ARB-1KG now 167 kg"** (from 170). History row **ADJ-0001, -3 kg**, reason "damaged bags" |
| Adjustment tab: quantity -3, reason empty | **"Reason is required for a stock-out or adjustment"** |
| Any tab: quantity 0 | **"Quantity can't be 0"** |
| Any tab: quantity 2.5 | **"Quantity must be a whole number"** |
| Stock-in or Stock-out tab: quantity -5 | **"Quantity must be greater than 0"** (only an Adjustment can be negative) |
| Open the history of ARB-1KG after the rows above | Newest first. The oldest row is **Opening Stock, OPENING, +170 kg, balance 170 kg**. Each balance is the running total of the rows below it |
| Create 21 or more movements for one Product | History shows 20 rows and **Previous / Next** buttons (page 2 holds the rest) |
| Phone width (375px) | The form stacks above the history. History rows are cards. No sideways scroll |
| Log in as Nok (Sales) or Fon (Accountant) | No **Stock** menu entry. Opening `/stock` directly shows **Access denied**. `GET /api/stock/products`, `GET /api/stock/movements?product_id=1` and `POST /api/stock/movements` all return **403** |
| Deactivate a Product, then open Stock | It is missing from the picker. Posting a movement for it by API returns 409 "ROB-1KG is deactivated. Reactivate it before moving stock." |

After these steps, reset the demo data again before the golden path.

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

Needs the seeded Siam Bean data (200 customers). Log in as Nok (Sales) and open **Customers**.

| Step | Do | Success looks like |
| --- | --- | --- |
| 1 | Open Customers | The pager says **1–20 of 200** and the list shows 20 rows, ordered by name. Columns: Name, Tax ID, Payment Terms, Phone. **Next** goes to "21–40 of 200"; **Previous** is disabled on page 1 |
| 2 | Type `lune` in the search box | About 0.3 s after you stop typing the list shows **Café Lune** only ("1–1 of 1"), Tax ID 0105561000011, Payment Terms **30 days**. The old rows stay visible, slightly faded, until the new ones arrive. Well under 1 second |
| 3 | Type `LUNE`, then `afé` | Same match: search ignores upper/lower case and matches part of the name |
| 4 | Search `0105562000022` | **Brew Lab Ari** (Tax ID search), Payment Terms **Cash** |
| 5 | Search `xyz` | Empty state **No customers match 'xyz'** |
| 6 | Clear the search, set **Show** to **Inactive** | Empty state "No inactive customers" (nothing deactivated yet) |
| 7 | **New customer**: name `Café Test`, leave Tax ID empty → **Add customer** | Red text under Tax ID: **Tax ID is required**. Nothing is saved |
| 8 | Fill Tax ID `0105599999999`, Payment Terms `15` → **Add customer** | You land on the customer page: Payment Terms **15 days**. List shows it (search `Test`) |
| 9 | **Edit customer**: set Payment Terms to `0`, **Save customer** | Payment Terms shows **Cash** |
| 10 | **Deactivate customer** → confirm | Badge **Inactive**. In the list, **Active** hides it, **Inactive** shows it with an **Inactive** badge |
| 11 | Open Customers on a phone (or DevTools at 375 px) | Each customer is a card, no sideways scroll, search, filter and pager still work |
| 12 | Log in as Fon (Accountant), open Customers and a customer | List and details load, search works. No **New customer**, **Edit** or **Deactivate** buttons, and the page says it is read-only |
| 13 | Log in as Lek (Warehouse) | No Customers menu item. Opening `/customers` shows **Access denied** |
| 14 | API check (token from section 3.1): `curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:8000/api/customers?q=lune"` | `{"items":[{"id":…,"name":"Café Lune",…}],"total":1,"page":1,"page_size":20}`. `page_size=21` is refused with `422`; as Fon, `POST /api/customers` is `403` |

Reset the demo data afterwards (`uv run python -m scripts.reset_demo`) to remove `Café Test`.

## 5. Low stock (US-2)

| Step | Who | Do | Success looks like |
| --- | --- | --- | --- |
| 1 | Lek (Warehouse) | Open **Products** | 4 products. ARB-1KG **170 kg**, BLD-1KG **90 kg**, DRP-10 **240 box**, ROB-1KG **35 kg** with a **Low stock** badge. Prices like **450.00 THB**. No "New product" button and no Edit/Deactivate buttons |
| 2 | Lek | Click **Low stock only** (or open `/products?low_stock=true`, the Dashboard tile link) | Only ROB-1KG (35 < 40) |
| 3 | Lek | Type `arb` in search, then `DRIP`, then `xyz` | ARB-1KG, then DRP-10, then **No products match 'xyz'** |
| 4 | Somchai (Admin) | Click **New product**. SKU `new-1kg` (lower case), Name `New bean`, Unit kg, Price `500`, Cost `350`, Reorder level `20`. **Create product** | Toast "NEW-1KG created". The list shows **NEW-1KG** (upper case) with On Hand **0 kg** and a Low stock badge (0 < 20) |
| 5 | Somchai | New product again with SKU `ARB-1KG` | Under the SKU field: **SKU ARB-1KG already exists** |
| 6 | Somchai | New product with Price `-1` (or Cost `-1`) | Under the field: **Price must be 0 or more** / **Cost must be 0 or more** |
| 7 | Somchai | **Edit** ARB-1KG, set Price `500`, **Save product** | Toast, list shows **500.00 THB**. The SKU field is locked |
| 8 | Somchai | **Deactivate** NEW-1KG, then **Deactivate product** in the dialog | It leaves the default (Active) list. Choose **Inactive** in the filter: it is there with a **Deactivated** badge. **Reactivate** brings it back |
| 9 | Nok / Lek / Fon | Call `POST /api/products` or `PATCH /api/products/{id}` with their token (section 3.1) | `403` each time. `GET /api/products` is `200` for every Role |
| 10 | Phone | DevTools 375 px, Products as Somchai | Cards, no horizontal scroll, dialog scrolls and fits the screen |

Clean up afterwards: set ARB-1KG back to Price `450` and leave NEW-1KG deactivated (or run `reset_demo` and check the product list shows only the 4 sample products).

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
