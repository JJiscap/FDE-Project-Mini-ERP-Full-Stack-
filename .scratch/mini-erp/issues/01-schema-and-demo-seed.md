# 01: Schema, DB functions and demo seed

**What to build:** The whole data model from the spec lives in Supabase. Siam Bean's demo data is loaded, so every later ticket starts from a real database. This covers:
- all tables, the `stock_on_hand` view, and the negative-stock trigger
- `doc_counters` with `next_doc_number`
- the security settings
- a re-runnable seed: Company, 5 demo Users with Roles, 4 sample Products with Opening Stock, 3 sample Customers plus 197 generated cafés

`confirm_sales_order` and `record_payment` belong to tickets 09 and 10, not here.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Branch:** `feature/foundation-backend` (shared with ticket 02)

- [ ] The tables in the spec's Schema section exist, with foreign keys, check constraints, `unique (company_id, sku)` and `unique (company_id, number)`. No quantity column on products.
- [ ] A Stock Movement that would make On Hand negative is refused by the database.
- [ ] `next_doc_number` returns `SO-0001`, then `SO-0002` for the same Company. Another Company gets its own `SO-0001`.
- [ ] RLS is enabled on every table with no policies. Functions and views are revoked from `anon` and `authenticated`. `get_advisors` (security) shows no ERROR.
- [ ] Every migration is applied with Supabase MCP `apply_migration` and saved under `supabase/migrations/`.
- [ ] `uv run python -m scripts.seed` is idempotent. After it runs, `stock_on_hand` shows ARB-1KG 170, ROB-1KG 35, BLD-1KG 90 and DRP-10 240. The Siam Bean Company has 200 Customers.
- [ ] The 5 demo Users can log in through Supabase Auth, and each has a `users` row with the right Role.
- [ ] `docs/er-diagram.md` (mermaid) matches the real tables.
- [ ] The demo accounts table in `testing-manual.md` is filled in.
