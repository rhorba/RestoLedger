-- Fix for the empty 20260820195646_ledger_entry_idempotency_key migration: that migration was
-- accidentally created via `prisma migrate dev --create-only` BEFORE schema.prisma was edited,
-- so it captured no diff and was already recorded as "applied" against an unmodified DB. This
-- migration actually adds the column (logged in .logs/corrections.md).

ALTER TABLE "ledger_entry" ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "uq_ledger_tenant_idempotency" ON "ledger_entry"("tenant_id", "idempotency_key");
