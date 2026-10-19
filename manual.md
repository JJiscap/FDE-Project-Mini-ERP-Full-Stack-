# Manual tasks (only you can do these)

Claude does everything else. Tick each box when it's done. Run commands prefixed with `!` inside the Claude Code prompt so the output lands in the session.

## Now (blocks the first deploy)

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

## Found while building the backend

- [ ] **11. Fill in `DATABASE_URL` in `.env` and in Vercel.** It is blank in `.env` right now. The backend still works locally (it builds the Supabase transaction pooler connection from `POSTGRES_PASSWORD` and the project ref, region `aws-0-ap-southeast-1`), but Vercel needs the real value: Supabase dashboard → Connect → **Transaction pooler** URI (port 6543), with your database password in it. Add it as the `DATABASE_URL` environment variable on the Vercel project, together with `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_JWKS_URL`.
