import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, loginAdmin } from "./helpers";

test.describe("Administração", () => {
  test("cadastra departamento e o vê na auditoria", async ({ page }) => {
    const name = `Diretoria Teste E2E ${Date.now().toString(36)}`;
    await loginAdmin(page);
    await page.goto("administracao/departamentos/");
    await page.getByRole("button", { name: "Novo departamento" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nível").selectOption("directorate");
    await dialog.getByRole("button", { name: "Cadastrar" }).click();
    await expect(dialog.getByText("Selecione o departamento superior.")).toBeVisible();
    await dialog.getByLabel("Departamento superior").selectOption({ label: "Secretaria Municipal da Fazenda" });
    await dialog.getByLabel("Nome").fill(name);
    await dialog.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.getByText("Departamento cadastrado.")).toBeVisible();
    await expect(page.getByRole("treeitem").filter({ hasText: name })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.goto("administracao/auditoria/");
    await page.getByLabel("Módulo").selectOption("departments");
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(page.getByRole("button", { name: /Inclusão/ }).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("convida usuário e altera a situação com justificativa", async ({ page }) => {
    const username = `e2e.convite.${Date.now().toString(36)}`;
    await loginAdmin(page);
    await page.goto("administracao/usuarios/");
    await page.getByRole("button", { name: "Convidar usuário" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome completo").fill("Pessoa Convidada Teste");
    await dialog.getByLabel("E-mail institucional").fill(`${username}@teste.invalid`);
    await dialog.getByLabel("Nome de usuário").fill(username);
    await dialog.getByLabel("Consulta").check();
    await dialog.getByRole("button", { name: "Enviar convite" }).click();
    await expect(page.getByText("Convite enviado por e-mail.")).toBeVisible();

    await page.getByRole("searchbox").fill(username);
    await page.getByRole("link", { name: "Pessoa Convidada Teste" }).first().click();
    await expect(page.getByRole("heading", { name: "Pessoa Convidada Teste" })).toBeVisible();
    await page.getByRole("tab", { name: "Situação" }).click();
    await page.getByRole("button", { name: "Bloquear" }).click();
    const confirm = page.getByRole("dialog");
    await confirm.getByRole("button", { name: "Confirmar" }).click();
    await expect(confirm.getByText("A justificativa deve ter pelo menos 10 caracteres.")).toBeVisible();
    await confirm.getByLabel("Justificativa").fill("Bloqueio para validação em teste automatizado");
    await confirm.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("Situação alterada.")).toBeVisible();
    await expect(page.locator("main").getByText("Bloqueado").first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("perfil Administrador é somente leitura", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("administracao/perfis/");
    await page.getByRole("link", { name: /Administrador/ }).click();
    await expect(page.getByText("Perfil protegido")).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar perfil" })).toHaveCount(0);
  });
});
