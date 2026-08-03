"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(session: Session | null): AuthUser | null {
  if (!session?.user) return null;
  const { id, email, user_metadata } = session.user;
  return {
    id,
    email: email ?? "",
    name: (user_metadata?.name as string) || email?.split("@")[0] || "Пользователь",
    isAdmin: false,
  };
}

async function fetchIsAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  return Boolean(data?.is_admin);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const base = toAuthUser(data.session);
      setUser(base);
      setIsLoading(false);
      if (base) {
        fetchIsAdmin(base.id).then((isAdmin) => {
          setUser((prev) => (prev && prev.id === base.id ? { ...prev, isAdmin } : prev));
        });
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const base = toAuthUser(session);
      setUser(base);
      if (base) {
        fetchIsAdmin(base.id).then((isAdmin) => {
          setUser((prev) => (prev && prev.id === base.id ? { ...prev, isAdmin } : prev));
        });
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      signUp: async (email, password, name) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        return { error: error?.message ?? null };
      },
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      logout: () => {
        supabase.auth.signOut();
      },
    }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
