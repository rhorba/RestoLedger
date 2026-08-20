import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { LedgerService } from './ledger.service';

describe('LedgerService', () => {
  let prisma: any;
  let audit: any;
  let tx: any;
  let service: LedgerService;

  beforeEach(() => {
    tx = {
      ledgerEntry: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };
    prisma = {
      withTenant: jest.fn((_tenantId: string, fn: (tx: unknown) => unknown) => fn(tx)),
    };
    audit = { record: jest.fn() };
    service = new LedgerService(prisma, audit);
  });

  describe('createEntry', () => {
    it('converts a decimal MAD amount to integer cents (no float drift)', async () => {
      tx.ledgerEntry.create.mockResolvedValue({
        id: 'e1',
        amountCents: 42050n,
        entryType: 'revenue',
      });

      await service.createEntry('t1', 'u1', {
        entryType: 'revenue',
        amount: 420.5,
        description: 'Lunch',
      } as any);

      expect(tx.ledgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amountCents: 42050n }) }),
      );
    });

    it('writes an audit log entry in the same transaction as the ledger write', async () => {
      tx.ledgerEntry.create.mockResolvedValue({ id: 'e1', amountCents: 100n, entryType: 'revenue' });

      await service.createEntry('t1', 'u1', { entryType: 'revenue', amount: 1 } as any);

      expect(audit.record).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ action: 'ledger_entry.create', entityId: 'e1' }),
      );
    });

    it('replays the existing entry for a repeated idempotency key instead of creating a duplicate', async () => {
      tx.ledgerEntry.findUnique.mockResolvedValue({
        id: 'existing',
        amountCents: 100n,
        entryType: 'revenue',
        idempotencyKey: 'key-1',
      });

      const result = await service.createEntry(
        't1',
        'u1',
        { entryType: 'revenue', amount: 1 } as any,
        'key-1',
      );

      expect(tx.ledgerEntry.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
      expect(result.id).toBe('existing');
    });

    it('stores the idempotency key on first creation', async () => {
      tx.ledgerEntry.findUnique.mockResolvedValue(null);
      tx.ledgerEntry.create.mockResolvedValue({ id: 'e1', amountCents: 100n, entryType: 'revenue' });

      await service.createEntry('t1', 'u1', { entryType: 'revenue', amount: 1 } as any, 'key-2');

      expect(tx.ledgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ idempotencyKey: 'key-2' }) }),
      );
    });

    it('returns the winning entry instead of throwing when a concurrent request wins the unique-constraint race', async () => {
      tx.ledgerEntry.findUnique
        .mockResolvedValueOnce(null) // initial lookup: not found yet
        .mockResolvedValueOnce({ id: 'winner', amountCents: 100n, entryType: 'revenue' }); // re-query after conflict

      const conflictError = Object.create(Prisma.PrismaClientKnownRequestError.prototype);
      conflictError.code = 'P2002';
      tx.ledgerEntry.create.mockRejectedValue(conflictError);

      const result = await service.createEntry(
        't1',
        'u1',
        { entryType: 'revenue', amount: 1 } as any,
        'key-3',
      );

      expect(result.id).toBe('winner');
    });
  });

  describe('reverseEntry', () => {
    it('creates an offsetting entry with the negated amount, linked via reversalOfId', async () => {
      tx.ledgerEntry.findUnique.mockResolvedValue({
        id: 'orig',
        tenantId: 't1',
        entryType: 'revenue',
        amountCents: 42050n,
        reversalOfId: null,
      });
      tx.ledgerEntry.create.mockResolvedValue({ id: 'rev', amountCents: -42050n, entryType: 'revenue' });

      await service.reverseEntry('t1', 'u1', 'orig', { reason: 'typo' });

      expect(tx.ledgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amountCents: -42050n,
            reversalOfId: 'orig',
            entryType: 'revenue',
          }),
        }),
      );
    });

    it('rejects reversing an entry that does not belong to this tenant', async () => {
      tx.ledgerEntry.findUnique.mockResolvedValue({
        id: 'orig',
        tenantId: 'other-tenant',
        amountCents: 100n,
        reversalOfId: null,
      });

      await expect(
        service.reverseEntry('t1', 'u1', 'orig', { reason: 'typo' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects reversing a reversal', async () => {
      tx.ledgerEntry.findUnique.mockResolvedValue({
        id: 'rev',
        tenantId: 't1',
        amountCents: -100n,
        reversalOfId: 'orig',
      });

      await expect(
        service.reverseEntry('t1', 'u1', 'rev', { reason: 'typo' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('404s on a nonexistent entry', async () => {
      tx.ledgerEntry.findUnique.mockResolvedValue(null);

      await expect(
        service.reverseEntry('t1', 'u1', 'nope', { reason: 'typo' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
