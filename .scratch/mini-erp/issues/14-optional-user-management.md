# 14: (Optional) Admin user management

**What to build:** Only if every other ticket is merged and deployed. The Admin sees a Users screen listing everyone in the Company with their Role. The Admin can add a User (name, email, temporary password, Role) through the Supabase admin API on the server, change a User's Role, or disable a User. Every other Role gets `403`.

**Blocked by:** 02

**Status:** ready-for-agent

**Branch:** `feature/users-admin`

- [ ] Admin lists the Users → `200`. Sales, Warehouse and Accountant → `403`.
- [ ] Admin creates a Sales User. That User can log in and gets Sales permissions.
- [ ] Changing a User's Role takes effect on their next request.
- [ ] The Admin can't remove their own Admin Role (refused with a clear message).
- [ ] Screen: a Users page in the Admin-only menu. Works on a phone.
