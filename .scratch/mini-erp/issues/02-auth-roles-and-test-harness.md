# 02: Auth, Roles and the test harness

**What to build:** FastAPI knows who is calling and refuses the wrong Role, and `uv run pytest` has the fixtures every later ticket reuses.

- Token verification uses the project JWKS.
- The current User is loaded with their Role and Company.
- A role guard is reusable per endpoint.
- `GET /api/me` returns the caller's name, email, Role and Company.
- Errors are human-readable and use the spec's `{detail}` shape.
- The pytest session creates a `TEST-<runid>` Company and 4 Role Users with real tokens, gives each test a clean Company state (sample Products, Opening Stock, 3 Customers), and cleans everything up at the end (ADR-0005).

**Blocked by:** 01

**Status:** done

**Branch:** `feature/foundation-backend`

- [x] `GET /api/me` with no token → `401`. With a garbage token → `401`.
- [x] `GET /api/me` as each of the 4 Roles → `200` with the right Role and Company.
- [x] A logged-in auth user with no `users` row → `403`.
- [x] A role guard on a protected test endpoint returns `403` for a disallowed Role and `200` for an allowed one. This proves the mechanism the modules will use.
- [x] Validation errors come back as one readable message per field, not raw pydantic output.
- [x] Two pytest runs back to back both pass and leave no `TEST-*` Company behind.
- [x] Section 3 of `testing-manual.md` explains how to get a token (from `/api/me` or the browser session) and call an endpoint with curl.
