import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Prisma } from '../../generated/prisma/client';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { ReverseLedgerEntryDto } from './dto/reverse-ledger-entry.dto';
import { toLedgerEntryResponse } from './ledger.mapper';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Idempotent when `idempotencyKey` is provided (mobile offline queue — Story 3.3): a
   * retried POST with the same key returns the original entry instead of creating a
   * duplicate. The DB unique constraint (tenant_id, idempotency_key) is the actual
   * correctness guarantee — the upfront lookup is just an optimization to skip a doomed
   * insert; concurrent requests still race safely because the unique constraint catches it.
   */
  async createEntry(
    tenantId: string,
    actorUserId: string,
    dto: CreateLedgerEntryDto,
    idempotencyKey?: string,
  ) {
    const amountCents = BigInt(Math.round(dto.amount * 100));

    const entry = await this.prisma.withTenant(tenantId, async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.ledgerEntry.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        });
        if (existing) return existing;
      }

      try {
        const created = await tx.ledgerEntry.create({
          data: {
            tenantId,
            entryType: dto.entryType,
            amountCents,
            description: dto.description,
            occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
            createdByUserId: actorUserId,
            idempotencyKey,
          },
        });

        await this.audit.record(tx, {
          tenantId,
          actorUserId,
          action: 'ledger_entry.create',
          entityType: 'ledger_entry',
          entityId: created.id,
          afterState: { entryType: created.entryType, amountCents: created.amountCents.toString() },
        });

        return created;
      } catch (err) {
        if (
          idempotencyKey &&
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === UNIQUE_CONSTRAINT_VIOLATION
        ) {
          // Lost the race to a concurrent request with the same key — that request's entry
          // is the canonical one; return it instead of erroring the retry.
          const winner = await tx.ledgerEntry.findUnique({
            where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
          });
          if (winner) return winner;
        }
        throw err;
      }
    });

    return toLedgerEntryResponse(entry);
  }

  async listEntries(tenantId: string, cursor?: string, take = 50) {
    const entries = await this.prisma.withTenant(tenantId, (tx) =>
      tx.ledgerEntry.findMany({
        where: { tenantId },
        orderBy: { occurredAt: 'desc' },
        take: Math.min(take, 100),
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
    );

    return entries.map(toLedgerEntryResponse);
  }

  async reverseEntry(
    tenantId: string,
    actorUserId: string,
    entryId: string,
    dto: ReverseLedgerEntryDto,
  ) {
    const reversal = await this.prisma.withTenant(tenantId, async (tx) => {
      const original = await tx.ledgerEntry.findUnique({ where: { id: entryId } });
      if (!original || original.tenantId !== tenantId) {
        throw new NotFoundException('Ledger entry not found');
      }
      if (original.reversalOfId) {
        throw new BadRequestException('Cannot reverse a reversal entry');
      }

      const created = await tx.ledgerEntry.create({
        data: {
          tenantId,
          entryType: original.entryType,
          amountCents: -original.amountCents,
          description: `Reversal: ${dto.reason}`,
          occurredAt: new Date(),
          reversalOfId: original.id,
          createdByUserId: actorUserId,
        },
      });

      await this.audit.record(tx, {
        tenantId,
        actorUserId,
        action: 'ledger_entry.reverse',
        entityType: 'ledger_entry',
        entityId: created.id,
        beforeState: { originalEntryId: original.id, originalAmountCents: original.amountCents.toString() },
        afterState: { reason: dto.reason, amountCents: created.amountCents.toString() },
      });

      return created;
    });

    return toLedgerEntryResponse(reversal);
  }
}
