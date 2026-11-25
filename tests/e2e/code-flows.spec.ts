// Primeiro acesso e recuperação de senha por CÓDIGO de 6 números (sem links de uso único).
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TOTP } from "otpauth";
import { ANON_KEY, MAILPIT_URL, SERVICE_ROLE_KEY, SUPABASE_URL } from "../integration/env";
import { e2eState, PASSWORD } from "./helpers";

// Um único tamanho de tela basta: o fluxo é o mesmo e cada execução envia e-mails.
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Executado apenas no desktop.");
});

async function latestCode(email: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const search = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    ).then((r) => r.json());
    const id = search.messages?.[0]?.ID;
    if (id) {
      const msg = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`).then((r) => r.json());
      const match = /\b(\d{6})\b/.exec(String(msg.HTML ?? msg.Text ?? "").replace(/<[^>]+>/g, " "));
      if (match?.[1]) return match[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("E-mail com código não encontrado no Mailpit.");
}

const NEW_PASSWORD = "NovaSenhaTeste456";

test("recuperação de senha por código", async ({ page }) => {
  // Usuário novo a cada execução (o limite antiabuso de envio de e-mails é por endereço).
  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const username = `e2e.recupera.${Date.now().toString(36)}`;
  const colab = { email: `${username}@teste.invalid` };
  const created = await svc.auth.admin.createUser({
    email: colab.email,
    password: PASSWORD,
    email_confirm: true,
  });
  expect(created.error).toBeNull();
  const profile = await svc.from("profiles").insert({
    id: created.data.user!.id,
    organization_id: "00000000-0000-4000-8000-000000000001",
    full_name: "Pessoa Recuperação Teste",
    email: "",
    username,
  });
  expect(profile.error).toBeNull();
  await svc.from("user_roles").insert({
    organization_id: "00000000-0000-4000-8000-000000000001",
    user_id: created.data.user!.id,
    role_id: "00000000-0000-4000-8000-000000000204",
  });
  await page.goto("login/");
  await page.getByRole("link", { name: "Esqueci minha senha" }).click();
  await page.getByLabel("E-mail institucional").fill(colab.email);
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect(page.getByLabel("Código recebido por e-mail")).toBeVisible();

  // Código errado é rejeitado com mensagem clara.
  await page.getByLabel("Código recebido por e-mail").fill("000000");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText(/Código inválido ou expirado/)).toBeVisible();

  await page.getByLabel("Código recebido por e-mail").fill(await latestCode(colab.email));
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Definir senha" })).toBeVisible();
  await page.getByLabel(/^Nova senha/).fill(NEW_PASSWORD);
  await page.getByLabel("Confirmar nova senha").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Salvar senha" }).click();
  await expect(page.getByRole("heading", { name: /^Olá/ })).toBeVisible();
});

test("primeiro acesso por código do convite", async ({ page }) => {
  const { admin, totpSecret } = e2eState();
  // Administrador (AAL2) convida um usuário pela Edge Function.
  const adminClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  await adminClient.auth.signInWithPassword({ email: admin.email, password: PASSWORD });
  const factors = await adminClient.auth.mfa.listFactors();
  const factorId = factors.data!.totp[0]!.id;
  await adminClient.auth.mfa.challengeAndVerify({
    factorId,
    code: new TOTP({ secret: totpSecret }).generate(),
  });
  const { data: session } = await adminClient.auth.getSession();
  const username = `e2e.codigo.${Date.now().toString(36)}`;
  const email = `${username}@teste.invalid`;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.session!.access_token}`,
      apikey: ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "invite",
      payload: {
        full_name: "Pessoa Código Teste",
        email,
        username,
        role_ids: ["00000000-0000-4000-8000-000000000204"],
      },
    }),
  });
  expect(res.status).toBe(201);

  await page.goto("login/");
  await page.getByRole("link", { name: /Primeiro acesso/ }).click();
  await page.getByLabel("E-mail institucional").fill(email);
  await page.getByLabel("Código recebido por e-mail").fill(await latestCode(email));
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Definir senha" })).toBeVisible();
  await page.getByLabel(/^Nova senha/).fill(NEW_PASSWORD);
  await page.getByLabel("Confirmar nova senha").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Salvar senha" }).click();
  await expect(page.getByRole("heading", { name: /^Olá/ })).toBeVisible();
});
