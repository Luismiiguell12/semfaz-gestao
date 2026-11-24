import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.119.2";
import { HttpError } from "./http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

function publicKey(): string {
  const key = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!key) throw new Error("Chave pública do Supabase não configurada.");
  return key;
}

function serviceKey(): string {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!key) throw new Error("Chave de serviço não configurada.");
  return key;
}

export interface AuthContext {
  userId: string;
  aal: string;
  /** Cliente com o JWT do usuário: respeita RLS e as verificações das RPCs. */
  userClient: SupabaseClient;
}

/** Valida o JWT do chamador (assinatura e expiração) e cria o cliente do usuário. */
export async function requireUser(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) throw new HttpError(401, "Sessão ausente. Faça login novamente.", "unauthenticated");

  const userClient = createClient(SUPABASE_URL, publicKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await userClient.auth.getClaims(token);
  if (error || !data?.claims?.sub || data.claims.role !== "authenticated") {
    throw new HttpError(401, "Sessão inválida ou expirada. Faça login novamente.", "unauthenticated");
  }
  return { userId: data.claims.sub, aal: String(data.claims.aal ?? "aal1"), userClient };
}

/** Cliente administrativo. Uso restrito: somente depois de autorizar o chamador. */
export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
