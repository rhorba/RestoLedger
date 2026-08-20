'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, type AuditLogEntry } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function AuditLogPage() {
  const { selectedTenantId } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!selectedTenantId) return;
    // Reset loading/forbidden before fetching on tenant change — same pattern as
    // dashboard/page.tsx, not the derived-state loop this lint rule targets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setForbidden(false);
    api
      .auditLog(selectedTenantId)
      .then(setEntries)
      .catch(() => setForbidden(true))
      .finally(() => setLoading(false));
  }, [selectedTenantId]);

  if (loading) return <Skeleton className="h-64" />;

  if (forbidden) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        You don&apos;t have access to this tenant&apos;s audit log.
      </p>
    );
  }

  if (entries.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Audit Log</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(entry.createdAt).toLocaleString()}
              </TableCell>
              <TableCell className="font-mono text-sm">{entry.action}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {entry.entityType} · {entry.entityId.slice(0, 8)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
