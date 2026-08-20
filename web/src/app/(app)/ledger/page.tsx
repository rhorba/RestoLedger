'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, ApiError, type LedgerEntry } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function LedgerPage() {
  const { selectedTenantId, selectedTenantRole } = useTenantRole();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [postOpen, setPostOpen] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<LedgerEntry | null>(null);

  const canManage = selectedTenantRole === 'owner' || selectedTenantRole === 'accountant';

  const load = useCallback(() => {
    if (!selectedTenantId) return;
    setLoading(true);
    api
      .ledgerEntries(selectedTenantId)
      .then(setEntries)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setEntries([]);
        } else {
          toast.error('Could not load ledger entries');
        }
      })
      .finally(() => setLoading(false));
  }, [selectedTenantId]);

  useEffect(() => {
    // load() sets loading state before fetching on tenant change — correct pattern, see the
    // same note in dashboard/page.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Ledger</h1>
        <PostEntryDialog
          open={postOpen}
          onOpenChange={setPostOpen}
          tenantId={selectedTenantId}
          onPosted={load}
        />
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : entries.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No entries yet — post your first entry.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {canManage && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(entry.occurredAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Badge variant={entry.entryType === 'expense' ? 'destructive' : 'secondary'}>
                    {entry.entryType}
                    {entry.reversalOfId && ' (reversal)'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{entry.description ?? '—'}</TableCell>
                <TableCell
                  className={`text-right font-medium tabular-nums ${entry.amount.startsWith('-') ? 'text-[#C0392B]' : ''}`}
                >
                  {entry.amount} {entry.currency}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    {!entry.reversalOfId && (
                      <Button variant="ghost" size="sm" onClick={() => setReverseTarget(entry)}>
                        Reverse
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ReverseEntryDialog
        entry={reverseTarget}
        tenantId={selectedTenantId}
        onOpenChange={(open) => !open && setReverseTarget(null)}
        onReversed={load}
      />
    </div>
  );
}

function useTenantRole() {
  const { selectedTenantId, tenants } = useAuth();
  const selectedTenantRole = tenants.find((m) => m.tenant.id === selectedTenantId)?.role;
  return { selectedTenantId, selectedTenantRole };
}

function PostEntryDialog({
  open,
  onOpenChange,
  tenantId,
  onPosted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string | null;
  onPosted: () => void;
}) {
  const [entryType, setEntryType] = useState<'revenue' | 'expense'>('revenue');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSubmitting(true);
    try {
      await api.postLedgerEntry(tenantId, entryType, Number(amount), description || undefined);
      toast.success('Entry saved');
      setAmount('');
      setDescription('');
      onOpenChange(false);
      onPosted();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save entry');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button disabled={!tenantId} />}>Post entry</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Post ledger entry</DialogTitle>
          <DialogDescription>Record a revenue or expense entry for today.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex gap-2">
            <Select value={entryType} onValueChange={(v) => setEntryType(v as 'revenue' | 'expense')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1 space-y-2">
              <Label htmlFor="amount">Amount (MAD)</Label>
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Note (optional)</Label>
            <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              Save entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReverseEntryDialog({
  entry,
  tenantId,
  onOpenChange,
  onReversed,
}: {
  entry: LedgerEntry | null;
  tenantId: string | null;
  onOpenChange: (open: boolean) => void;
  onReversed: () => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId || !entry) return;
    setSubmitting(true);
    try {
      await api.reverseLedgerEntry(tenantId, entry.id, reason);
      toast.success('Entry reversed');
      setReason('');
      onOpenChange(false);
      onReversed();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not reverse entry');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={entry !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reverse entry</DialogTitle>
          <DialogDescription>
            This posts a new offsetting entry — the original stays in the ledger unmodified.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={3}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={submitting}>
              Reverse entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
