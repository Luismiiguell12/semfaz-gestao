#!/usr/bin/env node
// Cria (ou atualiza a senha de) contas de TESTE no ambiente de HOMOLOGAÇÃO.
// Nunca usar em produção: o workflow recusa o ambiente "production".
// E-mails no domínio reservado .invalid (não recebem mensagens).
import { createClient } from "@supabase/supabase-js";

const ORG = "00000000-0000-4000-8000-000000000001";
const SEMFAZ = "00000000-0000-4000-8000-000000000101";
const ROLES = {
  admin: "00000000-0000-4000-8000-000000000201",
  manager: "00000000-0000-4000-8000-000000000202",
  viewer: "00000000-0000-4000-8000-000000000204",
};
const USERS = [
  {
    email: "admin.teste@semfaz-teste.invalid",
    username: "admin.teste",
    name: "Administrador Teste",
    role: "admin",
    orgWide: true,
  },
  {
    email: "gestor.teste@semfaz-teste.invalid",
    username: "gestor.teste",
    name: "Gestor Teste",
    role: "manager",
    orgWide: false,
  },
  {
    email: "consulta.teste@semfaz-teste.invalid",
    username: "consulta.teste",
    name: "Consulta Teste",
    role: "viewer",
    orgWide: false,
  },
];

function fail(m) {
  console.error(`Erro: ${m}`);
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.TEST_PASSWORD ?? "";
if (!url || !key) fail("defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
if (process.env.TARGET_ENVIRONMENT !== "staging")
  fail("contas de teste só podem ser criadas em homologação (staging).");
if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
  fail("senha de teste fraca: mínimo de 12 caracteres, com maiúsculas, minúsculas e números.");
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: list, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
if (listError) fail("não foi possível listar as contas.");

for (const u of USERS) {
  let id = list.users.find((x) => x.email === u.email)?.id;
  if (id) {
    const upd = await db.auth.admin.updateUserById(id, {
      password,
      email_confirm: true,
      ban_duration: "none",
    });
    if (upd.error) fail(`não foi possível atualizar ${u.username}: ${upd.error.message}`);
  } else {
    const created = await db.auth.admin.createUser({ email: u.email, password, email_confirm: true });
    if (created.error) fail(`não foi possível criar ${u.username}: ${created.error.message}`);
    id = created.data.user.id;
  }
  const { data: profile } = await db.from("profiles").select("id").eq("id", id).maybeSingle();
  if (!profile) {
    const ins = await db.from("profiles").insert({
      id,
      organization_id: ORG,
      full_name: u.name,
      email: "",
      username: u.username,
      job_title: "Conta de teste",
      department_id: SEMFAZ,
      organization_wide_access: u.orgWide,
    });
    if (ins.error) fail(`perfil de ${u.username}: ${ins.error.message}`);
    const role = await db
      .from("user_roles")
      .insert({ organization_id: ORG, user_id: id, role_id: ROLES[u.role] });
    if (role.error) fail(`perfil de acesso de ${u.username}: ${role.error.message}`);
    if (!u.orgWide) {
      const scope = await db
        .from("user_department_access")
        .insert({ organization_id: ORG, user_id: id, department_id: SEMFAZ });
      if (scope.error) fail(`escopo de ${u.username}: ${scope.error.message}`);
    }
  } else {
    await db.from("profiles").update({ status: "active", status_reason: null }).eq("id", id);
  }
  console.log(`Conta de teste pronta: ${u.username} (${u.role}).`);
}
