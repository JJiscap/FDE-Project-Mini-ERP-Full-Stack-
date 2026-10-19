# Testing manual

How to test the Mini ERP by hand and what success looks like. Feature agents fill in their sections as features land. A section marked _(pending)_ isn't built yet.

## 0. Setup

- **Production URL:** https://fde-project-mini-erp-full-stack.vercel.app. Every push to `main` redeploys it.
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
| 1 | Anyone | Open the dashboard | Low stock **1** (ROB-1KG: 35 < 40). Stock value **107,100.00 THB**. Sales today (incl. VAT) **0.00 THB**. Open invoices **0 invoices · 0.00 THB** |
| 2 | Nok (Sales) | Products list | ARB-1KG on hand **170 kg**. ROB-1KG shows a **Low stock** badge |
| 3 | Nok (Sales) | Sales Orders → **New order** → Customer `lune` → pick Café Lune; Products → ARB-1KG, quantity **20**, **Add to order** → **Save as Draft** | Unit price **450.00 THB per kg** (not editable). Line amount **9,000.00 THB**. Opens order **SO-0001**, status **Draft**. Totals: Subtotal 9,000.00, VAT 7% 630.00, Total **9,630.00 THB** |
| 4 | Nok (Sales) | On SO-0001 press the primary **Confirm order** button, read the dialog **"Confirm SO-0001?"** (it names Café Lune, "20 kg of ARB-1KG" and **Total 9,630.00 THB (incl. 7% VAT)**), then press **Confirm order** in the dialog | Toast "SO-0001 confirmed. Invoice INV-0001 issued.". Status badge **Confirmed**, a notice "Confirmed on ... This order is final and can't be changed", and a button **Open INV-0001** at the top. The lines have no edit controls and there is no Cancel order button |
| 5 | Nok (Sales) | Products list | ARB-1KG on hand **150 kg** |
| 6 | Nok (Sales) | On SO-0001 press **Open INV-0001** (address `/invoices/<id>`) | The Invoice screen opens: **INV-0001**, badge **Open**, Customer Café Lune with Tax ID **0105561000011**, line ARB-1KG 20 kg × 450.00 THB = 9,000.00 THB, Subtotal **9,000.00 THB**, VAT 7% **630.00 THB**, Total **9,630.00 THB**, Due date = Invoice date + 30 days, Balance **9,630.00 THB**, "No payments yet". Nok sees no **Record payment** button; the Sales Order is a link back to SO-0001 |
| 7 | Anyone | Dashboard | Sales today (incl. VAT) **9,630.00 THB**. Open invoices **1 invoice · 9,630.00 THB**. Stock value **100,700.00 THB** |
| 8 | Fon (Accountant) | Menu → **Accounting** → INV-0001 → **Record payment**; the dialog already shows Amount **9630.00**, today's date and Bank transfer; press **Record payment** | Dialog closes, toast "Payment of 9,630.00 THB recorded. INV-0001 is Paid.". Accounting: **No open invoices**, Open Receivables **0.00 THB**. Invoices → INV-0001: badge **Paid**, Balance **0.00 THB**, the Payment listed (date, Bank transfer, 9,630.00 THB, by Fon) |
| 9 | Anyone | Dashboard | Open invoices **0 invoices · 0.00 THB** (dropped by 9,630.00). Sales today is still **9,630.00 THB** |

The numbers must agree on every screen. Any screen that disagrees is a bug.

### 1a. Draft Sales Orders (ticket 08)

Step 3 of the golden path, in detail. Sign in as **Nok** (`nok@siambean.test`) after a fresh reset (`scripts.reset_demo`), so the first order is `SO-0001`. Confirming is section 1b: do not confirm anything while walking through 1a unless you reset again afterwards.

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

### 1b. Confirm order → stock out + Invoice (ticket 09)

Steps 3 to 6 of the golden path with the failure cases. **Reset the demo data first** (`cd backend && uv run python -m scripts.reset_demo`), so ARB-1KG is 170 kg and the first Invoice is `INV-0001`. Sign in as **Nok**. Do this in the order shown: step 2 must come before step 3.

| Step | Do | Success looks like |
| --- | --- | --- |
| 1 | New order for Café Lune, add **171** × ARB-1KG (the amber "Only 170 kg on hand" warning shows but doesn't block), **Save as Draft** (this is `SO-0001`). Press **Confirm order**, then **Confirm order** in the dialog | A red message **"Not enough stock for ARB-1KG"** inside the dialog, which stays open. Press **Go back**: the order is still **Draft** and still editable. Products list: ARB-1KG still **170 kg**. No Invoice was issued |
| 2 | Change the line quantity to **20**, tab out, press **Confirm order** and confirm in the dialog | Confirmed as in golden-path step 4. The Invoice is **INV-0001**, not INV-0002: the refused attempt used no number |
| 3 | Products list | ARB-1KG **150 kg** |
| 4 | Database check (Supabase SQL editor, read-only): `select number, subtotal, vat, total, invoice_date, due_date, status from invoices;` | One row: **INV-0001**, 9000.00, 630.00, **9630.00**, due_date = invoice_date + **30** days, status open. Invoice date is today's date in Bangkok |
| 5 | Stock → ARB-1KG history (as Lek or Somchai) | Top row **sale**, document **INV-0001**, **-20 kg**, balance **150 kg**, by Nok |
| 6 | Reload the confirmed order (`/sales-orders/<id>`) | Read-only: no quantity boxes, no Remove, no Change customer, no Cancel order, no Confirm order. The **Open INV-0001** button is there |
| 7 | In another tab (or with the API) try `POST /api/sales-orders/<id>/confirm` on it again | **409** `"SO-0001 is confirmed and can't be changed"`. No second Invoice, stock still 150 kg. Editing or cancelling it answers 409 the same way |
| 8 | New order for Brew Lab Ari with **no lines**, Save as Draft | The **Confirm order** button is disabled with the hint "Add at least one product to confirm.". Through the API: `POST .../confirm` answers **409** `"Add at least one line"` |
| 9 | Dashboard (any role) | Sales today **9,630.00 THB**, Open invoices **1 invoice · 9,630.00 THB**, Stock value **100,700.00 THB**, Low stock **1** (golden-path step 7) |
| 10 | Roles: Lek (Warehouse) and Fon (Accountant) cannot see Sales Orders in their menu. With their tokens `POST /api/sales-orders/<id>/confirm` | **403**. Stock and order status unchanged. Somchai (Admin) can Confirm too |
| 11 | Phone width (375 px) | Confirm order and Cancel order are full-width buttons; the confirmation dialog fits the screen; no sideways scroll |

Automated: `cd backend && uv run pytest -q tests/test_confirm_order.py` (the whole US-1 flow, short stock, roles, the DB function on its own, two people confirming at once) and `tests/test_dashboard.py::test_the_real_us1_flow_through_the_api_moves_all_four_dashboard_tiles`; frontend screen tests in `src/pages/sales-orders/screens.test.tsx` ("Confirm order (US-1)").

### 1c. Invoices, Accounting and Payments (ticket 10)

Steps 6 to 9 of the golden path with the failure cases. **Reset the demo data first** (`cd backend && uv run python -m scripts.reset_demo`), then as **Nok** create and confirm the 20 × ARB-1KG order for Café Lune (golden path steps 3-4), so `INV-0001` is Open for 9,630.00 THB. The steps run in the order shown.

| Step | Do | Success looks like |
| --- | --- | --- |
| 1 | As **Nok** (Sales): menu → **Invoices** | One row **INV-0001**, Café Lune, Total **9,630.00 THB**, Balance **9,630.00 THB**, badge **Open** (no Overdue badge). Filter buttons All / Open / Overdue / Paid and a search box. Search `lune` and `INV-0001` both find it; `zzz` shows **"No invoices match 'zzz'"** |
| 2 | Open **INV-0001** | As golden path step 6. Sales has **no** Record payment button and **no** Accounting item in the menu. Open `/accounting` by its address | **Access denied** page (US-3). Through the API (Sales token): `GET /api/accounting/receivables` and `POST /api/invoices/<id>/payments` both answer **403** |
| 3 | As **Fon** (Accountant): menu → **Accounting** | Cards: **Open Receivables 9,630.00 THB** (1 open invoice) and **Overdue 0.00 THB**. One row INV-0001 with Due date, Total, Balance and a **Record payment** button. Fon sees the Invoices menu item and can open the Invoice too |
| 4 | **Record payment** on INV-0001. Change the Amount to **5000**, pick **Cash**, note `Cash at the counter`, press **Record payment** | The line under the Amount first said "Balance after this payment: 4,630.00 THB." Toast "Payment of 5,000.00 THB recorded on INV-0001. Balance 4,630.00 THB.". Accounting: INV-0001 stays, Balance **4,630.00 THB**, Open Receivables **4,630.00 THB**. Dashboard: Open invoices **1 invoice · 4,630.00 THB** |
| 5 | **Record payment** again and type **4631** | The dialog shows **"Payment is more than the balance of 4,630.00 THB"** and sends nothing. Through the API the same amount answers **409** with the same message and the Balance stays 4,630.00 |
| 6 | Try **0**, **-5**, **abc**, **10.001** and an empty Amount | One short message each: "Amount must be greater than 0", "Amount must be a number", "Amount can have at most 2 decimal places", "Amount is required". Nothing is recorded |
| 7 | Type **4630** (or leave the default, which is the Balance) and press **Record payment** | "Balance after this payment: 0.00 THB. The Invoice will be marked Paid." Toast "Payment of 4,630.00 THB recorded. INV-0001 is Paid." Accounting: **No open invoices**, Open Receivables **0.00 THB** |
| 8 | Invoices → INV-0001 | Badge **Paid**, "Paid in full" notice, Balance **0.00 THB**, two Payments listed (5,000.00 Cash with the note, 4,630.00 Bank transfer) by Fon. No Record payment button. Invoice list: Balance **0.00 THB**, badge **Paid** |
| 9 | Through the API as Fon: `POST /api/invoices/<id>/payments` with `{"amount":"1.00","method":"cash"}` on the Paid Invoice | **409** `"INV-0001 is already paid"` and no new Payment |
| 10 | Dashboard (any role) | Open invoices **0 invoices · 0.00 THB**; Sales today still **9,630.00 THB** |
| 11 | Overdue: no screen can make an old Invoice, so the automated tests cover it. To see it by hand, after a reset and a fresh confirmed order, run in the Supabase SQL editor `update invoices set invoice_date = invoice_date - 45, due_date = due_date - 45;`, reload Accounting, then run `scripts.reset_demo` again | The Invoice shows an **Overdue** badge next to Open and "Overdue by 15 days" (30 days of terms, 45 days old). The Overdue card shows its Balance in red. One due **today** is not Overdue; a Paid one never is. With several Open Invoices the most overdue is first |
| 12 | Somchai (Admin): Accounting and Invoices both load; he can record a Payment too. Lek (Warehouse): no Invoices or Accounting menu items; `GET /api/invoices` and `GET /api/invoices/<id>` answer **403** | As listed |
| 13 | Phone width (375 px) as Fon | Accounting cards stack, each Invoice is a card with its own **Record payment** button, the dialog fits the screen (Bank transfer / Cash / Cheque are three big buttons), no sideways scroll. Invoice detail: lines and Payments are cards, Record payment is a full-width button |

Automated: `cd backend && uv run pytest -q tests/test_invoices.py tests/test_payments.py` (list, detail, Overdue, receivables, US-3 and US-4, partial and refused Payments, two people paying at once) and the frontend screen tests in `src/pages/invoices/` and `src/pages/accounting/`.

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
| Record a Payment of 4,631.00 on an Invoice with a Balance of 4,630.00 | **409** "Payment is more than the balance of 4,630.00 THB". The Balance does not change |
| Record a Payment of 0, a negative amount or text | **422** "Amount must be greater than 0" / "Amount must be a number". Nothing recorded |
| Record a Payment on a Paid Invoice | **409** "INV-0001 is already paid" |

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

Invoices and Payments (ticket 10), with `$TOKEN` of each person and `<id>` from `GET /api/invoices`:

| Try | Command | Success looks like |
| --- | --- | --- |
| Sales lists Invoices | `curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/api/invoices` | **200**, `{"items":[...],"total":1,"page":1,"page_size":20}` with `balance`, `status` and `overdue` per row |
| Warehouse lists Invoices | same, Lek's token | **403** `Your role (warehouse) is not allowed to do this.` (also on `/api/invoices/<id>`) |
| Sales opens the receivables (US-3) | `curl -i -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/api/accounting/receivables` | **403** |
| Accountant or Admin opens the receivables | same, Fon's or Somchai's token | **200**, `open_receivables` `"9630.00"` for the golden-path Invoice |
| Sales records a Payment (US-3) | `curl -i -X POST http://127.0.0.1:8000/api/invoices/<id>/payments -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"amount":"9630.00","method":"transfer"}'` | **403**, nothing recorded |
| Accountant records the full Payment (US-4) | same, Fon's token | **201** and the Invoice with `"status":"paid"`, `"balance":"0.00"` |

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

Prerequisite: INV-0001 exists (confirm the US-1 order first, see section 1). The **Download PDF** button sits on the Invoice detail page; the endpoint is `GET /api/invoices/{id}/pdf`.

| # | Who | Do | Expect |
|---|---|---|---|
| 1 | Nok (Sales) | Open Invoices, then INV-0001, tap **Download PDF** | The button shows "Preparing PDF…" for a moment, then the browser saves **INV-0001.pdf**. No error banner |
| 2 | Nok | Open the PDF | One A4 page, top to bottom: **Siam Bean Co.** with its address and `Tax ID: 0105560012345`; **INVOICE** with Invoice No. `INV-0001`, Invoice date (today, Bangkok) and Due date (30 days later); **BILL TO Café Lune** with its address and Tax ID; a table with `ARB-1KG`, `Arabica...`, `20 kg`, `450.00 THB`, `9,000.00 THB`; then **Subtotal 9,000.00 THB**, **VAT 7% 630.00 THB**, **Total 9,630.00 THB**, **Paid 0.00 THB**, **Balance 9,630.00 THB** |
| 3 | Fon (Accountant) | Record a payment of `3000` on INV-0001, then download the PDF again | **Paid 3,000.00 THB** and **Balance 6,630.00 THB**; Total is still 9,630.00 THB |
| 4 | Somchai (Admin) | Change ARB-1KG Price to `999` (Products), then download INV-0001.pdf again | The PDF is unchanged: the line still says `450.00 THB` and `9,000.00 THB`. Set the price back to `450` afterwards |
| 5 | Somchai, Nok, Fon | Download the PDF | Works for all three. Somchai, Nok and Fon get `200 application/pdf` |
| 6 | Lek (Warehouse) | Call `GET /api/invoices/{id}/pdf` with Lek's token (section 3.1) | `403`. The Warehouse never sees an Invoice screen, so there is no button |
| 7 | Anyone | Call it with no token | `401`. With an unknown id: `404 Invoice not found.` |
| 8 | Phone | DevTools 375 px (or a real phone), Invoice detail, tap **Download PDF** | The button is full width and easy to tap; the PDF downloads or opens in the viewer. No horizontal scroll |
| 9 | Nok | Turn the network off (DevTools offline), tap **Download PDF** | A red banner: "Cannot reach the server. Check your internet connection and try again." |

A name or address with Thai characters does not break the download: the PDF only has Latin letters, so those characters print as `?`.

## 7. Non-functional checks

- [ ] Phone width: every screen usable, no horizontal scroll
- [ ] DevTools console: no errors on any screen
- [ ] Every empty list says so (e.g. "No invoices yet")
- [ ] Money always looks like `9,630.00 THB`
- [ ] No secrets in git: `git log -p | grep -iE "sb_secret|service_role|eyJhbGci"` prints nothing
- [ ] No secret key in the browser bundle: `cd frontend && npm run build && npm run check:bundle` prints "not in dist/" for every secret. (A plain `grep sb_secret frontend/dist` matches once: supabase-js's own key-prefix check, not a key.)

### 7a. Dashboard (ticket 11)

Open `/` (the Dashboard) as any Role. The page says "Good morning/afternoon/evening, <your name>" with the Company name under it, and a small "Updated hh:mm:ss" line (Bangkok time) below the tiles.

| Tile | Clean company | After US-1 Confirm | After full Payment |
| --- | --- | --- | --- |
| **Sales today (incl. VAT)** | 0.00 THB | 9,630.00 THB | 9,630.00 THB (a Payment never changes Sales Today) |
| **Low stock** (click: `/products?low_stock=true`) | 1 | 1 | 1 |
| **Open invoices** (click: Accounting for Admin/Accountant, Invoices for Sales, no link for Warehouse) | 0 invoices · 0.00 THB | 1 invoice · 9,630.00 THB | 0 invoices · 0.00 THB |
| **Stock value** | 107,100.00 THB | 100,700.00 THB | 100,700.00 THB |

1. Warehouse records a Stock-in of 10 kg ROB-1KG: **Low stock** becomes **0** (45 >= 40) and **Stock value** becomes 109,300.00 THB.
2. Partial Payment of 5,000.00 THB on INV-0001: **Open invoices** shows **1 invoice · 4,630.00 THB**.
3. Two tabs: keep the Dashboard open in tab A, Confirm an order in tab B, go back to tab A. The numbers update when the tab regains focus, or within 30 seconds, with no reload.
4. Loading: throttle the network in DevTools and reload; each tile shows a grey skeleton, not a number. Stop the API: an error banner with the API's message and **Try again**.
5. Phone (DevTools 375 px): tiles in a 2 x 2 grid, no horizontal scroll. Desktop: 4 across.
6. Every Role (Somchai, Nok, Lek, Fon) can open the Dashboard. `GET /api/dashboard` without a token is `401`.

## 8. Demo rehearsal (7 minutes + 3 Q&A)

_(Filled in by the docs and polish ticket.)_
