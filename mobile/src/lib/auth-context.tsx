import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setAccessToken, setUnauthorizedHandler, type TenantMembership } from './api';
import { secureStorage } from './secure-storage';

// Refresh token goes in SecureStore on iOS/Android (Keychain / Keystore) — encrypted at
// rest, unlike the web dashboard's localStorage (see web/src/lib/auth-context.tsx's
// documented tradeoff). Access token stays in memory only, same as web.
const REFRESH_TOKEN_KEY = 'restoledger_refresh_token';

interface AuthState {
  ready: boolean;
  isAuthenticated: boolean;
  tenants: TenantMembership[];
  selectedTenantId: string | null;
  selectedRole: TenantMembership['role'] | null;
  selectTenant: (id: string) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshTenants: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tenants, setTenants] = useState<TenantMembership[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const logout = useCallback(async () => {
    setAccessToken(null);
    await secureStorage.removeItem(REFRESH_TOKEN_KEY);
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
      await secureStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      setIsAuthenticated(true);
      await refreshTenants();
    },
    [refreshTenants],
  );

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });
  }, [logout]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await secureStorage.getItem(REFRESH_TOKEN_KEY);
      if (!stored) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        const tokens = await api.refresh(stored);
        if (!cancelled) await establishSession(tokens.accessToken, tokens.refreshToken);
      } catch {
        if (!cancelled) await logout();
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
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

  const selectedRole = tenants.find((m) => m.tenant.id === selectedTenantId)?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        ready,
        isAuthenticated,
        tenants,
        selectedTenantId,
        selectedRole,
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
