'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setAccessToken, setUnauthorizedHandler, type TenantMembership } from './api';

// SECURITY TRADEOFF (logged in .logs/corrections.md): tokens are stored in localStorage, not
// HttpOnly cookies. security-restoledger.md §3 specifies HttpOnly/Secure/SameSite cookies,
// which requires a BFF (Next.js API route proxying auth so the browser never sees the token).
// That's real infra work deferred past Sprint 2 — this is XSS-exposed and must be hardened
// before any real (non-test) client data goes through this dashboard.
const REFRESH_TOKEN_KEY = 'restoledger_refresh_token';

interface AuthState {
  ready: boolean;
  isAuthenticated: boolean;
  tenants: TenantMembership[];
  selectedTenantId: string | null;
  selectTenant: (id: string) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  refreshTenants: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tenants, setTenants] = useState<TenantMembership[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const logout = useCallback(() => {
    setAccessToken(null);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setIsAuthenticated(false);
    setTenants([]);
    setSelectedTenantId(null);
  }, []);

  const refreshTenants = useCallback(async () => {
    const memberships = await api.myTenants();
    setTenants(memberships);
    setSelectedTenantId((current) => current ?? memberships[0]?.tenant.id ?? null);
  }, []);

  const establishSession = useCallback(
    async (accessToken: string, refreshToken: string) => {
      setAccessToken(accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      setIsAuthenticated(true);
      await refreshTenants();
    },
    [refreshTenants],
  );

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  useEffect(() => {
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedRefreshToken) {
      // No session to restore — reading localStorage is the browser-only-API access this
      // effect exists for; marking auth as resolved here is not derivable during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReady(true);
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: storedRefreshToken }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((tokens) => establishSession(tokens.accessToken, tokens.refreshToken))
      .catch(() => logout())
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await api.login(email, password);
      await establishSession(tokens.accessToken, tokens.refreshToken);
    },
    [establishSession],
  );

  const register = useCallback(
    async (email: string, password: string, fullName: string) => {
      const tokens = await api.register(email, password, fullName);
      await establishSession(tokens.accessToken, tokens.refreshToken);
    },
    [establishSession],
  );

  return (
    <AuthContext.Provider
      value={{
        ready,
        isAuthenticated,
        tenants,
        selectedTenantId,
        selectTenant: setSelectedTenantId,
        login,
        register,
        logout,
        refreshTenants,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
