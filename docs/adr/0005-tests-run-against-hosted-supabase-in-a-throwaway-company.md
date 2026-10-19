# Tests run against the hosted Supabase project, inside a throwaway Company

The API tests (`uv run pytest`) need real Postgres behaviour (the confirm function, triggers, constraints) and real Supabase JWTs to prove the `401`/`403` rules. There is one hosted Supabase project and no budget or time for branches or a local Supabase stack.

So each pytest session:
- creates its own Company named `TEST-<runid>`
- creates 4 Supabase Auth users, one per Role, and signs them in for real tokens
- runs every test against a clean state of that Company
- deletes the Company's rows and the auth users at the end

Because every query is filtered by Company, the Siam Bean demo data is never touched. Parallel agents running tests at the same time don't collide.

## Consequences

- Tests need network access and the keys in `.env`.
- A crashed run can leave a `TEST-*` Company behind. It's invisible to demo Users and safe to delete.
