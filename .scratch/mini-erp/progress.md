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
  - `feature/foundation-backend` (tickets 01+02): **running.** Effort xhigh.
- **Next:** review and merge Wave 1, then 04 deploy (needs the user's `vercel login`). Then Wave 2: 05, 06, 07 in parallel.

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

- Waiting on the user: `vercel login` and the git identity (manual.md steps 1–2).
- **`DATABASE_URL` is EMPTY in `.env`.** The user must paste the transaction pooler URI themselves (manual.md step 0). The backend agent may report this as blocking.
- Frontend open items:
  - Only Nok's login was verified.
  - The real `/api/me` was not exercised yet.
  - The main JS chunk is 764 kB (acceptable for now).
  - `grep sb_secret dist` gives a false positive from the supabase-js prefix check. Use `npm run check:bundle` instead.

## Deploy

- Production URL: _(not yet deployed)_
