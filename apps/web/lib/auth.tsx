"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, apiPost } from "@/lib/api";
import type { Session } from "@/lib/types";

type AuthState = {
  session: Session | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<Session>;
  register: (payload: { email: string; password: string; full_name: string; organization_name?: string }) => Promise<Session>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
    try {
      const data = await api<Session>("/auth/me");
      setSession(data.user ? data : null);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      refresh,
      login: async (email, password) => {
        const data = await apiPost<Session>("/auth/login", { email, password });
        setSession(data);
        return data;
      },
      register: async (payload) => {
        const data = await apiPost<Session>("/auth/register", payload);
        setSession(data);
        return data;
      },
      logout: async () => {
        await apiPost("/auth/logout");
        setSession(null);
      },
    }),
    [session, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!auth.loading && !auth.session?.user) {
      router.replace("/login");
    } else if (!auth.loading && auth.session?.user && !auth.session.organization) {
      router.replace("/onboarding");
    }
  }, [auth.loading, auth.session, router]);
  return auth;
}
