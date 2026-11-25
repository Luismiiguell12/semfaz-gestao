// Capturas para revisão visual da identidade (não são comparações automáticas).
import { test } from "@playwright/test";
import { loginAdmin } from "./helpers";

const DIR = process.env.SCREENSHOT_DIR;

test.skip(!DIR, "Defina SCREENSHOT_DIR para gerar capturas.");

const PAGES: [string, string][] = [
  ["painel", ""],
  ["usuarios", "administracao/usuarios/"],
  ["aprovacoes", "aprovacoes/"],
  ["imoveis", "imoveis/"],
  ["contratos", "contratos/"],
  ["contrato", "contratos/detalhe/?id=72000000-0000-4000-8000-000000000001"],
  ["locadores", "locadores/"],
  ["regras", "administracao/regras/"],
];

test("capturas das telas principais", async ({ page }, info) => {
  const p = (n: string) => `${DIR}/${info.project.name}-${n}.png`;
  await page.goto("login/");
  await page.screenshot({ path: p("login"), fullPage: true });
  await loginAdmin(page);
  for (const [name, path] of PAGES) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    await page.screenshot({ path: p(name), fullPage: true });
  }
});
