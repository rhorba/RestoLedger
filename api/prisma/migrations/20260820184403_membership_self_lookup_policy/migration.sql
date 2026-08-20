-- Design gap found during Sprint 1 execution (logged in .logs/corrections.md and reflected
-- back into docs/database-restoledger.md and docs/security-restoledger.md):
--
-- The tenant_isolation policy on tenant_membership requires app.current_tenant_id to be set,
-- which works for "who belongs to tenant X" but cannot answer "which tenants does user Y
-- belong to" — that query spans tenants by definition, so no single current_tenant_id value
-- can select the right rows.
--
-- Fix: a second, additive PERMISSIVE policy scoped ONLY to the caller's own user_id (never
-- an arbitrary user_id, never other tenants' data on any other table). Postgres OR's
-- multiple permissive policies together, so a row is visible if EITHER policy matches.
-- This does not weaken tenant isolation on ledger_entry, audit_log_entry, or
-- integration_connection — those tables have no such second policy.
CREATE POLICY own_memberships ON "tenant_membership"
  FOR SELECT
  USING (user_id = current_setting('app.current_user_id', true)::uuid);
