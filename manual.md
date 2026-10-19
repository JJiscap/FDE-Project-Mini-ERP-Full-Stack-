# Manual tasks (only you can do these)

Claude does everything else. Tick each box when it's done. Run commands prefixed with `!` inside the Claude Code prompt so the output lands in the session.

## Now (blocks the first deploy)

- [ ] **0. Finish `DATABASE_URL` in `.env`.** The pooler URI (port 6543) is in place, but it still contains the placeholder `[YOUR-PASSWORD]`. To swap in the real, URL-encoded password from `POSTGRES_PASSWORD` without showing it, run:
  ```
  ! python3 -c "import re,urllib.parse as u;p='.env';s=open(p).read();pw=re.search(r'^POSTGRES_PASSWORD=(.*)$',s,re.M).group(1).strip().strip('\"\'');n=re.subn(r'\[?YOUR-PASSWORD\]?',u.quote(pw,safe=''),s);open(p,'w').write(n[0]);print('replaced',n[1])"
  ```
  It prints only `replaced 1`. Local development still works without this, because the backend builds the URI itself when `DATABASE_URL` is blank. A wrong non-blank value, though, breaks it, and Vercel needs the real value.

- [ ] **1. Import the repo on Vercel (dashboard).** vercel.com → Add New → Project → import `JJiscap/FDE-Project-Mini-ERP-Full-Stack-`. Leave the root directory as the repo root: `vercel.json` there defines two services, `backend` (FastAPI, public at `/api/*`) and `frontend` (Vite SPA, everything else). Every push to `main` then redeploys.
  - **Set the env vars in step 11 BEFORE the first deploy**, or redeploy after setting them. The SPA reads the Supabase URL and key at **build** time, so a build without them can't log in.
  - The CLI (`! vercel login`) is optional. It only lets Claude read build logs and run `vercel env ls`.
- [ ] **2. Set your Git identity** so commits link to your GitHub profile. Without it, commits show `...@MacBook-Air...local`:
  ```bash
  ! git config --global user.name "Your Name"
  ! git config --global user.email "your-github-email@example.com"
  ```
  The 2 commits already made used the auto-generated identity. Ask Claude if you want them re-authored (that needs a force-push to `main`).

## Before the demo (Wed or Thu morning)

- [ ] **3. Close public sign-up in Supabase.** Dashboard → Authentication → Sign In / Providers → Email → turn off **Allow new users to sign up**. The seed script creates the demo users, and a stranger who signs up gets no role (403 everywhere), but closing sign-up is cleaner.
- [ ] **4. Add the instructors as collaborators.** GitHub → repo → Settings → Collaborators → Add people. You need their GitHub usernames.
- [ ] **5. Submit the repo link** (and the deployed URL if asked) through the course form.
- [ ] **6. Phone check.** Turn Wi-Fi off, open the production URL on mobile data, and log in once as Sales.
- [ ] **7. Reset the demo data** on Thu before 17:00 (ask Claude, or run `cd backend && uv run python -m scripts.reset_demo`). Café Lune's order then produces `SO-0001` and `INV-0001` live.
- [ ] **8. Record a backup video** of the US-1 flow (Sales → confirm → invoice → Accountant payment → dashboard) in case the network fails.
- [ ] **9. Rehearse** the 7-minute demo with a timer (script in `testing-manual.md`).
- [ ] **10. Log in before your turn** on the deployed URL, not `localhost`.

## Found while building (Wave 1)

- [ ] **11. Vercel environment variables.** In the import screen's "Environment Variables" section (or later: Project → Settings → Environment Variables), add these for **Production and Preview**. Copy each value from your local `.env`; don't paste them into the chat. Services share one set of project env vars:
  - `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, used by the frontend build and the API.
  - `SUPABASE_JWKS_URL`, used by the API.
  - `DATABASE_URL`, used by the API: the pooler URI with the real password (port 6543).
  - **Do not add** `SUPABASE_SECRET_KEY`, `POSTGRES_PASSWORD` or `SUPABASE_ACCESS_TOKEN`. Only the local seed script and MCP use them.
  - After adding them, Deployments → ⋯ → **Redeploy**. Then send Claude the production URL.
- [ ] **12. (Optional) Leaked password protection.** The Supabase security advisor shows one WARN, "Leaked Password Protection Disabled". It's a dashboard-only switch and may need a paid plan: Authentication → Sign In / Providers → Email → Password security. The demo passwords are shared on purpose, so this is cosmetic. Nothing at ERROR level remains.

## Found while building (Wave 2, customers)

- [ ] **12a. Let Claude walk the UI in Chrome.** Claude may not type passwords into the production site, so this needs you:
  1. Connect the Claude in Chrome extension (https://claude.ai/chrome), signed in with the same account as Claude Code.
  2. Open https://fde-project-mini-erp-full-stack.vercel.app/login and log in yourself, as Nok first.
  3. Tell Claude "logged in". Claude then clicks through every screen at desktop and phone width and reads the console. For other roles, log out and log in as Fon, Lek or Somchai when Claude asks.
- [ ] **13. Click through the Customers screens once in a real browser.** The agent could not log in to check them visually. Follow `testing-manual.md` section 4 at desktop width and at 375 px: search, pager, New / Edit / Deactivate as Nok, read-only view as Fon.
