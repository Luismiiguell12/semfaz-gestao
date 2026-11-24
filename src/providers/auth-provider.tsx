"use client";

import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import type { AccessContext } from "@/types/access";

interface AuthState {
  /** undefined = carregando a sessão; null = sem sessão. */
  session: Session | null | undefined;
  access: AccessContext | null | undefined;
  accessLoading: boolean;
  accessError: unknown;
  refreshAccess: () => Promise<void>;
  signOut: () => Promise<void>;
  can: (permission: string) => boolean;
}

const AuthContext = React.createContext<AuthState | null>(null);

function aalOf(session: Session | null | undefined): string {
  if (!session) return "none";
  try {
    const payload = JSON.parse(
      atob(session.access_token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")),
    );
    return String(payload.aal ?? "aal1");
  } catch {
    return "aal1";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabase();
  const queryClient = useQueryClient();
  const [session, setSession] = React.useState<Session | null | undefined>(undefined);

  React.useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "SIGNED_OUT") queryClient.clear();
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, queryClient]);

  const userId = session?.user.id;
  const aal = aalOf(session);

  // O contexto depende do usuário e do nível de garantia (AAL) da sessão.
  const accessQuery = useQuery({
    queryKey: ["access", userId, aal],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_access");
      if (error) throw error;
      return data as unknown as AccessContext;
    },
  });

  const value = React.useMemo<AuthState>(
    () => ({
      session,
      access: session === null ? null : accessQuery.data,
      accessLoading: Boolean(userId) && accessQuery.isLoading,
      accessError: accessQuery.error,
      refreshAccess: async () => {
        await supabase.auth.refreshSession();
        await queryClient.invalidateQueries({ queryKey: ["access"] });
      },
      signOut: async () => {
        await supabase.auth.signOut();
        queryClient.clear();
      },
      can: (permission: string) => Boolean(accessQuery.data?.permissions?.includes(permission)),
    }),
    [session, accessQuery.data, accessQuery.isLoading, accessQuery.error, userId, supabase, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return ctx;
}

/** Exibe o conteúdo somente se o usuário tiver a permissão (apenas interface; a RLS decide). */
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { can } = useAuth();
  return <>{can(permission) ? children : fallback}</>;
}
