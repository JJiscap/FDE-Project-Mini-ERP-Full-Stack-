# Supabase Auth for identity, Roles enforced in FastAPI, browser never touches tables

Users log in with Supabase Auth (email and password) through supabase-js, using the publishable key. That is the only thing the browser does with Supabase. Every data request goes to FastAPI with the user's access token. FastAPI:

1. verifies the token against the project's JWKS
2. loads the User's Role and Company from `public.users`
3. returns `401` (no or invalid token) or `403` (wrong Role, or no `users` row) before touching data

FastAPI talks to Postgres over `DATABASE_URL`, as the server role. RLS is enabled on every table with **no policies**, and functions and views are revoked from `anon` and `authenticated`. As a result, the publishable key in the browser can read nothing directly, even if the frontend has a bug.

## Considered options

- **RLS policies per Role, with the frontend querying Supabase directly.** Rejected: business rules and Role checks would be split between SQL policies and the UI. The course requires the API itself to return `403` to the wrong Role.
