import { ReportingService } from './reporting.service';

describe('ReportingService', () => {
  let prisma: any;
  let tx: any;
  let service: ReportingService;

  beforeEach(() => {
    tx = { ledgerEntry: { groupBy: jest.fn() } };
    prisma = { withTenant: jest.fn((_tenantId: string, fn: (tx: unknown) => unknown) => fn(tx)) };
    service = new ReportingService(prisma);
  });

  it('computes cash position as revenue minus expenses', async () => {
    tx.ledgerEntry.groupBy.mockResolvedValue([
      { entryType: 'revenue', _sum: { amountCents: 500000n } },
      { entryType: 'expense', _sum: { amountCents: 120000n } },
    ]);

    const result = await service.getDashboardSummary('t1');

    expect(result.today).toEqual({ revenue: '5000.00', expenses: '1200.00', cashPosition: '3800.00' });
  });

  it('defaults to zero when a tenant has no entries in the period', async () => {
    tx.ledgerEntry.groupBy.mockResolvedValue([]);

    const result = await service.getDashboardSummary('t1');

    expect(result.today).toEqual({ revenue: '0.00', expenses: '0.00', cashPosition: '0.00' });
  });

  it('produces a negative cash position when expenses exceed revenue', async () => {
    tx.ledgerEntry.groupBy.mockResolvedValue([
      { entryType: 'revenue', _sum: { amountCents: 1000n } },
      { entryType: 'expense', _sum: { amountCents: 5000n } },
    ]);

    const result = await service.getDashboardSummary('t1');

    expect(result.today.cashPosition).toBe('-40.00');
  });

  it('queries today, this week, and this month independently', async () => {
    tx.ledgerEntry.groupBy.mockResolvedValue([]);

    await service.getDashboardSummary('t1');

    expect(prisma.withTenant).toHaveBeenCalledTimes(3);
  });
});
