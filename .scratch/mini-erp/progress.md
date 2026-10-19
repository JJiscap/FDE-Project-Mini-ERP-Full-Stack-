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
- **Wave 3:**
  - `feature/sales-orders` (08): **MERGED** (df89090).
    - Sonnet confirmed. One test was changed after red: a fixture date moved from UTC to Bangkok, assertions unchanged, so it was accepted.
    - The merged review run: 322 backend tests and 117 frontend tests pass; build and `check:bundle` are clean.
    - API: `/api/sales-orders` list, create, detail, PATCH customer, lines POST/PATCH/DELETE, `/cancel`. 409 messages are human-readable.
    - Quantity is capped at 1,000,000.
  - **09 confirm: RUNNING** (fresh Sonnet xhigh on `feature/sales-orders`).
    - Includes the `confirm_sales_order` migration, `POST /{id}/confirm` and the Confirm UI in `OrderActions.tsx`.
    - Also adds the end-to-end US-1 → dashboard test owed by ticket 11.
  - All old agent worktrees were removed; the branches remain on origin.
  - `feature/dashboard` (11): **MERGED** (6c7e0be).
    - Sonnet confirmed. Tests are unchanged since red (bb1a810).
    - Review worktree on main + branch: 255 backend tests and 85 frontend tests pass; typecheck, build and `check:bundle` are clean.
    - API: `GET /api/dashboard` returns `{sales_today, low_stock_count, open_invoices{count,amount}, stock_value, as_of}` for all 4 roles.
    - The UI refreshes every 30 s and on window focus.
    - Not browser-verified: the 375px layout, the amber Low stock tile, refresh across tabs.
    - The tests insert the US-1 rows directly, so after 09 an end-to-end test (confirm, then dashboard) is still owed.
- **Next:**
  - After 09 merges: start 10 (invoices, accounting, payments), then 12 (PDF), then 13 (README, which the login page already points to for the password).
  - 04 deploy as soon as `vercel whoami` succeeds.
- **Ticket 04 (deploy), part 1 MERGED** (0bb174f): `vercel.json` in Vercel **services** mode.
  - `backend` (fastapi, `app.main:app`) is public at `/api/(.*)`. The service sees the original `/api/...` path, so no code change was needed.
  - `frontend` (vite) handles everything else, with a service-level rewrite `/(.*)` → `/index.html` for deep links.
  - No bindings. The user confirmed the names, routing and absence of bindings.
  - Deploy path is the **dashboard Git import** (user's choice). The user sets the env vars in the dashboard (manual.md 1 + 11), then redeploys.
  - Part 2 (orchestrator, once the user sends the URL):
    - Smoke-test `/`, reload `/products`, and check `/api/me` returns 401 without a token.
    - Run `check:bundle` on the deployed JS.
    - Record the URL in `testing-manual.md` §0 and README.
    - Chrome MCP click-through.

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

- Waiting on the user: Vercel dashboard import, env vars and redeploy (manual.md 1 + 11), then the production URL. The CLI stays logged out, which is optional.
- `DATABASE_URL` is FIXED by the user (pooler, port 6543). A real connection was verified. The blank-`DATABASE_URL` workaround is no longer needed.
- The global git identity is set (JJiscap / vuttipat.v@gmail.com). Old commits keep the auto identity; we decided not to rewrite history.
- Frontend open items:
  - Only Nok's login was verified.
  - The real `/api/me` was not exercised yet.
  - The main JS chunk is 764 kB (acceptable for now).
  - `grep sb_secret dist` gives a false positive from the supabase-js prefix check. Use `npm run check:bundle` instead.

## Deploy

- Production URL: **https://fde-project-mini-erp-full-stack.vercel.app**. Dashboard Git import, so every push to `main` redeploys.
- Smoke test on 20 Oct, all passing:
  - Deep links serve the SPA, and `/api/me` with no token returns 401 JSON.
  - The deployed bundle contains the Supabase URL and key (the build env was set) and no server secret.
  - As Nok: `/api/me`, the dashboard (107,100.00 / low stock 1) and the "lune" search all work. Lek gets 403 on customers.
- Region fix f9bed0d sets `"regions": ["sin1"]`. Functions had defaulted to iad1, so each call took about 1.7 s. With sin1, customer search takes 0.66 s and `/api/me` 0.15 s.
- Chrome walkthrough as **Nok, 20 Oct: PASS.** The user logged in; the orchestrator does not type passwords on production.
  - Dashboard tiles are correct. The Sales nav hides Stock and Accounting, and `/stock` shows Access denied with clear copy.
  - Products: no New button for Sales, and ROB-1KG has the Low stock badge.
  - Customers: list loads. Typing "lune" in the order picker filters to Café Lune instantly.
  - `/sales-orders` shows the empty state.
  - `/new` with Café Lune and 20 × ARB-1KG shows 9,000.00 + 630.00 = **9,630.00** live. It was NOT saved; the demo data is still 0 orders, 0 invoices, counters unused.
  - Phone width: the resize is blocked by the maximized window, so pages were checked in 375 px iframes. `/`, `/products`, `/customers` and `/sales-orders/new` have no horizontal scroll, use a hamburger nav and show cards instead of tables.
  - Console: no errors.
  - Still to walk:
    - Fon (invoices and accounting, after 10).
    - Lek (stock screens, view only).
    - Somchai (product write).
    - The real Confirm, after 09, on a reset.
  - Finding: the login page says "password is in the README", but there's no README until ticket 13.
