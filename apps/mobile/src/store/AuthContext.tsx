import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setAccessToken, setOnUnauthorized, setRefreshToken } from '../api';
import type { AuthUser } from '../types';
import { clearSession, loadSession, persistSession } from './tokenStorage';

interface AuthContextValue {
  isReady: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (phone: string, code: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const bootstrapped = useRef(false);

  useEffect(() => {
    let mounted = true;
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    (async () => {
      const session = await loadSession();
      if (!mounted) return;
      if (session.accessToken) {
        setAccessToken(session.accessToken);
        setRefreshToken(session.refreshToken);
        setUser(session.user);
      }
      setIsReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      void clearSession();
    });
    return () => setOnUnauthorized(null);
  }, []);

  const login = useCallback(async (phone: string, code: string) => {
    const result = await api.login(phone, code);
    setAccessToken(result.accessToken);
    setRefreshToken(result.refreshToken);
    setUser(result.user);
    await persistSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // 忽略登出失败
    }
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    await clearSession();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isReady,
      isAuthenticated: Boolean(user),
      user,
      login,
      logout,
    }),
    [isReady, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 <AuthProvider> 内使用');
  return ctx;
}
