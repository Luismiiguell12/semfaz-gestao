// Capturas para revisão visual da identidade (não são comparações automáticas).
import { test } from "@playwright/test";
import { e2eState, login, loginAdmin } from "./helpers";

const DIR = process.env.SCREENSHOT_DIR;

test.skip(!DIR, "Defina SCREENSHOT_DIR para gerar capturas.");

test("capturas das telas principais", async ({ page }, info) => {
  const p = (n: string) => `${DIR}/${info.project.name}-${n}.png`;
  await page.goto("login/");
  await page.screenshot({ path: p("login"), fullPage: true });
  await loginAdmin(page);
  await page.screenshot({ path: p("painel"), fullPage: true });
  await page.goto("administracao/usuarios/");
  await page.getByRole("heading", { name: "Usuários" }).waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: p("usuarios"), fullPage: true });
  await page.goto("administracao/departamentos/");
  await page.waitForTimeout(600);
  await page.screenshot({ path: p("departamentos"), fullPage: true });
  await page.goto("administracao/perfis/detalhe/?id=00000000-0000-4000-8000-000000000202");
  await page.waitForTimeout(600);
  await page.screenshot({ path: p("perfil"), fullPage: true });
  await page.goto("administracao/auditoria/");
  await page.waitForTimeout(600);
  await page.screenshot({ path: p("auditoria"), fullPage: true });
  void e2eState;
  void login;
});
