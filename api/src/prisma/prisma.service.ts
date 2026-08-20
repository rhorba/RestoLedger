import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

export type TenantScopedTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

// Never a real id (Prisma generates random v4 UUIDs). Used to explicitly clear the GUC we're
// NOT setting in a given transaction — see the comment on withTenant/withUser below for why
// this is required, not just defensive.
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * The app connects as `restoledger_app` (non-superuser, RLS-subject role — see
 * prisma/migrations/*_row_level_security), never as the migration-owner role. This is what
 * makes Postgres RLS an actual defense-in-depth layer instead of a no-op (ADR-2).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    const connectionString = config.getOrThrow<string>('APP_DATABASE_URL');
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Runs `fn` inside a transaction with the Postgres session variable
   * `app.current_tenant_id` set via `set_config` (parameterized — not string-built SQL).
   * RLS policies key off this variable. Every tenant-scoped read/write MUST go through
   * this helper — there is no other sanctioned way to touch tenant_membership, ledger_entry,
   * audit_log_entry, or integration_connection (Story 1.3, ADR-2).
   *
   * Also resets app.current_user_id to a nil sentinel — NOT optional. Prisma's connection
   * pool reuses physical connections across separate $transaction calls. `set_config(name,
   * value, true)` is transaction-LOCAL, but once a custom GUC has been set at least once on a
   * connection, Postgres creates a permanent placeholder for it; after that transaction ends,
   * current_setting() on it reverts to '' (empty string), not NULL. If a later transaction on
   * the same pooled connection only sets ONE of the two GUCs, the other evaluates to
   * ''::uuid — an invalid cast — and the RLS-protected query fails outright (found via the
   * e2e suite, not by inspection: see .logs/corrections.md).
   */
  async withTenant<T>(
    tenantId: string,
    fn: (tx: TenantScopedTx) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true), set_config('app.current_user_id', ${NIL_UUID}, true)`;
      return fn(tx);
    });
  }

  /**
   * For the one legitimate cross-tenant read: "which tenants does this user belong to"
   * (tenant_membership's `own_memberships` RLS policy — see migration
   * 20260820184403_membership_self_lookup_policy). Do not use this for anything else; every
   * other tenant-scoped table has no user-based policy and will return zero rows here.
   * Resets app.current_tenant_id to the nil sentinel for the same reason withTenant resets
   * app.current_user_id — see the comment there.
   */
  async withUser<T>(
    userId: string,
    fn: (tx: TenantScopedTx) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true), set_config('app.current_tenant_id', ${NIL_UUID}, true)`;
      return fn(tx);
    });
  }
}
