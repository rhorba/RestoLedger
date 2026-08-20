import { Injectable } from '@nestjs/common';
import { centsToAmount } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerEntryType } from '../../generated/prisma/enums';

function startOfUtcDay(from: Date): Date {
  return new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
}

function startOfUtcWeek(from: Date): Date {
  const day = startOfUtcDay(from);
  const weekday = day.getUTCDay(); // 0 = Sunday
  const diffToMonday = weekday === 0 ? 6 : weekday - 1;
  day.setUTCDate(day.getUTCDate() - diffToMonday);
  return day;
}

function startOfUtcMonth(from: Date): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
}

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardSummary(tenantId: string) {
    const now = new Date();
    const [today, week, month] = await Promise.all([
      this.summarizeSince(tenantId, startOfUtcDay(now)),
      this.summarizeSince(tenantId, startOfUtcWeek(now)),
      this.summarizeSince(tenantId, startOfUtcMonth(now)),
    ]);

    return { today, week, month };
  }

  private async summarizeSince(tenantId: string, since: Date) {
    const grouped = await this.prisma.withTenant(tenantId, (tx) =>
      tx.ledgerEntry.groupBy({
        by: ['entryType'],
        where: { tenantId, occurredAt: { gte: since } },
        _sum: { amountCents: true },
      }),
    );

    const revenueCents =
      grouped.find((g) => g.entryType === LedgerEntryType.revenue)?._sum
        .amountCents ?? 0n;
    const expenseCents =
      grouped.find((g) => g.entryType === LedgerEntryType.expense)?._sum
        .amountCents ?? 0n;
    const cashPositionCents = revenueCents - expenseCents;

    return {
      revenue: centsToAmount(revenueCents),
      expenses: centsToAmount(expenseCents),
      cashPosition: centsToAmount(cashPositionCents),
    };
  }
}
