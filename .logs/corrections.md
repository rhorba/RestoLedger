## CORRECTION — 2026-08-20 — Sprint 1 EXECUTE
**Found by**: e2e test suite (test/tenant-isolation.e2e-spec.ts), not code review — the "mine" and pagination tests started failing with `invalid input syntax for type uuid: ""` after the RLS migration was in place.

**Root cause**: Postgres `set_config(name, value, is_local=true)` is transaction-scoped, but the first time a custom GUC (e.g. `app.current_tenant_id`) is set on a physical connection, Postgres creates a permanent placeholder for it. After that transaction commits, `current_setting(name, true)` on a connection-pooled session reverts to `''` (empty string), not `NULL`. Prisma's driver adapter reuses physical connections across separate `$transaction` calls, so a later transaction that sets only ONE of `app.current_tenant_id` / `app.current_user_id` would find the other holding `''`, and `''::uuid` is an invalid cast — the whole RLS-protected query fails, not just "matches nothing".

**Fix**: `PrismaService.withTenant` and `.withUser` (src/prisma/prisma.service.ts) now explicitly set BOTH session variables on every transaction — the relevant one to the real id, the other to a nil-UUID sentinel (`00000000-...-0000`). Closes the pooling leak regardless of connection reuse history.

**Docs updated**: database-restoledger.md and security-restoledger.md RLS sections should carry a note about this pattern for anyone adding a third `app.*` session-scoped GUC later — don't assume unset means NULL on a pooled connection.
