# Spec: Siam Bean Mini ERP

Status: ready-for-agent

## Problem Statement

Siam Bean Co. distributes roasted coffee beans to about 80 cafés in Bangkok with 5 staff. Orders arrive by LINE and phone, and Sales retype them into a spreadsheet. Stock lives in a second sheet that is always wrong. Invoices are written in Word and numbered by hand, and take the owner an hour each with mixed-up numbers. Nobody knows who still owes money, Sales sometimes promise beans that aren't there, and anyone can change anything. In the owner's words:

1. "Stock in the sheet is always wrong."
2. "Each invoice takes me an hour and the numbers get mixed up."
3. "I never know who still owes me money."
4. "Sales sometimes promise beans we don't have."
5. "Anyone can change anything in the spreadsheet."

## Solution

A small web ERP, deployed at a public URL, where every User logs in with a Role. Products, Customers, Stock Movements, Sales Orders, Invoices and Payments all live in one database:

- **Pain point 1:** Sales create a Sales Order for a Customer. Confirming it takes the beans out of stock, so stock can't drift.
- **Pain point 2:** Confirming also issues a numbered Invoice with 7% VAT in the same step, all or nothing. Nobody retypes or renumbers.
- **Pain point 4:** If any Product is short, the Confirm is refused with "Not enough stock for <SKU>" and nothing changes.
- **Inventory:** Warehouse records Stock-ins, Stock-outs and Adjustments. On Hand is always the sum of those movements, and Low Stock Products are flagged.
- **Pain point 3:** The Accountant records Payments against Invoices, so Open Receivables and Overdue Invoices are always known.
- **Dashboard:** every User sees live numbers: Sales Today, Low Stock count, Open Invoices and Stock Value.
- **Pain point 5:** every action is checked on the server against the User's Role.

## User Stories

Given stories (fixed, from `docs/scenario.md`; their acceptance criteria are the contract):

- **US-1 Sales Order → Invoice.** Given 170 kg of `ARB-1KG` On Hand, when Sales confirm an order for Café Lune of 20 kg at 450 THB, then On Hand shows 150 kg and `INV-0001` shows 9,000 + 630 VAT = 9,630 THB. Given a line quantity greater than On Hand, when they Confirm, then they see "Not enough stock for ARB-1KG" and nothing changes.
- **US-2 Low Stock.** Given a Product below its Reorder Level, when Warehouse open the product list, then it shows a Low Stock badge and the Dashboard Low Stock count includes it.
- **US-3 Roles.** A Sales User opening the Accounting screen sees an access-denied page, and the API returns `403`. A Warehouse User calling the Confirm API directly gets `403`. An Admin opening the same screens sees them load.
- **US-4 Payment.** Given Open Invoice `INV-0001` of 9,630 THB, when the Accountant records a full Payment, then its status becomes Paid and Open Receivables on the Dashboard drop by 9,630 THB.
- **US-5 Search.** Given 200 Customers, when Sales type part of a name, then the list filters within 1 second and shows at most 20 rows per page.

Detailed stories:

**Login and Roles**
1. As any User, I want to log in with my email and password, so that I can use the system from any browser.
2. As any User, I want to stay logged in when I reload the page, so that I don't retype my password all day.
3. As any User, I want to log out, so that the next person on a shared office computer can't act as me.
4. As any User, I want to see my name and Role in the app, so that I know which account I'm using.
5. As any User, I want the menu to show only the screens my Role can use, so that I'm not confused by options I can't use.
6. As any User, I want a clear "Access denied" page when I open a screen my Role can't use, so that I know it's a permission issue and not a bug.
7. As the owner, I want every API action checked against the User's Role on the server, so that a hidden button can't be bypassed (pain point 5).
8. As the owner, I want a person with a login but no Role to be refused everywhere, so that a stray sign-up can't see data.

**Products (master data)**
9. As any User, I want a Product list showing SKU, name, Unit, Price, On Hand and a Low Stock badge, so that I know what we sell and what we have.
10. As the Admin, I want to create a Product with SKU, name, Unit, Price, Cost and Reorder Level, so that it can be sold.
11. As the Admin, I want a duplicate SKU refused with a clear message, so that each Product has one code.
12. As the Admin, I want a negative Price or Cost refused ("Price must be 0 or more"), so that bad data never enters.
13. As the Admin, I want to edit a Product's name, Price, Cost and Reorder Level, so that I can change prices when bean costs move.
14. As the Admin, I want a Price change to leave every existing Sales Order and Invoice unchanged, so that issued documents stay correct.
15. As the Admin, I want to deactivate (and reactivate) a Product instead of deleting it, so that old documents still show it.
16. As Sales, I want deactivated Products hidden from the order form, so that I can't sell discontinued beans.
17. As Sales, Warehouse or the Accountant, I want the Product create, edit and deactivate actions refused by the server (`403`), so that only the owner controls prices.

**Customers (master data)**
18. As Sales, I want a Customer list with name, Tax ID, Payment Terms and status, so that I can find who I'm selling to.
19. As Sales, I want to search Customers by part of their name and see at most 20 per page, with results in under 1 second for 200 Customers (US-5).
20. As Sales, I want to create a Customer with name, Tax ID, Payment Terms (Cash or N days), address and phone, so that I can bill them.
21. As Sales, I want a missing Tax ID refused ("Tax ID is required"), so that every Invoice is a valid tax document.
22. As Sales, I want to edit a Customer, so that I can fix addresses and terms.
23. As Sales, I want to deactivate (and reactivate) a Customer, so that cafés that closed disappear from the order form but keep their history.
24. As the Accountant, I want to view Customers (read only), so that I can check who owes what.
25. As Warehouse, I want Customer endpoints refused (`403`), since I have no need for Customer data.
26. As any User, I want empty lists to say so ("No customers match 'xyz'"), so that I know the search worked.

**Stock**
27. As Warehouse, I want a Stock-in form (Product, quantity, optional note), so that arriving beans add to On Hand (`IN-0001`).
28. As Warehouse, I want a Stock-out form (Product, quantity, required reason), so that samples and write-offs reduce On Hand (`OUT-0001`).
29. As Warehouse, I want an Adjustment form (Product, signed quantity, required reason), so that I can correct On Hand after a count (`ADJ-0001`).
30. As Warehouse, I want any Stock-out or Adjustment that would make On Hand negative refused with a clear message, so that stock never goes below zero.
31. As Warehouse, I want a zero or non-whole quantity refused, so that every movement means something.
32. As Warehouse, I want a movement history per Product (date, type, Document Number, quantity, running balance, who), so that I can answer "why is the stock wrong?"
33. As Warehouse, I want the Products list to show Low Stock badges (On Hand strictly below Reorder Level), so that I reorder in time (US-2).
34. As Sales or the Accountant, I want the stock forms and movement history refused (`403`), so that only the warehouse moves stock.

**Sales Orders**
35. As Sales, I want to create a Draft Sales Order for an active Customer, numbered `SO-0001` onward, so that I record the café's request.
36. As Sales, I want to add Order Lines by choosing an active Product and a whole quantity, with the Unit Price copied from the Product and shown read-only, so that pricing is consistent.
37. As Sales, I want each line to show its amount, and the order to show Subtotal, VAT 7% and Total, so that I can tell the café the price.
38. As Sales, I want to see each Product's On Hand while adding lines, so that I don't promise beans we don't have (pain point 4).
39. As Sales, I want to change quantities, remove lines and change the Customer while the order is Draft, so that I can fix mistakes before confirming.
40. As Sales, I want a zero or negative quantity refused ("Quantity must be greater than 0").
41. As Sales, I want to Cancel a Draft, keeping its number, so that abandoned orders don't clutter the list and numbers are never reused.
42. As Sales, I want to Confirm a Draft so that, in one step, the stock goes out and Invoice `INV-000x` is issued (US-1).
43. As Sales, I want a Confirm with any short line refused with "Not enough stock for <SKU>", with no stock, status or number change (US-1).
44. As Sales, I want a Confirmed order to be read-only, with no edit or cancel, so that it always matches its Invoice.
45. As Sales, I want a list of Sales Orders with number, date, Customer, status and Total, filterable by status, so that I can find today's work.
46. As Warehouse or the Accountant, I want Sales Order endpoints refused (`403`), including calling Confirm directly (US-3).
47. As Sales, I want a Draft with no lines refused at Confirm ("Add at least one line"), so that empty Invoices are never issued.

**Invoices and Payments**
48. As Sales, the Accountant or the Admin, I want an Invoice list (number, date, Customer, Total, Balance, Open/Paid, Overdue badge), so that I can see what was billed.
49. As those Users, I want to open an Invoice and see the Customer with Tax ID, the lines, Subtotal, VAT 7%, Total, Due Date, Payments and Balance, so that it can be sent to the café.
50. As the Accountant, I want an Accounting screen listing Open Invoices with Balances, Overdue first, and the Open Receivables total, so that I know who owes us (pain point 3).
51. As the Accountant, I want to record a Payment (amount, date, method, note) against an Open Invoice, so that its Balance goes down (US-4).
52. As the Accountant, I want the Invoice to become Paid automatically when its Balance reaches 0.00 (US-4).
53. As the Accountant, I want a Payment larger than the Balance, zero or negative refused with a clear message, so that receivables never go wrong.
54. As the Accountant, I want a Payment on a Paid Invoice refused, so that it can't be paid twice.
55. As Sales, I want the Accounting screen and the Payment API refused (`403` and the Access denied page) (US-3).
56. As Warehouse, I want Invoice endpoints refused (`403`).
57. As any User who can view Invoices, I want to download an Invoice as a PDF with the company header, both Tax IDs, the lines, VAT and Total, so that I can send it to the café (bonus).

**Dashboard**
58. As any User, I want a Dashboard showing Sales Today (incl. VAT), Low Stock count, Open Invoices (count and amount) and Stock Value, all computed live from the data, so that the owner never has to ask anyone.
59. As any User, I want the Dashboard to change right after an order is Confirmed or a Payment recorded, so that the numbers agree on every screen.
60. As any User, I want to click the Low Stock tile to see which Products are low.

**Usability and deployment**
61. As Nok, I want to create and confirm an order without training: clear labels, sensible defaults and one obvious primary button.
62. As any User, I want money shown like `9,630.00 THB` everywhere.
63. As any User, I want error messages that say what to fix, never just "Error".
64. As any User, I want the app to work on my phone, with no horizontal scrolling.
65. As the course instructor, I want demo logins for every Role listed in the README.

## Implementation Decisions

**Architecture** (ADR-0004, ADR-0006)
- One Vercel project: the React/Vite SPA at `/`, FastAPI at `/api/*` on the same origin.
- The browser uses Supabase only to log in and keep the session (publishable key). Every data call goes to FastAPI with `Authorization: Bearer <access token>`.
- FastAPI verifies the token via the project JWKS, then loads `role` and `company_id` from the `users` table.
- Responses: `401` when there's no or an invalid token; `403` for the wrong Role or no `users` row.
- FastAPI talks to Postgres directly (psycopg3, transaction pooler) as the server role. RLS is on with no policies, and the browser key can read nothing.

**Modules** (each owns its API router, screens and tests)
- auth / me
- products
- customers
- stock
- sales orders
- invoices and payments (incl. accounting and PDF)
- dashboard

**Role matrix** (enforced per endpoint; ADR-0001)

| Action | Admin | Sales | Warehouse | Accountant |
|---|---|---|---|---|
| View Products (On Hand, Low Stock) | ✓ | ✓ | ✓ | ✓ |
| Create/edit/re-price/deactivate Products | ✓ | 403 | 403 | 403 |
| View Customers | ✓ | ✓ | 403 | ✓ |
| Create/edit/deactivate Customers | ✓ | ✓ | 403 | 403 |
| Sales Orders: view, create, edit Draft, Cancel, Confirm | ✓ | ✓ | 403 | 403 |
| Stock-in / Stock-out / Adjustment, movement history | ✓ | 403 | ✓ | 403 |
| View Invoices, download PDF | ✓ | ✓ | 403 | ✓ |
| Accounting screen: receivables, record Payment | ✓ | 403 | 403 | ✓ |
| Dashboard | ✓ | ✓ | ✓ | ✓ |

**Schema** (every business table: `company_id` FK, `created_by` FK users, `created_at`, `updated_at`)
- `companies` (name, tax_id, address).
- `users` (id = auth user id, company_id, full_name, email, role ∈ admin|sales|warehouse|accountant).
- `customers`:
  - name, tax_id NOT NULL, payment_terms_days ≥ 0 (0 = Cash), address, phone, active.
  - Trigram index on name.
- `products`:
  - sku, name, unit ∈ kg|box, price ≥ 0, cost ≥ 0, reorder_level ≥ 0, active.
  - unique (company_id, sku).
- `stock_movements`:
  - product_id, quantity integer ≠ 0, movement_type ∈ opening|in|out|adjust|sale, ref_doc, reason.
  - A trigger refuses any insert that would make On Hand negative.
- `sales_orders`:
  - number, customer_id, status ∈ draft|confirmed|cancelled, order_date, confirmed_at.
  - unique (company_id, number).
- `order_items`: order_id, product_id, quantity > 0, unit_price ≥ 0, unit_cost ≥ 0.
- `invoices`:
  - number, order_id unique, customer_id, invoice_date, due_date, subtotal, vat, total, status ∈ open|paid.
  - unique (company_id, number).
- `payments`: invoice_id, amount > 0, paid_on, method ∈ transfer|cash|cheque, note.
- `doc_counters`: (company_id, doc_type) → last_value (ADR-0003).
- View `stock_on_hand` (security invoker): one row per product with on_hand = sum of movements.

**DB functions** (security invoker; execute revoked from public/anon/authenticated)
- `next_doc_number(company, doc_type)` → `'SO-0001'`.
- `confirm_sales_order(order, user)` (ADR-0002):
  - Locks the order and products.
  - Refuses with `Not enough stock for <SKU>` if any line is short, `Add at least one line` if empty, and refuses if the order isn't a Draft.
  - Writes the `sale` movements (ref_doc = INV number), the Invoice and the status, in one transaction.
- `record_payment(invoice, amount, …)`: locks the Invoice, refuses amount > Balance or a Paid Invoice, inserts the Payment, and sets Paid when Balance = 0.

**Money**
- VAT = round_half_up(Subtotal × 0.07, 2) on the whole invoice.
- Line amount = quantity × unit price.
- All money is `numeric(12,2)` / `Decimal`. The API sends money as strings with 2 decimals.

**Dates**
- Business dates (invoice_date, "today") use `Asia/Bangkok`.
- Due Date = invoice_date + payment_terms_days.
- An Invoice is Overdue when it's Open and its Due Date is before today.

**API contract** (JSON, all under `/api`)
- Errors are `{ "detail": "<human message>" }`. Validation errors are flattened into one readable message per field.
- Status codes:
  - `400`/`422`: bad input
  - `401`: not authenticated
  - `403`: wrong Role
  - `404`: not found in this Company
  - `409`: business rule conflict (stock, duplicate SKU, wrong status)
- Lists take `q`, `page` (1-based) and `page_size` (default and max 20). They return `{ items, total, page, page_size }`.
- Endpoints:
  - `GET /me`
  - `GET|POST /products`, `PATCH /products/{id}`
  - `GET|POST /customers`, `PATCH /customers/{id}`
  - `POST /stock/movements`, `GET /stock/movements?product_id=`
  - `GET|POST /sales-orders`, `GET|PATCH /sales-orders/{id}` (Draft only: customer and lines), `POST /sales-orders/{id}/confirm`, `POST /sales-orders/{id}/cancel`
  - `GET /invoices`, `GET /invoices/{id}`, `GET /invoices/{id}/pdf`
  - `GET /accounting/receivables`, `POST /invoices/{id}/payments`
  - `GET /dashboard`
- Deactivation is `PATCH { active: false }`. There is no `DELETE` endpoint for master data or documents.

**Demo data** (seed and `reset_demo`)
- Company "Siam Bean Co.".
- 5 Users: Somchai (admin), Nok and Ploy (sales), Lek (warehouse), Fon (accountant), on the `@siambean.test` domain with a shared demo password.
- The 4 sample Products with their Opening Stock as `opening` movements.
- The 3 sample Customers plus 197 generated fictional cafés (for US-5).
- `reset_demo` deletes Siam Bean's documents, movements and counters, and restores this state. Afterwards Café Lune's demo order becomes `SO-0001` / `INV-0001`.

## Testing Decisions

- **Seam:** the HTTP API, through FastAPI `TestClient`, with real Supabase JWTs for each Role. This is the one public interface every acceptance criterion is observable through: status code, response body, and follow-up GETs. Tests don't query tables directly to assert, and they don't mock the database.
- **Isolation (ADR-0005):** each pytest session creates a `TEST-<runid>` Company with 4 Role Users and deletes everything at the end. Each test starts from a clean Company state with the 4 sample Products, Opening Stock and the 3 sample Customers. That's why US-1 can assert `INV-0001`.
- **What makes a good test:** it names the behaviour in glossary terms ("confirming a short order changes nothing"). Expected values come from the scenario (170 → 150; 9,000.00 / 630.00 / 9,630.00; Low Stock count 1 from ROB-1KG 35 < 40; Stock Value 107,100.00), never recomputed the way the code does it.
- **Red before green:** every ticket commits its failing tests first, then the implementation. Tests are never weakened to pass.
- **Per module:** every endpoint gets an allowed-Role test and a refused-Role (`403`) test. US-1..US-5 acceptance criteria get one test each, at minimum.
- **Frontend:** Vitest only for pure helpers (money formatting). Screens are verified by hand and by the orchestrator in the browser, following `testing-manual.md`.
- **Prior art:** none, as this is a new repo. The first ticket establishes the fixtures (`conftest`) every later ticket reuses.

## Out of Scope

- Quotations, delivery notes, and returns or credit notes.
- Cancelling a Confirmed Sales Order.
- Purchasing (PO, goods receipt), Suppliers screens, multiple warehouses and multiple Companies in the UI. The schema still carries `company_id` everywhere.
- HR and payroll, withholding tax, LINE integration, email notifications.
- Self sign-up and invitation emails. Demo Users are created by the seed. An Admin user-management screen is optional and only if time allows.
- Editing Unit Prices on Order Lines, and discounts.
- Reserved vs available stock. Stock is taken at Confirm.

## Further Notes

- **Bonus chosen:** PDF Invoice. It counts only if every minimum requirement works live and it's in the README.
- **Demo:** 10 minutes on the deployed URL, run `reset_demo` beforehand. US-1 is shown end to end as Nok (Sales) and Fon (Accountant), plus Warehouse getting `403` on Confirm.
- **README must contain:** the URL, setup, schema and ER diagram matching the real tables, the demo accounts, US-1..US-5 done or not done, and the bonus.
