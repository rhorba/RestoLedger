'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function TeamPage() {
  const { selectedTenantId, tenants } = useAuth();
  const role = tenants.find((m) => m.tenant.id === selectedTenantId)?.role;
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'accountant' | 'staff'>('staff');
  const [submitting, setSubmitting] = useState(false);

  if (role !== 'owner') {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Only the tenant owner can manage team members.
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTenantId) return;
    setSubmitting(true);
    try {
      await api.addMembership(selectedTenantId, email, inviteRole);
      toast.success(`${email} added as ${inviteRole}`);
      setEmail('');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not add member');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Invite a team member</CardTitle>
        <CardDescription>
          They must already have a RestoLedger account — invite by the email they registered with.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'accountant' | 'staff')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accountant">Accountant</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={submitting}>
            Add to team
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
