# Siam Bean Co. Mini ERP

A small web ERP for a Bangkok coffee-bean distributor: products, customers, stock, sales orders, invoices with 7% VAT, payments and a live dashboard, with a Role for every user. Course project CU FDE3 (demo Thu 22 Oct 2026).

**Live URL: https://fde-project-mini-erp-full-stack.vercel.app**

## The problem

Siam Bean Co. imports and roasts coffee beans and sells 1 kg bags to about 80 cafés in Bangkok. It has 5 staff, one office and one warehouse. Orders arrive by LINE and phone, Sales retype them into a spreadsheet, stock lives in another sheet, and invoices are written in Word and numbered by hand. The owner's pain points, in his words:

1. "Stock in the sheet is always wrong."
2. "Each invoice takes me an hour and the numbers get mixed up."
3. "I never know who still owes me money."
4. "Sales sometimes promise beans we don't have."
5. "Anyone can change anything in the spreadsheet."

The full brief is in [`docs/scenario.md`](docs/scenario.md). It wins over every other note.

## What the system does

| Pain point | How the system answers it |
| --- | --- |
| 1. Wrong stock | Stock on hand is never typed. It is the sum of stock movements (stock in, stock out, adjustments, sales). Confirming an order takes the beans out automatically. |
| 2. Slow, mixed-up invoices | Confirming a sales order issues the invoice in the same step: `INV-0001`, subtotal + 7% VAT = total. Numbers come from a counter and are never reused or edited. |
| 3. Who owes money | The Accountant records payments against invoices. A full payment marks the invoice Paid, and the dashboard shows open invoices and the amount still owed. |
| 4. Promising beans we don't have | Confirm is refused with `Not enough stock for ARB-1KG` and nothing changes. Products below their reorder level show a Low stock badge. |
| 5. Anyone can change anything | Every user has a Role (Admin, Sales, Warehouse, Accountant). The server checks it on every endpoint: `403` for the wrong role, `401` without a token. |

Every user also sees a dashboard with four live numbers: Sales Today, Low Stock count, Open Invoices and Stock Value.

## Demo accounts

All five accounts share one demo password: **`SiamBean-Demo-2026`**.

| Role | Person | Email | What they can do |
| --- | --- | --- | --- |
| Admin | Khun Somchai | `somchai@siambean.test` | Everything, including product prices |
| Sales | Nok | `nok@siambean.test` | Customers, sales orders (create, confirm, cancel), view invoices |
| Sales | Ploy | `ploy@siambean.test` | Same as Nok |
| Warehouse | Lek | `lek@siambean.test` | Stock in, stock out, adjustments, view products |
| Accountant | Fon | `fon@siambean.test` | Invoices and payments, view products and customers |

The role matrix (which role may do what, and which gets `403`) is in the [spec](.scratch/mini-erp/spec.md). Navigation hides what a role cannot do, and the server enforces it even on a direct URL or API call.

## Architecture

```
Browser (React SPA)  ──►  Vercel (one project, services)
   supabase-js: login only      ├─ /      Vite + React + TypeScript + Tailwind + shadcn/ui
                                └─ /api/* FastAPI (Python, uv, psycopg3)  ──►  Supabase Postgres
                                                                             Supabase Auth (JWT)
```

- **Database and login:** Supabase Postgres and Supabase Auth. The browser uses supabase-js for login and session only. Row level security is on every table with no policies, so only FastAPI (on the transaction pooler, `DATABASE_URL`) talks to the database.
- **Backend:** FastAPI at `/api/*`. Each request checks the Supabase JWT (ES256, via JWKS) and the user's Role, and runs in one transaction.
- **Frontend:** React 19, TypeScript, Vite, Tailwind, shadcn/ui, react-router. Mobile first.
- **Deploy:** one Vercel project in services mode (see [`vercel.json`](vercel.json)). The SPA is served at `/` and FastAPI at `/api/*` on the same origin, so there is no CORS. Functions run in `sin1` (Singapore), next to the database. Every push to `main` redeploys.

### Key business rules

Enforced in the database or the API, never only in the UI. The full list is in [`CLAUDE.md`](CLAUDE.md) and the decisions behind them are in [`docs/adr/`](docs/adr/).

- VAT is 7%. Order lines store the price without VAT. The invoice stores subtotal, VAT (`round(subtotal * 0.07, 2)`) and total. Money is `numeric(12,2)`, never floats.
- Stock never goes negative: a database trigger and the confirm function both enforce it. A failed confirm changes nothing (`409 Not enough stock for <SKU>`).
- Stock on hand is the sum of `stock_movements`. There is no quantity column.
- `SO-0001` and `INV-0001` come from the `doc_counters` table inside the same transaction ([ADR-0003](docs/adr/0003-document-numbers-from-a-counter-table.md)).
- Confirm creates the movements, the invoice and the status change in one Postgres function, all or nothing ([ADR-0002](docs/adr/0002-confirm-is-one-postgres-function.md)).
- Price and cost are copied onto order lines, so changing a product price never touches old orders or invoices.
- Products and customers are deactivated, never deleted. Orders are cancelled, never deleted.
- Roles are checked on the server ([ADR-0004](docs/adr/0004-supabase-auth-roles-enforced-in-fastapi.md)). Dates use the `Asia/Bangkok` timezone.

## Database schema

The ER diagram of the real tables (10 tables, checked against the live database) is in [`docs/er-diagram.md`](docs/er-diagram.md). The migrations are in [`supabase/migrations/`](supabase/migrations/).

Tables: `companies`, `users`, `customers`, `products`, `stock_movements`, `sales_orders`, `order_items`, `invoices`, `payments`, `doc_counters`. Plus the `stock_on_hand` view.

## User stories

All five stories and the bonus are done and live. How to see each one on screen is in [`testing-manual.md`](testing-manual.md), and the 7-minute demo script is its section 8.

| Story | Status | What it does |
| --- | --- | --- |
| US-1 Sales order → invoice | Done | Sales picks Café Lune, adds 20 × ARB-1KG at 450.00 THB and confirms. On hand goes from 170 kg to 150 kg and `INV-0001` is issued: 9,000.00 + 630.00 VAT = 9,630.00 THB, due in 30 days. A quantity above the stock on hand (for example 200) is refused with `409 Not enough stock for ARB-1KG` and nothing changes: no stock out, no invoice, no number used. Confirm is one Postgres function, all or nothing. |
| US-2 Low stock | Done | Low stock badge on the product list, and the dashboard Low Stock count (ROB-1KG: 35 kg is below its reorder level of 40). The dashboard tile opens the list filtered to low stock. |
| US-3 Roles | Done | The server checks the Role on every endpoint: `401` without a token, `403` for the wrong Role. Sales opening the Accounting screen sees the Access denied page and the API returns `403`. Warehouse calling confirm-order directly gets `403`. Invoices are open to Admin, Sales and Accountant. Accounting and recording a payment are Admin and Accountant only. Admin opens every screen. |
| US-4 Payment | Done | The Accountant records a payment against an open invoice. A full payment (9,630.00 THB) marks it Paid and the dashboard Open Invoices drops by that amount. Partial payments work (the Balance falls and the invoice stays Open), and a payment above the Balance or on a Paid invoice is refused (`409`). Payments are never edited or deleted. |
| US-5 Search | Done | Customer search filters 200 customers on part of a name or the Tax ID, ignores upper and lower case, answers in about 0.2 s and pages at 20 rows. |
| Bonus: PDF invoice | Done | **Download PDF** on the invoice screen saves `INV-0001.pdf`: one A4 page with the Siam Bean Co. header and Tax ID, the invoice number, date and due date, Bill To (customer name, address, Tax ID), the lines (SKU, name, quantity with unit, unit price, amount), then Subtotal, VAT 7%, Total, Paid and Balance in `9,630.00 THB` format. It shows the prices copied onto the order, so a later price change never alters it. Limitation: the PDF uses a built-in Latin font, so Thai characters in a name or address print as `?` (the on-screen invoice shows them correctly). |

## Setup

You need Python 3.12+ with [`uv`](https://docs.astral.sh/uv/), a recent Node.js (built on Node 25) and a Supabase project.

1. **Environment.** Copy `.env.example` to `.env` at the repo root (it is git-ignored) and fill in these names from your Supabase dashboard. Never commit values.
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`
   - `DATABASE_URL` (transaction pooler, port 6543), `POSTGRES_PASSWORD`
   - `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` (dev tooling only, not read by the app)
   - Only the Supabase URL and the publishable key reach the browser.
2. **Database.** Apply the files in `supabase/migrations/` in order (Supabase MCP `apply_migration`, or the SQL editor).
3. **Backend.**
   ```bash
   cd backend
   uv sync
   uv run python -m scripts.seed          # company, 5 demo users, 4 products with opening stock, 200 customers (safe to run again)
   uv run fastapi dev app/main.py         # http://localhost:8000
   ```
4. **Frontend.**
   ```bash
   cd frontend
   npm ci
   npm run dev                            # http://localhost:5173, proxies /api to the backend
   ```
5. **Reset the demo data** to the fresh state (before a demo or after testing):
   ```bash
   cd backend && uv run python -m scripts.reset_demo
   ```
   It deletes Siam Bean's orders, invoices, payments and stock movements, resets the document counters (the next order is `SO-0001`, the next invoice `INV-0001`), and restores the 4 products (ARB-1KG 170, ROB-1KG 35, BLD-1KG 90, DRP-10 240) and the 200 customers. The 5 demo users are kept. It runs in one transaction, can be run twice, and refuses any company other than Siam Bean or a `TEST-*` company.

After a reset the dashboard shows Low Stock 1, Stock Value 107,100.00 THB, Sales Today 0.00 THB and Open Invoices 0.

## How to demo

[`testing-manual.md`](testing-manual.md) section 8 is the 7-minute demo script, minute by minute: the pre-flight checklist (reset, which window is logged in as which Role), the exact clicks, the numbers to expect (SO-0001, 170 → 150 kg, INV-0001 = 9,000.00 + 630.00 = 9,630.00 THB, the dashboard before and after the payment), the failing-confirm and `403` demos, what to say, a fallback for every step, and what to drop if time runs out. Sections 1 to 7 of the same file are the full hand-test of every feature.

## Tests

Tests were written first (red before green) and run against the hosted Supabase project in a throwaway `TEST-<runid>` company with its own four role users, which is cleaned up afterwards. They never touch the Siam Bean demo data ([ADR-0005](docs/adr/0005-tests-run-against-hosted-supabase-in-a-throwaway-company.md)). Backend tests go through the HTTP seam with FastAPI's `TestClient`.

```bash
cd backend && uv run pytest -q                                   # 459 passed
cd frontend && npm run typecheck && npm test && npm run build    # 180 tests passed
```

Counts as of 20 Oct 2026, taken from running the suites on the final branch: 459 backend tests, 180 frontend tests (19 files). The backend suite takes about 8 minutes because it talks to the hosted database. If it prints a burst of "connection is closed" errors, that is the network: run it again.

## Documentation

| Document | What it is |
| --- | --- |
| [`docs/scenario.md`](docs/scenario.md) | The business brief. The source of truth. |
| [`GLOSSARY.md`](GLOSSARY.md) | Domain vocabulary used in code, tests and UI |
| [`.scratch/mini-erp/spec.md`](.scratch/mini-erp/spec.md) | The spec, including the role matrix |
| [`.scratch/mini-erp/issues/`](.scratch/mini-erp/issues/) | The tickets (01 to 14) |
| [`docs/adr/`](docs/adr/) | Architecture decisions (ADR 0001 to 0006) |
| [`docs/er-diagram.md`](docs/er-diagram.md) | ER diagram of the real tables |
| [`CLAUDE.md`](CLAUDE.md) | Project rules: stack, business rules, TDD, git |
| [`manual.md`](manual.md) | Steps only a human can do (accounts, dashboards) |
| [`testing-manual.md`](testing-manual.md) | How to test each feature by hand |
| [`frontend/README.md`](frontend/README.md) | Frontend layout and conventions |

## Who did what

Solo build by Vuttipat Vachung-ngoen (GitHub: JJiscap). The work was orchestrated with Claude: Claude planned and reviewed, and Sonnet subagents implemented one ticket each on its own feature branch. Every ticket and its progress notes are in [`.scratch/mini-erp/issues/`](.scratch/mini-erp/issues/).
