// Fase 2: solicitação por um gestor, aprovação por administrador, locadores.
import { expect, test } from "@playwright/test";
import { e2eState, expectNoHorizontalScroll, login, loginAdmin } from "./helpers";

test("gestor solicita cadastro de imóvel e administrador aprova", async ({ page, browser }) => {
  const name = `Imóvel Teste E2E ${Date.now().toString(36)}`;
  const isMobile = (page.viewportSize()?.width ?? 1000) < 640;

  // 1) Gestora solicita
  await login(page, e2eState().manager.email);
  await expect(page.getByRole("heading", { name: /^Olá/ })).toBeVisible();
  await page.goto("imoveis/novo/");
  await page.getByRole("button", { name: "Enviar para aprovação" }).click();
  await expect(page.getByText("Identificação: informe pelo menos 3 caracteres.")).toBeVisible();
  await page.getByLabel("Nome ou identificação").fill(name);
  await page.getByLabel("Finalidade").fill("Atendimento ao contribuinte (teste)");
  await page.getByLabel("Logradouro").fill("Rua de Teste");
  await page.getByLabel("Número").fill("100");
  await page.getByLabel("Bairro").fill("Centro");
  await page.getByLabel("CEP").fill("49400000");
  await expect(page.getByLabel("CEP")).toHaveValue("49400-000");
  await page
    .getByLabel("Secretaria responsável")
    .selectOption({ label: "Secretaria Municipal da Fazenda (secretaria)" });
  await page.getByLabel(/^Justificativa\*?$/).fill("Cadastro solicitado em teste automatizado");
  await page.getByRole("button", { name: "Enviar para aprovação" }).click();
  await expect(page.getByText("Solicitação enviada para aprovação.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cadastro de imóvel" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aprovar" })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  const requestUrl = page.url();

  // O imóvel ainda não existe como registro oficial.
  await page.goto("imoveis/");
  await expect(page.getByText(name)).toHaveCount(0);

  // 2) Administrador aprova (outra sessão)
  const ctx = await browser.newContext({
    ...(isMobile ? { viewport: page.viewportSize()! } : {}),
    locale: "pt-BR",
  });
  const adminPage = await ctx.newPage();
  await loginAdmin(adminPage);
  await adminPage.goto(requestUrl);
  await expect(adminPage.getByRole("cell", { name })).toBeVisible();
  await adminPage.getByRole("button", { name: "Aprovar" }).click();
  await adminPage.getByRole("dialog").getByRole("button", { name: "Aprovar" }).click();
  await expect(adminPage.getByText("Solicitação aprovada e efetivada.")).toBeVisible();
  await adminPage.getByRole("link", { name: "Abrir registro" }).click();
  await expect(adminPage.getByRole("heading", { name })).toBeVisible();
  await expectNoHorizontalScroll(adminPage);
  await ctx.close();

  // 3) A gestora agora vê o imóvel e foi notificada
  await page.goto("imoveis/");
  await expect(page.getByRole("link", { name }).filter({ visible: true }).first()).toBeVisible();
  await page.goto("notificacoes/");
  await expect(page.getByText("Solicitação aprovada").first()).toBeVisible();
});

test("cadastro de locador valida CPF e exibe dado mascarado", async ({ page }) => {
  await login(page, e2eState().manager.email);
  await expect(page.getByRole("heading", { name: /^Olá/ })).toBeVisible();
  await page.goto("locadores/");
  await page.getByRole("button", { name: "Novo locador" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("CPF").fill("12345678900");
  await dialog.getByLabel(/^Nome\*?$/).fill("Locador Teste E2E");
  await dialog.getByRole("button", { name: "Cadastrar" }).click();
  await expect(dialog.getByText("CPF inválido.")).toBeVisible();

  // CPF válido, mas único por organização: usa um gerado a cada execução.
  const base = String(Date.now()).slice(-9);
  const digits = base.split("").map(Number);
  const dv = (len: number) => {
    let s = 0;
    for (let i = 0; i < len; i++) s += (i < 9 ? digits[i]! : dvs[i - 9]!) * (len + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const dvs: number[] = [];
  dvs.push(dv(9));
  dvs.push(dv(10));
  const cpf = base + dvs.join("");
  await dialog.getByLabel("CPF").fill(cpf);
  await expect(dialog.getByLabel("CPF")).toHaveValue(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
  await dialog.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByText("Locador cadastrado.")).toBeVisible();
  await page.getByRole("searchbox").fill("Locador Teste E2E");
  await expect(
    page
      .getByText(`***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  // Gestor não tem permissão para ver o CPF completo.
  await expect(page.getByRole("button", { name: /Ver completo/ })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});
