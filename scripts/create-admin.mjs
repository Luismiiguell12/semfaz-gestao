#!/usr/bin/env node
// =============================================================================
// SEMFAZ Gestão — criação do PRIMEIRO administrador
//
// Execução manual e local, por pessoa autorizada. Nunca exponha a chave de
// serviço: informe-a apenas por variável de ambiente nesta execução.
//
//   SUPABASE_URL=https://<projeto>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<chave de serviço> \
//   APP_URL=https://<usuario>.github.io/semfaz-gestao \
//   node scripts/create-admin.mjs
//
// O administrador recebe um convite por e-mail para definir a própria senha e,
// no primeiro acesso, é obrigado a cadastrar o MFA (TOTP).
// A função bootstrap_first_admin recusa a operação se já houver administrador ativo.
// =============================================================================
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const DEFAULT_ORG_ID = "00000000-0000-4000-8000-000000000001";

function fail(message) {
  console.error(`\nErro: ${message}`);
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
const orgId = process.env.ORGANIZATION_ID ?? DEFAULT_ORG_ID;

if (!url || !serviceKey) fail("defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente desta execução.");
if (!appUrl) fail("defina APP_URL (endereço da aplicação, usado no link do convite).");

const rl = createInterface({ input, output });
console.log("SEMFAZ Gestão — criação do primeiro administrador");
console.log(`Projeto: ${url}`);
const fullName = (await rl.question("Nome completo: ")).trim();
const email = (await rl.question("E-mail institucional: ")).trim().toLowerCase();
const username = (await rl.question("Nome de usuário (ex.: joao.silva): ")).trim().toLowerCase();
const confirm = (await rl.question(`Confirmar criação de ${fullName} <${email}>? (sim/não): `))
  .trim()
  .toLowerCase();
rl.close();

if (confirm !== "sim") fail("operação cancelada.");
if (fullName.length < 3) fail("nome muito curto.");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("e-mail inválido.");
if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username))
  fail("nome de usuário inválido (3 a 40 caracteres: a-z, 0-9, ponto, hífen, sublinhado).");

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const invited = await supabase.auth.admin.inviteUserByEmail(email, {
  redirectTo: `${appUrl}/auth/confirmar/`,
});
if (invited.error || !invited.data.user)
  fail(`não foi possível enviar o convite: ${invited.error?.message ?? "sem detalhes"}`);

const boot = await supabase.rpc("bootstrap_first_admin", {
  p_user_id: invited.data.user.id,
  p_organization_id: orgId,
  p_full_name: fullName,
  p_username: username,
});
if (boot.error) {
  // Desfaz a conta recém-criada (ainda sem perfil nem histórico).
  await supabase.auth.admin.deleteUser(invited.data.user.id);
  fail(boot.error.message);
}

console.log("\nAdministrador criado. O convite foi enviado por e-mail.");
console.log("No primeiro acesso será exigido o cadastro do MFA (aplicativo autenticador).");
console.log("Recomendação: cadastre um segundo administrador ativo pelo sistema.");
