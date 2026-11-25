// Fase 3: unidade consumidora, fatura, pagamento parcial com aprovação.
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { SERVICE_ROLE_KEY, SUPABASE_URL } from "../integration/env";
import { e2eState, expectNoHorizontalScroll, login, loginAdmin } from "./helpers";

test("gestor lança fatura e pagamento parcial; administrador aprova", async ({ page, browser }) => {
  const tag = Date.now().toString(36);
  const propertyName = `Imóvel Financeiro E2E ${tag}`;
  // Imóvel de apoio criado diretamente no banco local de testes.
  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const prop = await svc.from("properties").insert({
    organization_id: "00000000-0000-4000-8000-000000000001",
    name: propertyName,
    street: "Rua Teste",
    address_number: "1",
    district: "Centro",
    postal_code: "49400-000",
    city: "Lagarto",
    state: "SE",
    department_id: "00000000-0000-4000-8000-000000000101",
    purpose: "Teste financeiro",
  });
  expect(prop.error).toBeNull();

  await login(page, e2eState().manager.email);
  await expect(page.getByRole("heading", { name: /^Olá/ })).toBeVisible();

  // 1) Unidade consumidora
  const uc = `E2E${tag}`.toUpperCase().slice(0, 20);
  await page.goto("unidades/");
  await page.getByRole("button", { name: "Nova unidade" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Fornecedor/).selectOption({ label: "Energisa (energia)" });
  await dialog.getByLabel(/^Número da UC/).fill(uc);
  await dialog.getByLabel(/^Titular/).fill("Prefeitura Teste");
  await dialog.getByLabel(/^Imóvel/).selectOption({ label: propertyName });
  const firstDay = new Date().toLocaleDateString("en-CA", { timeZone: "America/Maceio" }).slice(0, 8) + "01";
  await dialog.getByLabel(/^Data de vinculação/).fill(firstDay);
  await dialog.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByText("Unidade cadastrada.")).toBeVisible();

  // 2) A unidade aparece no escopo do gestor, já vinculada ao imóvel
  await page.getByRole("searchbox").fill(uc);
  await page.getByRole("link", { name: uc }).filter({ visible: true }).first().click();
  await expect(
    page.getByRole("link", { name: propertyName }).filter({ visible: true }).first(),
  ).toBeVisible();
  await expectNoHorizontalScroll(page);

  // 3) Fatura
  await page.goto("financeiro/faturas/nova/");
  await page
    .getByLabel(/^Unidade consumidora/)
    .selectOption((await page.locator("#f-unit option", { hasText: uc }).getAttribute("value"))!);
  await page.getByLabel(/^Competência/).fill(firstDay.slice(0, 7));
  await page.getByLabel(/^Consumo/).fill("150");
  await page.getByLabel(/^Valor/).fill("300,00");
  const due = new Date(Date.now() + 15 * 86400000).toLocaleDateString("en-CA", {
    timeZone: "America/Maceio",
  });
  await page.getByLabel(/^Vencimento/).fill(due);
  await page.getByRole("button", { name: "Lançar fatura" }).click();
  await expect(page.getByText("Fatura lançada.")).toBeVisible();
  await expect(page.getByText("Pendente").first()).toBeVisible();

  // Duplicidade exige justificativa
  const invoiceUrl = page.url();
  await page.goto("financeiro/faturas/nova/");
  await page
    .getByLabel(/^Unidade consumidora/)
    .selectOption((await page.locator("#f-unit option", { hasText: uc }).getAttribute("value"))!);
  await page.getByLabel(/^Competência/).fill(firstDay.slice(0, 7));
  await page.getByLabel(/^Consumo/).fill("10");
  await page.getByLabel(/^Valor/).fill("20,00");
  await page.getByLabel(/^Vencimento/).fill(due);
  await page.getByRole("button", { name: "Lançar fatura" }).click();
  await expect(page.getByRole("heading", { name: "Fatura duplicada" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar para aprovação" })).toBeVisible();

  // 4) Pagamento parcial (solicitação)
  await page.goto(invoiceUrl);
  await page.getByRole("button", { name: "Registrar pagamento" }).click();
  const pay = page.getByRole("dialog");
  await pay.getByLabel(/^Valor/).fill("100,00");
  await pay.getByLabel(/^Justificativa/).fill("Pagamento parcial em teste automatizado");
  await pay.getByRole("button", { name: "Enviar para aprovação" }).click();
  await expect(page.getByText("Pagamento enviado para aprovação.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Registro de pagamento, complemento ou estorno" }),
  ).toBeVisible();
  const requestUrl = page.url();

  // 5) Administrador aprova
  const ctx = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: "pt-BR" });
  const admin = await ctx.newPage();
  await loginAdmin(admin);
  await admin.goto(requestUrl);
  await admin.getByRole("button", { name: "Aprovar" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Aprovar" }).click();
  await expect(admin.getByText("Solicitação aprovada e efetivada.")).toBeVisible();
  await ctx.close();

  // 6) Situação calculada
  await page.goto(invoiceUrl);
  await expect(page.getByText("Parcialmente paga").first()).toBeVisible();
  await expect(page.getByText("R$ 200,00").first()).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("administrador cadastra fornecedor em Regras e listas", async ({ page }) => {
  const name = `Fornecedor E2E ${Date.now().toString(36)}`;
  await loginAdmin(page);
  await page.goto("administracao/regras/");
  const panel = page.getByRole("region", { name: "Fornecedores de água e energia" });
  await expect(panel.getByText("Energisa")).toBeVisible();
  await panel.getByLabel("Nome do fornecedor").fill(name);
  await panel.getByLabel("Tipo do fornecedor").selectOption("water");
  await panel.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText("Fornecedor adicionado.")).toBeVisible();
  await expect(panel.getByText(name)).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.goto("unidades/");
  await page.getByRole("button", { name: "Nova unidade" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByLabel(/^Fornecedor/)
      .locator("option", { hasText: name }),
  ).toHaveCount(1);
});
