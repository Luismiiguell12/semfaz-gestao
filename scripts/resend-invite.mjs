#!/usr/bin/env node
// Reenvia o convite a um usuário que ainda não definiu a senha; se o convite
// já foi utilizado, envia um link de redefinição de senha.
// Uso local:   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... APP_URL=... ADMIN_EMAIL=... node scripts/resend-invite.mjs
// Uso no CI:   workflow "Criar primeiro administrador" com a ação resend_invite.
import { createClient } from "@supabase/supabase-js";

function fail(message) {
  console.error(`Erro: ${message}`);
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
if (!url || !serviceKey || !appUrl) fail("defina SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e APP_URL.");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("e-mail inválido.");

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

// Confere se a conta existe e ainda não aceitou o convite.
const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("id")
  .eq("email", email)
  .maybeSingle();
if (profileError) fail("não foi possível consultar o cadastro.");
if (!profile) fail("não há usuário cadastrado com este e-mail.");
const { data: authUser, error: userError } = await supabase.auth.admin.getUserById(profile.id);
if (userError) fail("não foi possível consultar a conta.");
if (authUser.user?.email_confirmed_at) {
  // Convite já utilizado: envia um link de redefinição de senha.
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/confirmar/`,
  });
  if (resetError) fail(`não foi possível enviar o link de redefinição de senha: ${resetError.message}`);
  console.log("Convite já utilizado: link de redefinição de senha enviado por e-mail.");
  process.exit(0);
}

const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
  redirectTo: `${appUrl}/auth/confirmar/`,
});
if (error) fail(`não foi possível reenviar o convite: ${error.message}`);
console.log("Convite reenviado por e-mail.");
