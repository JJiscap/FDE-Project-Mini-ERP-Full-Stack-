# Progress ledger (orchestrator memory)

The orchestrator updates this file after every merge or decision and commits it. A SessionStart hook re-injects it after context compaction. Keep it under about 60 lines: state, not history.

**Demo:** Thu 22 Oct 2026, 17:00, on the deployed URL. **Repo:** JJiscap/FDE-Project-Mini-ERP-Full-Stack-

## Where we are

- **Wave 0: done.** Merged to `main` and pushed (merge commit 254354c). Includes the scenario, CLAUDE.md, GLOSSARY, ADR 0001–0006, spec, 14 tickets and manuals.
- **Wave 1: in progress.**
  - `feature/frontend-shell` (ticket 03): **merged.**
    - Verified Sonnet 5.5. Typecheck, 43 tests, build and bundle-secret check all pass. Test changes after red only tightened assertions.
    - Stack: Vite 8, React 19, Tailwind 4, shadcn, react-router 8, react-query 5, zod 4.
    - Conventions are in `frontend/README.md`. Module pages: edit only `src/pages/<module>/index.tsx`, use nested `<Routes>` for sub-pages, and gate buttons with helpers from `permissions.ts`.
  - `feature/foundation-backend` (tickets 01+02): **merged.**
    - Verified Sonnet 5.5. I reran the suite: 104 passed.
    - DB checked via MCP:
      - 0 `TEST-*` companies left.
      - Siam Bean has 200 customers.
      - On Hand is 170/35/90/240.
      - 5 demo users exist.
      - RLS is on all tables, and `anon` can't read tables or call functions.
    - Advisors: only INFO (`rls_enabled_no_policy`) plus the optional leaked-password WARN.
    - JWT: verified via JWKS (ES256), checking `aud` and `iss`.
    - When `DATABASE_URL` is **blank**, `config.py` builds the pooler URI from `POSTGRES_PASSWORD` (host `aws-0-ap-southeast-1.pooler.supabase.com:6543`).
    - Harness, in `backend/tests/conftest.py`:
      - Fixtures: `client_as(role)`, `headers[role]`, `test_company_id`, `conn`.
      - Each test starts clean: 4 products, opening stock, 3 customers.
      - Cleanup refuses to touch any company not named `TEST-*`.
    - To add an endpoint, edit `app/modules/<m>/router.py`, guarded by `Depends(require_roles(...))`, with `conn: Conn`. Return pydantic models with `Money`.
    - Extra DB constraints:
      - Movement sign matches its type.
      - `total = subtotal + vat`.
      - `doc_type` must be one of SO/INV/IN/OUT/ADJ.
- **Wave 1 (01, 02, 03) is merged.**
- **Wave 2: MERGED** (05 products, 06 customers, 07 stock), each on Sonnet. The combined `main` gives 239 backend tests and 75 frontend tests passing.
  - Products API (05):
    - `GET /api/products` takes `?q&active&low_stock&page`. Items are `{id, sku, name, unit, price, cost, reorder_level, active, on_hand, low_stock}`.
    - Writes are Admin only.
  - Customers API (06):
    - `GET /api/customers` takes `?q&active&page` (Warehouse gets 403).
    - Writes are Admin and Sales.
    - Pages: `/customers/:id`, `/customers/new`, `/customers/:id/edit`. US-5 search takes 0.21 s.
  - Stock API (07):
    - `POST /api/stock/movements` with `{product_id, movement_type in|out|adjust, quantity, reason}`.
    - `GET /api/stock/movements?product_id` returns `balance_after`. `GET /api/stock/products` feeds the picker.
    - A refused movement rolls back the doc counter.
  - None of the agents could log in through a browser. The UI is verified only by typecheck, unit tests and build. The orchestrator must click through it via Chrome MCP after the deploy (manual.md 13).
- **Next:**
  - W3: 08 draft sales orders (xhigh), with 11 dashboard in parallel.
  - Then 09 confirm (fresh agent on `feature/sales-orders`).
  - 04 deploy as soon as `vercel whoami` succeeds.
- **Ticket 04 (deploy)** starts as soon as `vercel whoami` shows the user is logged in.

## Waves (tickets in .scratch/mini-erp/issues/)

- W1: 01+02 ‖ 03 → 04
- W2: 05 ‖ 06 ‖ 07
- W3: 08 → 09, with 11 in parallel
- W4: 10 → 12 (14 optional)
- W5: 13, then an end-to-end check on the production URL

## Merge checklist (every branch)

1. Read the agent report and confirm the model was Sonnet.
2. Compare `git diff main...branch` with the ticket's acceptance criteria.
3. Check that no test was weakened between the red commit and the green one.
4. Run `uv run pytest` and, when the frontend changed, `npm run typecheck && npm run build`.
5. `git merge --no-ff`, then push `main`.
6. Update this file and commit it.

## Decisions since the plan

- Subagents: from Wave 2, **one ticket per agent**. Use quiet output (`pytest -q`, tail or grep). Write progress notes in the ticket file. Never extend a tired agent; start a fresh one.
- The frontend reads the Supabase URL and publishable key through an explicit `define` in `vite.config.ts`. `.env` is never edited.
- Demo users are on `@siambean.test` with password `SiamBean-Demo-2026`.

## Open issues / blockers

- Waiting on the user: `vercel login` (manual.md step 1), which blocks ticket 04. Check it with `vercel whoami`.
- `DATABASE_URL` is FIXED by the user (pooler, port 6543). A real connection was verified. The blank-`DATABASE_URL` workaround is no longer needed.
- The global git identity is set (JJiscap / vuttipat.v@gmail.com). Old commits keep the auto identity; we decided not to rewrite history.
- Frontend open items:
  - Only Nok's login was verified.
  - The real `/api/me` was not exercised yet.
  - The main JS chunk is 764 kB (acceptable for now).
  - `grep sb_secret dist` gives a false positive from the supabase-js prefix check. Use `npm run check:bundle` instead.

## Deploy

- Production URL: _(not yet deployed)_
