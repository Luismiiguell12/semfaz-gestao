// Prepara usuários de teste no Supabase LOCAL (dados fictícios) para os E2E.
import { writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { TOTP } from "otpauth";
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL } from "../integration/env";

export const E2E_STATE = "tests/e2e/.auth/state.json";
export const PASSWORD = "SenhaTeste123";
const ORG = "00000000-0000-4000-8000-000000000001";
const ADMIN_ROLE = "00000000-0000-4000-8000-000000000201";
const COLLAB_ROLE = "00000000-0000-4000-8000-000000000203";

export default async function globalSetup() {
  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const suffix = Date.now().toString(36);

  async function makeUser(username: string, fullName: string, roleId: string) {
    const email = `${username}@teste.invalid`;
    const created = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (created.error) throw created.error;
    const id = created.data.user.id;
    const prof = await svc.from("profiles").insert({ id, organization_id: ORG, full_name: fullName, email: "", username, organization_wide_access: roleId === ADMIN_ROLE });
    if (prof.error) throw prof.error;
    const role = await svc.from("user_roles").insert({ organization_id: ORG, user_id: id, role_id: roleId });
    if (role.error) throw role.error;
    return { id, email };
  }

  const admin = await makeUser(`e2e.admin.${suffix}`, "Administradora Teste E2E", ADMIN_ROLE);
  const colab = await makeUser(`e2e.colab.${suffix}`, "Colaborador Teste E2E", COLLAB_ROLE);

  // Cadastra o TOTP do administrador e guarda o segredo para os testes.
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const login = await client.auth.signInWithPassword({ email: admin.email, password: PASSWORD });
  if (login.error) throw login.error;
  const enroll = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "e2e" });
  if (enroll.error) throw enroll.error;
  const code = new TOTP({ secret: enroll.data.totp.secret, digits: 6, period: 30 }).generate();
  const verify = await client.auth.mfa.challengeAndVerify({ factorId: enroll.data.id, code });
  if (verify.error) throw verify.error;

  mkdirSync("tests/e2e/.auth", { recursive: true });
  writeFileSync(E2E_STATE, JSON.stringify({ admin, colab, totpSecret: enroll.data.totp.secret }));
}
