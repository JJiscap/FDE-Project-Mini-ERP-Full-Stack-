# 03: App shell (login, Role-aware menu, design system)

**What to build:** The frontend every module plugs into:
- a Vite + React + TS app with Tailwind and shadcn/ui and a calm, professional look for a small business
- a Login page (Supabase email and password) with a persisted session and logout
- a layout with a Role-aware menu (Dashboard, Products, Customers, Sales Orders, Stock, Invoices, Accounting): a sidebar on desktop, a drawer on phones, showing the User's name and Role
- an Access denied page
- placeholder pages per module
- shared helpers: an API client that attaches the token and surfaces `{detail}` messages, `formatTHB` (`9,630.00 THB`), quantity with unit, Bangkok date formatting
- shared components: empty state, error banner, page header, a status badge (Draft, Confirmed, Cancelled, Open, Paid, Overdue, Low stock)

Only the Supabase URL and the publishable key reach the browser, mapped explicitly in `vite.config.ts` from the root `.env`.

**Blocked by:** None (can start immediately, in parallel with 01–02; use `/api/me` as specified in the spec)

**Status:** ready-for-agent

**Branch:** `feature/frontend-shell`

- [ ] A demo User can log in, reload and stay logged in, and log out.
- [ ] The menu shows only the screens the User's Role may use (spec role matrix). A direct URL to a forbidden screen shows Access denied.
- [ ] A `403` from the API on any page shows the Access denied page. A `401` sends the user back to Login.
- [ ] `formatTHB(9630)` → `9,630.00 THB`, tested with Vitest. Quantities show their unit (`150 kg`).
- [ ] The layout works at 375 px wide with no horizontal scroll.
- [ ] `npm run typecheck`, `npm run build` and `npm test` pass. The built bundle doesn't contain the secret key.
- [ ] Each module has a stub route and page, so later tickets edit only their own folder.
