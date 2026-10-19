# Siam Bean Co. Mini ERP

Course project CU FDE3. Demo: Thu 22 Oct 2026, 17:00, on the deployed URL. Solo build, orchestrated by Claude.

## Sources of truth (read before working)

- `docs/scenario.md` is the business brief. **The scenario wins** over any other note, including the course slides in `CU FDE3 *.md`. Do not invent rules.
- `GLOSSARY.md` holds the domain vocabulary; use its terms in code, tests and UI. `docs/adr/` holds the decisions; flag a conflict, don't silently override one.
- The spec is `.scratch/mini-erp/spec.md` (it includes the role matrix). Tickets are `.scratch/mini-erp/issues/NN-*.md`.

## Stack

- DB: Supabase Postgres + Auth (project ref in `.env`).
- Backend: Python FastAPI with `uv`, psycopg3 on `DATABASE_URL` (transaction pooler, so disable prepared statements: `prepare_threshold=None`).
- Frontend: React + TypeScript + Vite, Tailwind, shadcn/ui, react-router, supabase-js (login and session only).
- Deploy: Vercel, one project. SPA at `/`, FastAPI at `/api/*` (same origin, no CORS).

## Commands

- Backend: `cd backend && uv sync`, `uv run pytest`, `uv run fastapi dev app/main.py`
- Frontend: `cd frontend && npm i`, `npm run dev`, `npm run build`, `npm run typecheck`, `npm test`
- Seed / reset demo data: `cd backend && uv run python -m scripts.seed`, `uv run python -m scripts.reset_demo`
- `uv` lives in `~/.local/bin`. Add it to `PATH` if a shell can't find it.

## Orchestration

- The main session is the orchestrator: it plans, spawns subagents, reviews, merges and verifies. It does not implement features itself.
- Spawn subagents only with `model: "sonnet"` and `effort: "high"`. Use `"xhigh"` for schema, auth and confirm-order work. Use `isolation: "worktree"`. Run at most 3 at once.
- Design/UI subagents use the skills `vercel:shadcn`, `design:design-system`, `design:ux-copy`, `design:accessibility-review`, `design:design-critique` and `vercel:react-best-practices`.
- When unsure, check with MCP before guessing:
  - **Supabase MCP:** `list_tables`, `execute_sql` (read-only checks), `apply_migration` (all DDL), `get_advisors` after every migration, `search_docs`.
  - **context7:** library docs (FastAPI, psycopg, Vite, shadcn, supabase-js).
  - **Vercel skills:** deploys.
- Append any step only a human can do (logins, dashboards, accounts, forms) to `manual.md`. Append how to test a finished feature by hand to `testing-manual.md`.

## Git rules

- **One branch per main feature or per subagent:** `feature/<module>`, `fix/<topic>`, `docs/<topic>`. Never commit feature work directly on `main`.
- **Commit every time a task or ticket step is finished.** Keep messages small and imperative: `test(stock): reject stock-out below zero (red)`, then `feat(stock): ...`.
- Red tests are committed before the implementation, with the failing pytest output in the commit body.
- Merging is done by the orchestrator. It runs the tests and build on the branch, then `git switch main && git merge --no-ff feature/x && git push origin main`. Push feature branches too.
- Run `git status` before every commit. Never stage `.env`, `node_modules`, `.venv` or build output.

## Business rules (enforced in the DB or API, never only in the UI)

1. VAT is 7%. The order line stores the unit price without VAT. The invoice stores subtotal, VAT (`round(subtotal * 0.07, 2)`) and total. Use `Decimal` and `numeric(12,2)`, never floats.
2. Stock can never go negative. A DB trigger enforces it, and so does the confirm function. A failed confirm changes nothing: `409 Not enough stock for <SKU>`.
3. Stock on hand is the sum of `stock_movements`. There is no quantity column; nobody types stock.
4. `SO-0001` and `INV-0001` numbers come from `doc_counters` inside the same transaction. They are sequential per company and never reused or edited.
5. Confirming an order creates the movements, the invoice and the status change in one DB function (`confirm_sales_order`): all or nothing.
6. Price and cost are copied onto `order_items`. Changing a product price never touches old orders or invoices.
7. Products and customers are deactivated, never deleted. Orders are cancelled, never deleted.
8. Roles are checked on the server: wrong role returns `403`, no token returns `401`. The role matrix is in the spec.
9. Validation: price ≥ 0, quantity > 0, SKU unique per company, customer tax ID required. Error messages say what to fix ("Price must be 0 or more").

- Every business table has `company_id`, `created_by`, `created_at` and `updated_at`. Every query filters by the current user's `company_id`.
- Dates use the `Asia/Bangkok` timezone (for "sales today").

## Database rules

- All DDL goes through Supabase MCP `apply_migration`. Save the same SQL to `supabase/migrations/<timestamp>_<name>.sql`. Never edit an applied migration; add a new one.
- RLS is enabled on every table with no policies (only FastAPI talks to the DB).
- Functions are `security invoker`, with execute revoked from `public, anon, authenticated`. Views use `security_invoker = true`, with select revoked from `anon, authenticated`.
- Destructive SQL only ever targets `TEST-*` companies. Demo data changes only through `scripts/reset_demo`.

## Testing rules (TDD, see the `tdd` skill)

- Tests come first, at the HTTP seam (FastAPI `TestClient`). Show red, then green. Never edit, weaken or delete a test to make it pass.
- The pytest session creates its own `TEST-<runid>` company and 4 role users, then cleans up. Tests never touch the Siam Bean demo company.
- Expected values come from the scenario (170 → 150 kg; 9,000.00 + 630.00 = 9,630.00), never recomputed the way the code computes them.
- Before reporting done, run the full `uv run pytest`. If the frontend changed, also run `npm run typecheck && npm run build`.

## Frontend rules

- Money is always shown as `9,630.00 THB` (`formatTHB`). Quantities carry their unit (`150 kg`).
- Every list has an empty state ("No customers yet"). Every error shows the API's message, never just "Error".
- Mobile first: the app works at phone width with no horizontal scroll.
- Navigation hides what a role can't do, but the server enforces it. A direct URL to a forbidden screen shows the Access denied page.
- Only the Supabase URL and the publishable key reach the browser. `vite.config.ts` maps them explicitly. Never use an env prefix that could expose `SUPABASE_SECRET_KEY` or `DATABASE_URL`.

## Secrets

- `.env` lives at the repo root and is git-ignored. `.env.example` holds names only. Never print, paste or commit key values, not even prefixes.

## Definition of done (per ticket)

A ticket is done when all of these hold:
- Its acceptance criteria pass in tests, and red was seen first.
- The UI works at phone width.
- `testing-manual.md` is updated.
- The work is committed on its feature branch.
- The orchestrator has merged it, and the deployed URL still works.

## Agent skills

### Issue tracker

Local markdown under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The default five labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
