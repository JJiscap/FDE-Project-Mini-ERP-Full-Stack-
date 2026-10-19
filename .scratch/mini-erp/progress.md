# Progress ledger (orchestrator memory)

The orchestrator updates this file after every merge or decision and commits it. A SessionStart hook re-injects it after context compaction. Keep it under about 60 lines: state, not history.

**Demo:** Thu 22 Oct 2026, 17:00, on the deployed URL. **Repo:** JJiscap/FDE-Project-Mini-ERP-Full-Stack-

## Where we are

- **Wave 0: done.** Merged to `main` and pushed (merge commit 254354c). Includes the scenario, CLAUDE.md, GLOSSARY, ADR 0001–0006, spec, 14 tickets and manuals.
- **Wave 1: running** (Sonnet subagents in worktrees, started Tue 20 Oct):
  - `feature/foundation-backend`: tickets 01+02 (schema, seed, auth, test harness). Effort xhigh.
  - `feature/frontend-shell`: ticket 03 (app shell, design system). Effort high.
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
- Not verified: whether `DATABASE_URL` is the transaction pooler. Code uses `prepare_threshold=None` either way.

## Deploy

- Production URL: _(not yet deployed)_
