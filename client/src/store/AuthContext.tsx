import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { user, type UserMe } from '../api/client';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: UserMe | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setGold: (n: number) => void;
  setHasAutoRoll: (v: boolean) => void;
  setHasQuickRoll: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, error: null });

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setState({ user: null, loading: false, error: null });
      return;
    }
    try {
      const me = await user.me();
      setState((s) => ({ ...s, user: me, loading: false, error: null }));
    } catch {
      localStorage.removeItem('token');
      setState({ user: null, loading: false, error: null });
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        localStorage.setItem('token', session.access_token);
        await refreshUser();
      } else {
        setState({ user: null, loading: false, error: null });
      }
    };
    init();
  }, [refreshUser]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        localStorage.setItem('token', session.access_token);
        refreshUser();
      } else {
        localStorage.removeItem('token');
        setState({ user: null, loading: false, error: null });
      }
    });
    return () => subscription.unsubscribe();
  }, [refreshUser]);

  const login = useCallback(async (token: string) => {
    localStorage.setItem('token', token);
    await refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('token');
    setState({ user: null, loading: false, error: null });
  }, []);

  const setGold = useCallback((n: number) => {
    setState((s) => (s.user ? { ...s, user: { ...s.user, gold: n } } : s));
  }, []);

  const setHasAutoRoll = useCallback((v: boolean) => {
    setState((s) => (s.user ? { ...s, user: { ...s.user, hasAutoRoll: v } } : s));
  }, []);

  const setHasQuickRoll = useCallback((v: boolean) => {
    setState((s) => (s.user ? { ...s, user: { ...s.user, hasQuickRoll: v } } : s));
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    refreshUser,
    setGold,
    setHasAutoRoll,
    setHasQuickRoll,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
