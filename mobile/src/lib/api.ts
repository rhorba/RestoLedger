const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface TenantMembership {
  id: string;
  role: 'owner' | 'accountant' | 'staff' | 'firm_admin';
  tenant: { id: string; name: string };
}

export interface LedgerEntry {
  id: string;
  entryType: 'revenue' | 'expense' | 'reconciliation';
  amount: string;
  currency: string;
  description: string | null;
  occurredAt: string;
  reversalOfId: string | null;
  createdAt: string;
}

export interface DashboardPeriodSummary {
  revenue: string;
  expenses: string;
  cashPosition: string;
}

export interface DashboardSummary {
  today: DashboardPeriodSummary;
  week: DashboardPeriodSummary;
  month: DashboardPeriodSummary;
}

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    onUnauthorized?.();
    throw new ApiError(401, 'Session expired — please log in again');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  register: (email: string, password: string, fullName: string) =>
    request<Tokens>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, fullName }) }),

  login: (email: string, password: string) =>
    request<Tokens>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  refresh: (refreshToken: string) =>
    request<Tokens>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

  myTenants: () => request<TenantMembership[]>('/tenants/mine'),

  dashboard: (tenantId: string) => request<DashboardSummary>(`/tenants/${tenantId}/dashboard`),

  ledgerEntries: (tenantId: string) => request<LedgerEntry[]>(`/tenants/${tenantId}/ledger-entries`),

  postLedgerEntry: (
    tenantId: string,
    entryType: 'revenue' | 'expense',
    amount: number,
    description: string | undefined,
    idempotencyKey: string,
  ) =>
    request<LedgerEntry>(`/tenants/${tenantId}/ledger-entries`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ entryType, amount, description }),
    }),
};
