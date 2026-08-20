import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService, TenantScopedTx } from '../prisma/prisma.service';

export interface RecordAuditEntryInput {
  tenantId: string;
  /** null = system-triggered action (e.g. a POS webhook), not "unknown actor". */
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: Prisma.InputJsonValue | null;
  afterState?: Prisma.InputJsonValue | null;
}

/**
 * Takes an already-tenant-scoped transaction client (`tx` from PrismaService.withTenant) —
 * never opens its own connection/transaction. This guarantees the audit write commits or
 * rolls back atomically with the mutation it's recording (security-restoledger.md §7: "not
 * best-effort, not async").
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(tx: TenantScopedTx, input: RecordAuditEntryInput) {
    await tx.auditLogEntry.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeState: input.beforeState ?? Prisma.JsonNull,
        afterState: input.afterState ?? Prisma.JsonNull,
      },
    });
  }

  async list(tenantId: string, cursor?: string, take = 50) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.auditLogEntry.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: Math.min(take, 100),
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
    );
  }
}
