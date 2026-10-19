# Manual tasks (only you can do these)

Claude does everything else. Tick each box when it's done. Run commands prefixed with `!` inside the Claude Code prompt so the output lands in the session.

## Now (blocks the first deploy)

- [ ] **0. Finish `DATABASE_URL` in `.env`.** The pooler URI (port 6543) is in place, but it still contains the placeholder `[YOUR-PASSWORD]`. To swap in the real, URL-encoded password from `POSTGRES_PASSWORD` without showing it, run:
  ```
  ! python3 -c "import re,urllib.parse as u;p='.env';s=open(p).read();pw=re.search(r'^POSTGRES_PASSWORD=(.*)$',s,re.M).group(1).strip().strip('\"\'');n=re.subn(r'\[?YOUR-PASSWORD\]?',u.quote(pw,safe=''),s);open(p,'w').write(n[0]);print('replaced',n[1])"
  ```
  It prints only `replaced 1`. Local development still works without this, because the backend builds the URI itself when `DATABASE_URL` is blank. A wrong non-blank value, though, breaks it, and Vercel needs the real value.

- [ ] **1. Log in to Vercel.** Run `! vercel login` and finish the browser sign-in. If Vercel asks to connect GitHub, allow access to `JJiscap/FDE-Project-Mini-ERP-Full-Stack-` so every push to `main` redeploys.
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

- [ ] **11. Vercel environment variables.** The deploy ticket (04) will try to set these with the Vercel CLI after your `vercel login`, without printing them. Only if that fails, add them yourself in the Vercel dashboard → Project → Settings → Environment Variables (Production and Preview):
  - Frontend build: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.
  - API function: `DATABASE_URL` (the pooler URI from step 0, with the real password), `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_JWKS_URL`.
  - `SUPABASE_SECRET_KEY` is only used by the local seed script and is not needed on Vercel.
- [ ] **12. (Optional) Leaked password protection.** The Supabase security advisor shows one WARN, "Leaked Password Protection Disabled". It's a dashboard-only switch and may need a paid plan: Authentication → Sign In / Providers → Email → Password security. The demo passwords are shared on purpose, so this is cosmetic. Nothing at ERROR level remains.
