# Manual tasks (only you can do these)

Claude does everything else. Tick each box when it's done. Run commands prefixed with `!` inside the Claude Code prompt so the output lands in the session.

## Now (blocks the first deploy)

- [ ] **0. Fill in `DATABASE_URL` in `.env` (urgent: the backend needs it).** The line exists but is empty. In the Supabase dashboard open **Connect** (top bar) → **Connection string** → **Transaction pooler** (port **6543**). Copy the URI, replace `[YOUR-PASSWORD]` with your database password (the same value as `POSTGRES_PASSWORD`), and paste it after `DATABASE_URL=` in the repo-root `.env`. Do it in your editor and **don't paste it into the chat**. Then tell Claude "DATABASE_URL done".

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

## Frontend (ticket 03)

- [ ] **11. Vercel env vars.** In the Vercel project add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (Production and Preview). The frontend build reads exactly these two names. The secret key and `DATABASE_URL` belong only to the API function.
- [ ] **12. Check the demo emails on the Login page.** The "Demo accounts" box fills `somchai@`, `nok@`, `lek@`, `fon@` + `siambean.test`. Only `nok@` was confirmed to exist when this was built. If the seed uses different emails, edit `DEMO_ACCOUNTS` in `frontend/src/pages/login/index.tsx`.
