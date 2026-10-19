# 07: Stock (Stock-in, Stock-out, Adjustment, movement history)

**What to build:** Warehouse and the Admin record a Stock-in (Product, quantity, optional note), a Stock-out (quantity and required reason) or an Adjustment (signed quantity and required reason). Each gets its Document Number (`IN-0001`, `OUT-0001`, `ADJ-0001`) and adds one Stock Movement. Each Product has a movement history: date, type, Document Number, quantity, running balance and who. Covers rules 2 and 3.

**Blocked by:** 02, 03

**Status:** done

**Branch:** `feature/stock`

- [x] Stock-in of 30 ARB-1KG → On Hand 200, and the movement is numbered `IN-0001`.
- [x] Stock-out of 171 ARB-1KG (170 On Hand) → `409` with a clear message, and On Hand still 170.
- [x] Adjustment of −3 with the reason "damaged bags" → On Hand 167, numbered `ADJ-0001`. An Adjustment without a reason → refused.
- [x] Quantity 0 → refused. A non-whole quantity → refused.
- [x] The history for ARB-1KG lists the Opening Stock plus new movements, with the correct running balance.
- [x] Sales and Accountant → `403` on the forms and history.
- [x] Screens: one Stock screen with In, Out and Adjust tabs or a type selector (the Product picker shows current On Hand), and a history view per Product. Works on a phone. (Built mobile first; not yet checked in a real browser, see notes.)
- [x] The stock rules in section 2 of `testing-manual.md` are filled in (section 2.1).

## Progress notes

- Done:
  - Red tests: `backend/tests/test_stock.py`, commit d772920.
  - Backend: `app/modules/stock/{router,schemas}.py`. Full suite 139 passed.
  - Frontend: `src/pages/stock/` (index, MovementForm, MovementHistory, helpers + 7 Vitest tests). Typecheck, 50 tests, build and bundle check pass.
  - Docs: `testing-manual.md` section 2.1.
- Gotchas:
  - Run the backend with `DATABASE_URL=` blank (placeholder password in `.env`).
  - `GET /api/stock/products` is a light picker list, so the stock module does not depend on ticket 05.
  - A refused movement rolls back its document number (tested): the request is one transaction.
  - The type selector is a local radio group (no tabs primitive in shadcn here).
- Not verified: the UI in a real browser (logging in needs a password, which an agent may not type). The orchestrator should walk `testing-manual.md` 2.1 at 375px.
