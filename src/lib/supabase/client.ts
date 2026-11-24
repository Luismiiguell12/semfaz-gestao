"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { assertEnv, env } from "@/lib/env";

// Fragmento da URL no carregamento (links de convite/recuperação trazem
// "type=invite" ou "type=recovery"). Capturado antes de o cliente consumi-lo.
export const initialAuthHash = typeof window !== "undefined" ? window.location.hash : "";

let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;
  assertEnv();
  client = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Fluxo implícito: compatível com convites gerados pelo administrador
      // (sem code_verifier no navegador). Tokens do fragmento são removidos da URL.
      flowType: "implicit",
      storageKey: "semfaz-gestao-auth",
    },
  });
  return client;
}
