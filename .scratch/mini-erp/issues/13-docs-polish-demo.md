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
