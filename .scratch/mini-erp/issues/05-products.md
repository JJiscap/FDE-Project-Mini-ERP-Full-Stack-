# 05: Products (CRUD, On Hand, Low Stock badge)

**What to build:** Every User sees the Product list with SKU, name, Unit, Price, On Hand and a Low Stock badge, with search and 20 per page. The Admin creates, edits (name, Price, Cost, Reorder Level, Unit) and deactivates or reactivates Products. Other Roles get `403` on writes. Covers US-2 (list part) and rules 6, 7 and 9.

**Blocked by:** 02, 03

**Status:** done

**Branch:** `feature/products`

- [x] On a clean test Company, the list shows ARB-1KG with On Hand 170. ROB-1KG (35 < 40) is flagged Low Stock; ARB-1KG (170 ≥ 50) is not.
- [x] Admin creates a Product → `201`, and it appears in the list with On Hand 0.
- [x] Duplicate SKU → `409` "SKU ARB-1KG already exists". Price −1 → refused with "Price must be 0 or more". Cost −1 is refused the same way.
- [x] Admin edits a Price → `200`. Deactivate → the Product disappears from `?active=true` results but still exists.
- [x] Sales, Warehouse and Accountant: list → `200`. Create, edit or deactivate → `403`.
- [x] Screens: list with badge and empty state, create and edit form showing field-level errors, deactivate with confirmation. Money as `450.00 THB`. Works on a phone.
- [x] Section 5 of `testing-manual.md` (US-2) and the product rules in section 2 are filled in.

## Progress notes

- Done: backend tests (red 05904ea) then `products/router.py` (GET list/one, POST, PATCH; 60 tests green); UI in `frontend/src/pages/products/` (list, filters in URL, pager, create/edit dialog with field-level API errors, deactivate/reactivate ConfirmDialog; 15 Vitest tests for the form schema and filters); testing-manual section 5.
- Not verified: the screens in a real browser (login goes to hosted Supabase) and at 375 px by eye. The orchestrator should click through testing-manual section 5.
- Gotchas: run backend with `DATABASE_URL=` blank while `.env` has the placeholder password. PATCH uses `model_fields_set`: omitted fields stay, explicit null is a 422. The SKU is read-only on edit in the UI (the API allows changing it). List defaults to Active products; `?active=all|false` and `?low_stock=true` in the address bar.
