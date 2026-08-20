## CORRECTION — 2026-08-20 — Sprint 1 EXECUTE
**Found by**: e2e test suite (test/tenant-isolation.e2e-spec.ts), not code review — the "mine" and pagination tests started failing with `invalid input syntax for type uuid: ""` after the RLS migration was in place.

**Root cause**: Postgres `set_config(name, value, is_local=true)` is transaction-scoped, but the first time a custom GUC (e.g. `app.current_tenant_id`) is set on a physical connection, Postgres creates a permanent placeholder for it. After that transaction commits, `current_setting(name, true)` on a connection-pooled session reverts to `''` (empty string), not `NULL`. Prisma's driver adapter reuses physical connections across separate `$transaction` calls, so a later transaction that sets only ONE of `app.current_tenant_id` / `app.current_user_id` would find the other holding `''`, and `''::uuid` is an invalid cast — the whole RLS-protected query fails, not just "matches nothing".

**Fix**: `PrismaService.withTenant` and `.withUser` (src/prisma/prisma.service.ts) now explicitly set BOTH session variables on every transaction — the relevant one to the real id, the other to a nil-UUID sentinel (`00000000-...-0000`). Closes the pooling leak regardless of connection reuse history.

**Docs updated**: database-restoledger.md and security-restoledger.md RLS sections should carry a note about this pattern for anyone adding a third `app.*` session-scoped GUC later — don't assume unset means NULL on a pooled connection.

## CORRECTION — 2026-08-20 — Sprint 3 EXECUTE
**Found by**: e2e test failures (500 errors) immediately after adding the idempotency-key feature, not code review.

**Root cause**: Ran `prisma migrate dev --create-only --name ledger_entry_idempotency_key` BEFORE editing schema.prisma (habit from checking the tool's behavior), which produced an empty migration since there was no diff yet. Editing schema.prisma afterward and re-running `prisma migrate dev` picked up that already-created empty migration folder instead of generating a new one with the real diff, and Prisma recorded it as "applied" — leaving the DB missing the `idempotency_key` column while `prisma migrate status` reported "up to date."

**Fix**: New migration `20260820200500_ledger_entry_idempotency_key_fix` with the actual `ALTER TABLE ADD COLUMN` + unique index, applied via `prisma migrate deploy` (this environment's non-interactive shell doesn't support `migrate dev`'s confirmation prompts — `deploy` is now the reliable path for applying migrations here, `dev`+`--create-only` only for generating the file when schema.prisma is already edited).

**Lesson**: edit schema.prisma FIRST, then run `migrate dev --create-only` — never the reverse order.

## CORRECTION — 2026-08-20 — Sprint 3 EXECUTE (mobile offline queue tests)
**Found by**: writing offline-queue.spec.ts — every test after the first failed with 0 calls to the mocked API.

**Root cause**: `offline-queue.ts`'s `enqueueEntry` fires a background `trySync()` call it deliberately does NOT await (offline-first UX — enqueue must never block on network). The module-level `syncing` lock is set synchronously the instant `trySync()` is called, before any `await`. The first test used a `postLedgerEntry` mock that never resolves, so that fire-and-forget sync's promise chain never reached its `finally { syncing = false }` — `syncing` stayed `true` for the rest of the test file, silently no-opping every subsequent `trySync()` call.

**Fix**: never leave a mocked async dependency permanently unresolved in a test that exercises code with a fire-and-forget background call — it leaks module-level state across tests since Jest doesn't reset the module between `it()` blocks in the same file. Sync-behavior tests now seed the queue directly via AsyncStorage instead of going through `enqueueEntry` (avoids its internal fire-and-forget call entirely).
