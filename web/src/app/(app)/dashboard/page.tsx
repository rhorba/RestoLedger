'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, type DashboardSummary, type DashboardPeriodSummary } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

function isNegative(amount: string) {
  return amount.startsWith('-');
}

function PeriodCard({ title, summary }: { title: string; summary: DashboardPeriodSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Revenue</span>
          <span className="font-medium tabular-nums text-[#1E6F5C]">{summary.revenue} MAD</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Expenses</span>
          <span className="font-medium tabular-nums text-[#C0392B]">{summary.expenses} MAD</span>
        </div>
        <div className="mt-2 flex justify-between border-t pt-2 text-sm">
          <span className="font-medium">Cash position</span>
          <span
            className={`font-semibold tabular-nums ${isNegative(summary.cashPosition) ? 'text-[#C0392B]' : 'text-[#1E6F5C]'}`}
          >
            {summary.cashPosition} MAD
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { selectedTenantId } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedTenantId) return;
    // Resetting loading state before an async fetch-on-tenant-change is the correct pattern
    // here, not a smell the lint rule is meant to catch (no derived-state loop risk).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api
      .dashboard(selectedTenantId)
      .then(setSummary)
      .finally(() => setLoading(false));
  }, [selectedTenantId]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <PeriodCard title="Today" summary={summary.today} />
      <PeriodCard title="This week" summary={summary.week} />
      <PeriodCard title="This month" summary={summary.month} />
    </div>
  );
}
