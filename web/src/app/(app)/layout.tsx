'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/ledger', label: 'Ledger' },
  { href: '/audit', label: 'Audit Log' },
  { href: '/team', label: 'Team' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { ready, isAuthenticated, tenants, selectedTenantId, selectTenant, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !isAuthenticated) router.replace('/login');
  }, [ready, isAuthenticated, router]);

  if (!ready || !isAuthenticated) return null;

  const selectedTenant = tenants.find((m) => m.tenant.id === selectedTenantId);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold">RestoLedger</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" disabled={tenants.length === 0} />}
            >
              {selectedTenant ? selectedTenant.tenant.name : 'No tenant'}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {tenants.map((m) => (
                <DropdownMenuItem key={m.tenant.id} onClick={() => selectTenant(m.tenant.id)}>
                  {m.tenant.name}
                  <span className="ml-auto text-xs text-muted-foreground">{m.role}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent',
                pathname === item.href && 'bg-accent font-medium',
              )}
            >
              {item.label}
            </Link>
          ))}
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out">
            <LogOut className="size-4" />
          </Button>
        </nav>
      </header>
      <main className="flex-1 p-6">
        {tenants.length === 0 ? <NoTenantState /> : children}
      </main>
    </div>
  );
}

function NoTenantState() {
  const { refreshTenants } = useAuth();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createTenant(name);
      await refreshTenants();
      toast.success('Tenant created');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create tenant');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 pt-20 text-center">
      <h2 className="text-lg font-medium">No tenant yet</h2>
      <p className="text-sm text-muted-foreground">
        Create a restaurant to get started, or ask an owner to invite you.
      </p>
      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          placeholder="Restaurant name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Button type="submit" disabled={submitting}>
          Create
        </Button>
      </form>
    </div>
  );
}
