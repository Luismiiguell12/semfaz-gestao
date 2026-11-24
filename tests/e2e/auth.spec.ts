import { expect, test } from "@playwright/test";
import { e2eState, expectNoHorizontalScroll, login, loginAdmin } from "./helpers";

test.describe("Autenticação e proteção de páginas", () => {
  test("página protegida redireciona para o login", async ({ page }) => {
    await page.goto("administracao/usuarios/");
    await expect(page).toHaveURL(/\/login\/\?next=/);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("senha incorreta exibe mensagem clara", async ({ page }) => {
    await page.goto("login/");
    await page.getByLabel("E-mail institucional").fill(e2eState().colab.email);
    await page.getByLabel("Senha").fill("SenhaErrada999");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  });

  test("validação do formulário no cliente", async ({ page }) => {
    await page.goto("login/");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
    await expect(page.getByText("Informe a senha.")).toBeVisible();
  });

  test("colaborador entra, não vê a administração e sai", async ({ page }) => {
    await login(page, e2eState().colab.email);
    await expect(page.getByRole("heading", { name: /^Olá/ })).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Módulos futuros aparecem como "Em breve" e desabilitados.
    const isMobile = (page.viewportSize()?.width ?? 1000) < 1024;
    if (isMobile) await page.getByRole("button", { name: "Abrir menu" }).click();
    const nav = page.getByRole("navigation", { name: "Menu principal" }).last();
    await expect(nav.getByText("Usuários")).toHaveCount(0);
    await expect(nav.getByText("Contratos")).toBeVisible();
    await expect(nav.locator('[aria-disabled="true"]').first()).toBeVisible();
    if (isMobile) await page.keyboard.press("Escape");

    // Acesso direto pela URL: a interface bloqueia (e a RLS não devolveria dados).
    await page.goto("administracao/usuarios/");
    await expect(page.getByText("Você não tem acesso a esta página.")).toBeVisible();

    await page.getByRole("button", { name: /Menu do usuário/ }).click();
    await page.getByRole("menuitem", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login\//);
  });

  test("administrador precisa do MFA para entrar", async ({ page }) => {
    await loginAdmin(page);
    await expect(page.getByText("Administradores ativos")).toBeVisible();
  });
});
