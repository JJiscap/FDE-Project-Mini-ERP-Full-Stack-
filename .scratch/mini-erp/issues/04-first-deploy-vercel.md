# 04: First deploy to Vercel

**What to build:** The app runs at a public HTTPS URL as one Vercel project:
- the SPA at `/`, with deep links like `/products` falling back to the SPA
- FastAPI at `/api/*`

Production env vars are set without printing their values. Every push to `main` redeploys, through Git integration if possible.

**Blocked by:** 02, 03, and you running `vercel login` (manual.md step 1)

**Status:** ready-for-agent

**Branch:** `feature/deploy`

- [ ] The production URL opens the login page. Reloading `/products` directly doesn't 404.
- [ ] `GET <url>/api/me` without a token → `401` JSON. With a demo User's token → `200`.
- [ ] Logging in as a demo User works on the production URL.
- [ ] No secret key appears in the deployed JS bundle.
- [ ] The production URL is recorded in `testing-manual.md` (section 0) and README.
- [ ] Any dashboard-only steps that remain are appended to `manual.md`.
