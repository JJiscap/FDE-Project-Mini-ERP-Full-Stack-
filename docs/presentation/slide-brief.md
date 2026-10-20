# Class 4 slide brief (hand-off to Claude Design)

For Thu 22 Oct 2026, 17:00. 10 minutes, hard stop: 1 min problem, 6 min live demo, 3 min Q&A. The deck is a frame around the live demo.

## How to use this file

1. Open claude.ai, then Design. Start a new slide deck.
2. Copy everything between `===== PASTE FROM HERE =====` and `===== PASTE UNTIL HERE =====` into the prompt.
3. Attach: `docs/er-diagram.md`, and every PNG in `docs/presentation/shots/` that exists (names are listed at the end). Missing shots are fine: the prompt tells Design to leave a labelled empty frame.
4. Generate. Export **.pptx and PDF** (Geist may not be installed on the presenting laptop). Save both to `docs/presentation/`.
5. Tell Claude Code "slides exported". It checks every number against the sources and reports mismatches.

**Claim gate:** do not present S6's headline ("All five user stories work on the live URL") until the screenshot run has passed on production. Until then it is only true in tests.

===== PASTE FROM HERE =====

Create a 13-slide, 16:9 presentation for a 10-minute university project demo, with speaker notes on every slide. Export as .pptx. Audience: two instructors scoring a live demo of a web app. The slides are a thin frame around a live demo: only the first minute and the Q&A use them. So: one idea per slide, big numbers, very little text.

## The project

"Siam Bean Co. Mini ERP" is a small web ERP for a fictional Bangkok coffee-bean distributor (about 80 cafés, 5 staff). It is a group project; do not name the group or its members anywhere on the slides. Course: CU FDE3, Class 4, Thu 22 Oct 2026. Live URL: fde-project-mini-erp-full-stack.vercel.app

## Design direction (match the product)

- Warm and calm, like the app. Colours: background cream #FBF9F5, ink #241B14, coffee brown #683B20 (primary), surface #F3EEE6, accent #F3EADD, muted text #5E534A, mid-brown #8E5224. Red #B7191C **only** for refusals and 403s. One muted green for "Done" and "Paid", one dark amber for "Low Stock". Text contrast at least 4.5:1.
- Font: Geist (fallback Inter). Titles at least 40 pt, body at least 24 pt, nothing under 18 pt except footers. Tabular numerals for money.
- At most 6 lines of text per slide. Make the real numbers the visual: large stat figures, flow strips with arrows, a native ER diagram, a role matrix.
- No animations, no dark mode, no stock photos, no decoration for its own sake. Flat, simple shapes. Optional: small flat illustrations of coffee beans, boxes or an invoice as accents on slides 1 to 3 only.
- Use these numbers and strings exactly as written. Money is always `9,630.00 THB` (comma thousands, two decimals, THB). Quantities carry their unit (`150 kg`). Use the app's terms: On Hand, Low Stock, Open Invoices, Sales Today, Stock Value, Confirm, Draft, Confirmed, Paid.
- Never put a password, token or key on a slide.
- Mark slides 7 to 13 with a small "Appendix" tag in the corner. Slide 13 is hidden (skipped in slideshow), backup only.
- Screenshots: use the attached PNGs where named below. If a named file is not attached, draw an empty rounded frame labelled with the file name. Do not invent UI.

## Slide 1: Title

- Title: Siam Bean Co. Mini ERP
- Tagline: One order in. Stock, invoice and dashboard agree.
- Line: CU FDE3 · Class 4 · Thu 22 Oct 2026 · Group project
- URL, large, monospace: fde-project-mini-erp-full-stack.vercel.app
- Notes: "We built a Mini ERP for Siam Bean Co., a coffee-bean distributor in Bangkok. It's live at this address and we'll use it for the whole demo."

## Slide 2: The problem

- Headline: Five things hurt Siam Bean. One system answers all five.
- Small fact card on the left: Bangkok coffee-bean distributor · imports and roasts · 1 kg bags to about 80 cafés · 5 staff, 1 office, 1 warehouse. Today: LINE and phone orders retyped into a sheet, stock in another sheet, invoices in Word numbered by hand.
- Five rows on the right, each the owner's quote then the answer (quote in italics, answer bold):
  1. "Stock in the sheet is always wrong." → Stock is the sum of movements. Nobody types it.
  2. "Each invoice takes me an hour and the numbers get mixed up." → Confirm issues INV-0001 with 7% VAT, numbered by the system.
  3. "I never know who still owes me money." → Payments, and a live Open Invoices number.
  4. "Sales sometimes promise beans we don't have." → Confirm is refused: Not enough stock for ARB-1KG.
  5. "Anyone can change anything in the spreadsheet." → Four roles, checked on the server.
- Small attribution under the quotes: Khun Somchai, owner.
- Notes: "Siam Bean sells 1 kg bags to about 80 cafés with five staff. Orders arrive on LINE and by phone and get retyped into one spreadsheet, stock lives in another, and invoices are Word files numbered by hand. These are the owner's five pain points in the owner's own words. Each one maps to something you'll see work in the next minute."

## Slide 3: Why an ERP

- Headline: One shared database, one Confirm button.
- Top band, label "Before": three separate boxes (Orders sheet, Stock sheet, Invoices in Word) with broken links between them and the word "retype". Caption: Nothing matches. Someone reconciles by hand every month.
- Bottom band, label "With the Mini ERP": a chain Sales order → **Confirm** → (Stock −20 kg and Invoice INV-0001) → Payment → Dashboard. Caption: One action in Sales updates Inventory, Accounting and the Dashboard.
- Notes: "An ERP replaces three disconnected tools with one database. Confirming an order is one event: stock moves, the invoice is issued and the dashboard changes. Nobody retypes anything."

## Slide 4: Architecture

- Headline: One URL, three layers.
- Left to right: Browser (React 19, TypeScript, Tailwind, shadcn/ui) → Vercel, one project (`/` is the Vite app, `/api/*` is FastAPI in Python) → Supabase (Postgres and Auth).
- Three short callouts underneath: Rules live in Postgres and FastAPI, never only in the screens · Only the API talks to the database (row level security on every table) · Same origin, no CORS. Every push to main redeploys.
- Notes: "React front end, FastAPI back end, Supabase Postgres, all behind one Vercel URL. The business rules sit in the database and the API, not in the screens."

## Slide 5: Demo roadmap

- Headline: Café Lune orders 20 kg of Arabica.
- Six numbered steps as a flow, with a small role chip on steps 1 and 5:
  1. [chip: Nok · Sales] Draft SO-0001: Café Lune, ARB-1KG, 450.00 THB/kg
  2. Try 200 kg → "Not enough stock for ARB-1KG". Nothing changes.
  3. Confirm 20 kg → On Hand 170 kg → 150 kg
  4. INV-0001 → 9,000.00 + 630.00 VAT = **9,630.00 THB**
  5. [chip: Fon · Accountant] Records the payment → Paid
  6. Dashboard → Open Invoices 0.00 THB · Stock Value 100,700.00 THB
- Extra chip, set apart in red: [Lek · Warehouse] calls Confirm directly → 403
- Footer: ▶ Live demo · fde-project-mini-erp-full-stack.vercel.app
- Notes: "Here's the story we'll run live. Nok in Sales creates and confirms the order, Fon in Accounting records the payment, and we'll show Lek in the warehouse being refused. Switching to the live app now."

## Slide 6: Closing (stays on screen during Q&A)

- Headline: All five user stories work on the live URL.
- A table, one row per story, every row with a green "Done" tag:
  - US-1 Sales order → invoice: 170 → 150 kg · INV-0001 = 9,630.00 THB · short stock is refused, nothing changes
  - US-2 Low stock: ROB-1KG, 35 kg is below 40 · badge and dashboard count
  - US-3 Roles: wrong role → 403, no token → 401
  - US-4 Payment: full payment → Paid · Open Invoices drops by 9,630.00 THB
  - US-5 Search: 200 customers · about 0.2 s · 20 per page
  - Bonus: PDF invoice (INV-0001.pdf)
- Three small proof tiles: 459 backend + 180 frontend tests · Tests written first · Rules enforced on the server
- Right side: three screenshots, small: `06-invoice-inv-0001.png`, `08-dashboard-after-payment.png`, and `10-phone-dashboard.png` inside a simple phone frame.
- Footer: fde-project-mini-erp-full-stack.vercel.app · github.com/JJiscap/FDE-Project-Mini-ERP-Full-Stack- · "Questions?"
- Notes: "Every user story from the brief is done and works on the live URL, plus the PDF invoice as a bonus. We're happy to show the code, the tests or the data behind any screen."

## Slide 7: ER diagram (Appendix)

- Headline: 10 tables, the same as the live database.
- Draw natively (do not paste any diagram code). Group the tables in five labelled clusters:
  - Master data: companies, users, customers, products
  - Inventory: stock_movements
  - Sales: sales_orders, order_items
  - Billing: invoices, payments
  - Numbering: doc_counters
- Relationships (one → many unless noted): companies → users, customers, products, stock_movements, sales_orders, order_items, invoices, payments, doc_counters. customers → sales_orders. customers → invoices. products → stock_movements. products → order_items. sales_orders → order_items. sales_orders → invoices (one to one at most). invoices → payments.
- Key columns to show per table (keep boxes small): customers: name, tax_id · products: sku, price, cost, reorder_level · stock_movements: product_id, quantity (+/−), movement_type, ref_doc · sales_orders: number, status · order_items: quantity, unit_price, unit_cost · invoices: number, subtotal, vat, total, status · payments: amount · doc_counters: doc_type, last_value.
- Four callouts: No quantity column: On Hand is the sum of stock_movements · unit_price and unit_cost are copied onto order_items · The invoice stores subtotal, VAT and total · company_id and created_by on every business table
- Footnote: Checked against the live database (Supabase list_tables), 20 Oct 2026.
- Notes: "Ten tables, checked against the live database on 20 October. Stock has no quantity column: it's the sum of movements. Prices are copied onto order lines, so changing a price never touches an old order or invoice. The course's starter had nine tables; I added doc_counters for gap-free document numbers."

## Slide 8: Where the rules live (Appendix)

- Headline: Enforced on the server, never only in the UI.
- A three-column table, 7 rows: Rule | Enforced by | Decision
  1. Stock never below 0. On Hand is the sum of movements. | Database trigger on stock_movements, plus the confirm function: 409 "Not enough stock for <SKU>" | ADR-0002
  2. Confirm is all or nothing | One Postgres function, confirm_sales_order: movements, invoice and status together | ADR-0002
  3. SO-0001 and INV-0001 are never reused | A counter table, updated in the same transaction. A rollback leaves no gap. | ADR-0003
  4. VAT is 7% | numeric(12,2). VAT = round(subtotal × 0.07, 2). The invoice stores subtotal, VAT, total. | Rule 1
  5. Old documents never change | Prices are copied onto the order lines | Rule 6
  6. Roles | FastAPI checks the login token and Role on every endpoint: 401 or 403 | ADR-0004
  7. Validation | Price ≥ 0, quantity > 0, SKU unique, Tax ID required. Messages say what to fix. | Rule 9
- Screenshot beside row 1: `04-confirm-refused.png`.
- Notes: "Each rule lives where no screen can bypass it. The stock check is a database trigger plus the confirm function. Confirm is one Postgres function, so it's all or nothing. Document numbers come from a counter table inside the same transaction."

## Slide 9: Roles (Appendix)

- Headline: Four people, four views.
- Matrix (✓ allowed, 403 refused, 403 in red):

  | Action | Admin | Sales | Warehouse | Accountant |
  |---|---|---|---|---|
  | Edit products and prices | ✓ | 403 | 403 | 403 |
  | View customers | ✓ | ✓ | 403 | ✓ |
  | Edit customers | ✓ | ✓ | 403 | 403 |
  | Sales orders, Confirm | ✓ | ✓ | 403 | 403 |
  | Stock in, out, adjust | ✓ | 403 | ✓ | 403 |
  | Invoices, PDF | ✓ | ✓ | 403 | ✓ |
  | Accounting, record payment | ✓ | 403 | 403 | ✓ |
  | Dashboard | ✓ | ✓ | ✓ | ✓ |

- Code block (monospace, dark ink on surface), exact text:
  ```
  POST /api/sales-orders/{id}/confirm   as Lek (Warehouse)
  HTTP/2 403
  {"detail":"Your role (warehouse) is not allowed to do this."}
  ```
- Demo accounts line: Khun Somchai (Admin) · Nok and Ploy (Sales) · Lek (Warehouse) · Fon (Accountant). Emails are <first name>@siambean.test, for example nok@siambean.test. "Password: in the README." Do not show a password.
- Screenshot: `09-access-denied.png`.
- Notes: "The menu hides what a role can't do, but the server decides. Lek calling Confirm directly gets a 403. Sales opening the Accounting screen sees Access denied."

## Slide 10: How it was built (Appendix)

- Headline: Tests first, one ticket at a time.
- A horizontal pipeline: Scenario → Glossary and 6 decisions (ADRs) → Spec → 14 tickets → per ticket: branch → tests RED → code GREEN → review → merge → deploy. Highlight RED in red and GREEN in green.
- Four evidence tiles:
  - 16 red-first commits, each with the failing test output in the commit message
  - Confirm order began with 44 backend and 5 screen tests failing, before any code
  - 100+ commits, one feature branch per ticket
  - Tests run on the hosted database in a throwaway TEST company, never on the demo data
- A plain line at the bottom: Group project. The code was built with Claude as the coding agent: Sonnet subagents wrote one ticket each; every branch was tested and reviewed before it merged.
- Notes: "Every ticket started with failing tests, and the failing output is in the commit message. Confirm order began with 44 backend and 5 screen tests red. This was a group project. The code was written with Claude as the coding agent: one subagent per ticket, and every branch was tested and reviewed before it merged."

## Slide 11: Decisions on record (Appendix)

- Headline: Six decisions, written down.
- Six rows, number and title in bold, reason after the dash:
  - 0001 The scenario wins over the course notes: no invented rules
  - 0002 Confirm is one Postgres function: no other path can half-confirm an order
  - 0003 A counter table, not sequences: a rolled-back confirm must not burn an invoice number
  - 0004 Supabase Auth, Roles enforced in FastAPI: the course requires the API itself to return 403
  - 0005 Tests on the hosted database in a throwaway company: real triggers and real login tokens, demo data untouched
  - 0006 Vercel, not Cloudflare Workers: Postgres drivers are risky on Cloudflare's Python runtime, and the course accepts any public deployment
- Notes: "Six decisions are on record in the repo. The one that matters most for the demo is number two: Confirm is a single database function."

## Slide 12: Honest limits (Appendix)

- Headline: What is not built.
- Left column "Not built": A second company (every table has company_id, but there is no multi-tenancy) · Purchasing and goods receipt · A user-management screen (users are created by a seed script) · Public sign-up (closed) · Quotations and delivery notes (out of scope in the brief)
- Right column "Known limit": The PDF invoice uses a Latin font, so Thai text prints as "?" on the PDF. The on-screen invoice is correct.
- Small closing line: Not done costs nothing. Done that fails costs trust.
- Notes: "Here's what I did not build: a second company, purchasing, user management, quotations and deliveries. And one known limit: the PDF prints Thai characters as question marks."

## Slide 13: Backup filmstrip (hidden)

- Headline: Backup: the same run in screenshots. Only if the network fails.
- A filmstrip of the attached shots in order, each with a one-line caption: `01-dashboard-clean.png` Dashboard before · `03-new-order-200kg.png` 200 kg warning · `04-confirm-refused.png` Confirm refused · `05-order-confirmed.png` Confirmed · `06-invoice-inv-0001.png` INV-0001 · `07-record-payment.png` Fon records payment · `08-dashboard-after-payment.png` Dashboard after · `09-access-denied.png` Access denied. Add the 403 code block from slide 9.
- Notes: "Backup only: the same run as screenshots."

===== PASTE UNTIL HERE =====

## Screenshot files (put in `docs/presentation/shots/`)

| File | Screen | Slide |
|---|---|---|
| `01-dashboard-clean.png` | Dashboard: 0.00 THB · 1 · 0 over 0.00 THB · 107,100.00 THB | 13 |
| `02-low-stock-badge.png` | Products, ROB-1KG Low Stock badge | 13 |
| `03-new-order-200kg.png` | Draft with amber "Only 170 kg on hand" | 13 |
| `04-confirm-refused.png` | Dialog with red "Not enough stock for ARB-1KG" | 8, 13 |
| `05-order-confirmed.png` | SO-0001 Confirmed, Open INV-0001 | 13 |
| `06-invoice-inv-0001.png` | 9,000.00 / 630.00 / 9,630.00 THB, due +30 days | 6, 13 |
| `07-record-payment.png` | Fon's dialog, Balance after this payment: 0.00 THB | 13 |
| `08-dashboard-after-payment.png` | 9,630.00 · 1 · 0 over 0.00 · 100,700.00 | 6, 13 |
| `09-access-denied.png` | Sales opens /accounting | 9, 13 |
| `10-phone-dashboard.png` | Real phone, mobile data, logged in as Sales | 6 |
| `11-customers-search-lune.png` | "1-1 of 1" | 13 (optional) |

## Sources for every figure (for the post-export check)

| Figure | Source |
|---|---|
| 170 → 150 kg, 9,000.00 + 630.00 = 9,630.00 THB, SO-0001, INV-0001 | `docs/scenario.md` US-1, `testing-manual.md` §1 and §8.2 |
| Dashboard 107,100.00 THB (before) and 100,700.00 THB (after) | `testing-manual.md` §7a |
| 459 backend, 180 frontend tests | `uv run pytest --collect-only -q`, `npm test -- --run` (checked 20 Oct) |
| 16 red-first commits, 44 backend and 5 screen tests failing at the start of Confirm order | `git log --format=%s \| grep -c '(red)$'`, commit "test(sales-orders): confirm order to invoice (red)" |
| 10 tables | `docs/er-diagram.md` |
| Role matrix | `.scratch/mini-erp/spec.md` (Role matrix) |
| 403 body | `testing-manual.md` §8.2 at 6:25 |
| ADR titles and reasons | `docs/adr/0001` to `0006` |
