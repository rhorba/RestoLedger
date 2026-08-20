-- Story 4.1 (POS/payment integration): webhook-driven ledger entries have no human actor.
-- Null means "the system", not "unknown/missing" — see schema.prisma comments.

-- DropForeignKey
ALTER TABLE "audit_log_entry" DROP CONSTRAINT "audit_log_entry_actor_user_id_fkey";

-- DropForeignKey
ALTER TABLE "ledger_entry" DROP CONSTRAINT "ledger_entry_created_by_user_id_fkey";

-- AlterTable
ALTER TABLE "audit_log_entry" ALTER COLUMN "actor_user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ledger_entry" ALTER COLUMN "created_by_user_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log_entry" ADD CONSTRAINT "audit_log_entry_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
