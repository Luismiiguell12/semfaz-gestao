import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TOTP } from "otpauth";
import { randomUUID } from "node:crypto";
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL } from "./env";

export const ORG_ID = "00000000-0000-4000-8000-000000000001";
export const SEMFAZ_ID = "00000000-0000-4000-8000-000000000101";
export const ROLE = {
  admin: "00000000-0000-4000-8000-000000000201",
  manager: "00000000-0000-4000-8000-000000000202",
  collaborator: "00000000-0000-4000-8000-000000000203",
  viewer: "00000000-0000-4000-8000-000000000204",
} as const;

export const PASSWORD = "SenhaTeste123";

export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const uniq = (prefix: string) => `${prefix}${randomUUID().slice(0, 8)}`;

/** Cria uma conta de autenticação com senha (somente no ambiente local). */
export async function createAuthUser(username: string) {
  const email = `${username}@teste.invalid`;
  const { data, error } = await serviceClient().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  return { id: data.user.id, email };
}

export async function signIn(email: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

/** Cadastra o TOTP e eleva a sessão para AAL2. Retorna o segredo para novos logins. */
export async function enrollAndVerifyTotp(client: SupabaseClient): Promise<string> {
  const enroll = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: `teste-${randomUUID().slice(0, 6)}` });
  if (enroll.error) throw enroll.error;
  const secret = enroll.data.totp.secret;
  await verifyTotp(client, enroll.data.id, secret);
  return secret;
}

export async function verifyTotp(client: SupabaseClient, factorId: string, secret: string) {
  const code = new TOTP({ secret, digits: 6, period: 30 }).generate();
  const res = await client.auth.mfa.challengeAndVerify({ factorId, code });
  if (res.error) throw res.error;
}

/**
 * Garante um administrador com MFA. No banco recém-resetado, usa o mesmo fluxo
 * do script scripts/create-admin (bootstrap_first_admin via service_role).
 */
export async function bootstrapAdmin(): Promise<{ client: SupabaseClient; id: string; email: string }> {
  const svc = serviceClient();
  const username = uniq("admin");
  const user = await createAuthUser(username);
  const boot = await svc.rpc("bootstrap_first_admin", {
    p_user_id: user.id,
    p_organization_id: ORG_ID,
    p_full_name: "Administrador Teste",
    p_username: username,
  });
  if (boot.error) {
    if (!boot.error.message.includes("Já existe um administrador")) throw boot.error;
    // Já existe admin: concede o perfil diretamente (somente no ambiente local de testes).
    const ins = await svc.from("profiles").insert({
      id: user.id, organization_id: ORG_ID, full_name: "Administrador Teste", email: "", username,
    });
    if (ins.error) throw ins.error;
    const role = await svc.from("user_roles").insert({ organization_id: ORG_ID, user_id: user.id, role_id: ROLE.admin });
    if (role.error) throw role.error;
  }
  const client = await signIn(user.email);
  await enrollAndVerifyTotp(client);
  return { client, ...user };
}

export async function callFunction(client: SupabaseClient, name: string, body: unknown) {
  const { data: session } = await client.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.session?.access_token}`,
      apikey: ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
