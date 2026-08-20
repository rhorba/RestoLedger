-- Story 4.1 (POS/payment integration)

-- Needed for connect()'s upsert — one active connection per (tenant, provider).
CREATE UNIQUE INDEX "uq_integration_tenant_provider" ON "integration_connection"("tenant_id", "provider");

-- The webhook lookup problem: to verify a webhook's signature we must first read the
-- connection's secret, but we don't know the tenant yet — that's what this lookup exists to
-- establish. integration_connection's tenant_isolation RLS policy blocks that (same shape as
-- the "list my tenants" problem from migration 20260820184403, but here there is no
-- authenticated user session to key a second policy off of — the caller is an anonymous
-- webhook, authenticated only by knowing the unguessable connection id and the eventual
-- signature check).
--
-- Fix: a SECURITY DEFINER function. It runs with the privileges of its owner (bypassing RLS
-- internally) but is intentionally narrow — exact id + provider + active status match only,
-- never an open-ended query — so it cannot be used to enumerate or leak other tenants' rows.
-- This is the standard, correct Postgres pattern for this exact "break glass before we know
-- the tenant" situation; a blanket RLS bypass on the table would not be.
CREATE FUNCTION lookup_integration_connection_for_webhook(
  p_connection_id uuid,
  p_provider text
)
RETURNS SETOF integration_connection
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM integration_connection
  WHERE id = p_connection_id
    AND provider = p_provider
    AND status = 'active';
$$;

-- restoledger_app may EXECUTE the function (bypassing RLS through this narrow door) but
-- still has no ability to SELECT integration_connection directly outside a tenant-scoped
-- transaction — the table-level RLS grant is unchanged.
GRANT EXECUTE ON FUNCTION lookup_integration_connection_for_webhook(uuid, text) TO restoledger_app;
