# 06: Customers (CRUD, search, pagination)

**What to build:** Sales and the Admin create, edit and deactivate Customers (name, Tax ID, Payment Terms Cash or N days, address, phone). Sales, the Admin and the Accountant search Customers by part of the name, 20 per page, with a pager. Warehouse gets `403`. Covers US-5 and rules 7 and 9.

**Blocked by:** 02, 03

**Status:** ready-for-agent

**Branch:** `feature/customers`

- [ ] With 200 Customers in the test Company, `GET /api/customers?q=lune` returns Café Lune. Any page has at most 20 items, plus `total`. The request completes in under 1 s.
- [ ] Create without a Tax ID → refused with "Tax ID is required". Negative Payment Terms → refused.
- [ ] Edit, deactivate and reactivate work. Deactivated Customers are excluded with `?active=true`.
- [ ] Accountant: list and view → `200`; create or edit → `403`. Warehouse: everything → `403`.
- [ ] Screens:
  - search box filtering as you type (debounced)
  - pager showing "1–20 of 200"
  - an empty state like "No customers match 'xyz'"
  - forms with field errors
  - Payment Terms shown as "Cash" or "30 days"
  - works on a phone
- [ ] Section 4 of `testing-manual.md` (US-5) and the customer rules in section 2 are filled in.
