# 11: Dashboard (4 live numbers)

**What to build:** A Dashboard every Role can open, computed live from the data on each request with no caching:
- **Sales Today:** sum of Totals including VAT of Invoices dated today in Bangkok time.
- **Low Stock:** count of active Products with On Hand strictly below Reorder Level. It links to the Products list filtered to Low Stock.
- **Open Invoices:** count and Open Receivables amount.
- **Stock Value:** sum of On Hand × Cost over active Products.

**Blocked by:** 05, 07. The Sales Today and Open Invoices tiles only show non-zero values once 09 and 10 are merged. Test those parts by inserting Invoices through the API once 09 lands, or add those tests when 09 merges.

**Status:** done

**Branch:** `feature/dashboard`

- [x] Clean test Company: Low Stock 1 (ROB-1KG), Stock Value 107,100.00, Sales Today 0.00, Open Invoices 0 · 0.00.
- [x] A Stock-in of 10 ROB-1KG (→ 45 ≥ 40) → Low Stock 0.
- [x] After the US-1 Confirm: Sales Today 9,630.00, Open Invoices 1 · 9,630.00, Stock Value 100,700.00. After a full Payment: Open Invoices 0 · 0.00.
- [x] All 4 Roles → `200`. No token → `401`.
- [x] Screen: 4 tiles with clear labels ("Sales today (incl. VAT)"), money as `9,630.00 THB`, a skeleton while loading, and a 2×2 grid on a phone.
- [x] Section 1 (steps 1, 7, 9) of `testing-manual.md` is verified.

## Progress notes

- Red committed: 16 tests in backend/tests/test_dashboard.py, all 404.
- Backend done: GET /api/dashboard (one SQL query, live, filtered by company_id), 16 passed. Invoices have only open/paid statuses (no cancelled).
- UI done (model.ts, DashboardTiles.tsx, index.tsx): vitest 85 passed, typecheck and build ok.
- Docs done: testing-manual section 1 (steps 1, 7, 9 labels) and 7a. Checkboxes ticked.
- Full backend suite: 255 passed. Pushed on feature/dashboard, not merged.
