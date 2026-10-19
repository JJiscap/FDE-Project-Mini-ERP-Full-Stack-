# 06: Customers (CRUD, search, pagination)

**What to build:** Sales and the Admin create, edit and deactivate Customers (name, Tax ID, Payment Terms Cash or N days, address, phone). Sales, the Admin and the Accountant search Customers by part of the name, 20 per page, with a pager. Warehouse gets `403`. Covers US-5 and rules 7 and 9.

**Blocked by:** 02, 03

**Status:** done

**Branch:** `feature/customers`

- [x] With 200 Customers in the test Company, `GET /api/customers?q=lune` returns Café Lune. Any page has at most 20 items, plus `total`. The request completes in under 1 s.
- [x] Create without a Tax ID → refused with "Tax ID is required". Negative Payment Terms → refused.
- [x] Edit, deactivate and reactivate work. Deactivated Customers are excluded with `?active=true`.
- [x] Accountant: list and view → `200`; create or edit → `403`. Warehouse: everything → `403`.
- [x] Screens:
  - search box filtering as you type (debounced)
  - pager showing "1–20 of 200"
  - an empty state like "No customers match 'xyz'"
  - forms with field errors
  - Payment Terms shown as "Cash" or "30 days"
  - works on a phone
- [x] Section 4 of `testing-manual.md` (US-5) and the customer rules in section 2 are filled in.

## Progress notes

- Done: red tests (`99eb71b`), backend green (`feat(customers)`): `backend/app/modules/customers/router.py`, 40 tests in `backend/tests/test_customers.py`, full suite 144 passed.
- US-5 measured: 0.21 s warm (0.66 s on the very first request of a process, includes opening the pool and fetching the JWKS). The US-5 test sends one warm-up request before timing.
- UI done (`feat(customers-ui)`): list with debounced search, "Active/Inactive/All" filter, pager, detail, new and edit forms; routes index, new, :id, :id/edit. Frontend: typecheck, 53 tests, build pass.
- Docs done: testing-manual sections 2 and 4, manual.md step 13.
- Not verified: screens were not clicked in a browser (login goes through hosted Supabase auth).
- Gotchas: run backend with `DATABASE_URL=` blank (placeholder password in `.env`). `payment_terms_days` errors read "Payment terms days must be 0 or more" (label comes from the field name).
