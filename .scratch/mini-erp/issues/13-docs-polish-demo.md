# 13: README, ER diagram, reset_demo, design review, demo script

**What to build:** Everything the graders look at besides the features:
- **README:**
  - the problem and pain points
  - live URL
  - demo accounts for every Role
  - setup steps (backend, frontend, env, seed)
  - schema and ER diagram that match the live tables (checked with Supabase MCP `list_tables`)
  - US-1..US-5 marked done or not done
  - the PDF bonus
  - tests (`uv run pytest`) and links to `GLOSSARY.md`, spec, tickets and ADRs
- **`uv run python -m scripts.reset_demo`:** restores the fresh demo state. Café Lune's demo order then becomes `SO-0001`/`INV-0001`, and Siam Bean's master data and the 5 Users are kept.
- **Design review pass:** design critique, accessibility review and UX copy across all screens, fixing what's found.
- **Demo rehearsal script:** section 8 of `testing-manual.md`.

**Blocked by:** 10, 11, 12

**Status:** ready-for-agent

**Branch:** `feature/docs-polish`

- [ ] README has every item in the worksheet's demo checklist that lives in the repo.
- [ ] `docs/er-diagram.md` matches `list_tables` output: same tables, columns and foreign keys.
- [ ] Running `reset_demo` twice works. The dashboard afterwards shows Low Stock 1, Stock Value 107,100.00, Sales Today 0.00 and Open Invoices 0.
- [ ] Every screen at phone width: no horizontal scroll, no console errors, empty states present, errors say what to fix.
- [ ] Section 8 of `testing-manual.md` holds a 7-minute demo script, minute by minute, with the exact clicks and expected numbers.

## Progress notes

**Part A done, Part B pending.** Branch `feature/docs-reset` (not merged).

Done (Part A):
- `reset_demo` (TDD, 15 tests in `backend/tests/test_reset_demo.py`, red commit 2c898c5, then green). `reset_company(conn, company_id, total_customers=200)` runs in one transaction: deletes payments, invoices, order items, sales orders, ALL stock movements and doc counters; deletes extra products/customers; restores the 4 products and the seed customers to seed values (active); re-creates missing seed rows and the Opening Stock. Guard: only the Siam Bean company or `TEST-*`. `main()` resolves Siam Bean by name and prints counts only. Added `customer_specs()` to `scripts/demo_data.py`.
- Real reset run once on production and verified read-only via MCP: on hand 170/35/90/240, 0 orders, 0 invoices, 0 counters, 200 active customers, 5 users, low stock 1, stock value 107,100.00.
- `README.md` written (problem, live URL, demo accounts, architecture, rules, setup, schema link, US table, tests, docs links, who did what).
- `docs/er-diagram.md` compared with `list_tables`: tables, columns and FKs matched; added the `users.id -> auth.users` link that was missing.

Next (Part B, after tickets 10 and 12): design critique + accessibility + UX copy pass on all screens at phone width; testing-manual section 8 (7-minute demo script); update the README US table (US-1, US-4, PDF bonus) and test counts; update the "arrive with later tickets" line in `docs/er-diagram.md` if 09/10 add functions.

Gotchas:
- Extras created during testing are DELETED by the reset (not deactivated): the app never deletes, but this script is the sanctioned exception for demo data, and a deactivated leftover would still show in search during the demo.
- Tests pass `total_customers=5` to keep runs fast; one test checks the default of 200.
- Any new table with a `company_id` FK must be added to the delete list in `reset_company` (children first) or the reset will fail on a foreign key.
