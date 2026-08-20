-- Row-Level Security: defense-in-depth tenant isolation (ADR-2, architecture-restoledger.md)
-- The application sets `app.current_tenant_id` via `SET LOCAL` at the start of every
-- tenant-scoped request/transaction (see PrismaService.forTenant). If the app-layer
-- middleware ever has a bug, these policies still block cross-tenant reads/writes.

ALTER TABLE "tenant_membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_membership" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_membership"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "ledger_entry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ledger_entry" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ledger_entry"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "audit_log_entry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log_entry" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "audit_log_entry"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "integration_connection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_connection" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "integration_connection"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- FORCE ROW LEVEL SECURITY makes policies apply even to the table owner. Without it, RLS is a
-- no-op for the role that ran `prisma migrate` (owners bypass RLS by default in Postgres).
-- The running app must ALSO connect as a non-superuser role (see restoledger_app below) —
-- FORCE RLS does not stop a superuser from bypassing policies, only table owners.

-- Non-superuser runtime role: the app connects as this role (APP_DATABASE_URL), not as the
-- migration-owner role (DATABASE_URL). Grants are scoped to what the app actually needs:
-- no UPDATE/DELETE on ledger_entry or audit_log_entry — append-only is enforced at the DB
-- grant level too, not just by "no endpoint exists" (ADR-3, architecture-restoledger.md).
-- SECURITY: 'restoledger_app_dev_only' is a LOCAL-DEV-ONLY password, intentionally committed
-- because local dev secrets aren't sensitive. In staging/production this migration still
-- creates the role, but the password MUST be rotated immediately after deploy via
-- `ALTER ROLE restoledger_app PASSWORD '<from secret manager>';` — never rely on the value
-- baked into migration history for a real environment (devops-restoledger.md §3).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'restoledger_app') THEN
    CREATE ROLE restoledger_app LOGIN PASSWORD 'restoledger_app_dev_only';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO restoledger_app;

GRANT SELECT, INSERT, UPDATE ON "tenant" TO restoledger_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "tenant_membership" TO restoledger_app;
GRANT SELECT, INSERT, UPDATE ON "app_user" TO restoledger_app;
GRANT SELECT, INSERT ON "ledger_entry" TO restoledger_app;
GRANT SELECT, INSERT ON "audit_log_entry" TO restoledger_app;
GRANT SELECT, INSERT, UPDATE ON "integration_connection" TO restoledger_app;
