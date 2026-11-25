// Fase 7: varredura de TODAS as rotas nos três tamanhos de tela (projetos do Playwright).
// Em cada página: título, sem rolagem horizontal, sem erros no console e sem violações
// graves de acessibilidade (axe-core, WCAG 2.1 A/AA).
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { SERVICE_ROLE_KEY, SUPABASE_URL } from "../integration/env";
import { loginAdmin } from "./helpers";

const ORG = "00000000-0000-4000-8000-000000000001";
const SEMFAZ = "00000000-0000-4000-8000-000000000101";

// Registros fictícios para abrir as fichas de detalhe.
test.beforeAll(async () => {
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const tag = Date.now().toString(36);
  const prop = await db
    .from("properties")
    .insert({
      organization_id: ORG,
      department_id: SEMFAZ,
      name: `Imóvel Varredura ${tag}`,
      street: "Rua Teste",
      address_number: "1",
      district: "Centro",
      postal_code: "49400-000",
      city: "Lagarto",
      state: "SE",
      purpose: "Teste de responsividade",
    })
    .select("id")
    .single();
  expect(prop.error).toBeNull();
  const ct = await db.from("contracts").insert({
    organization_id: ORG,
    property_id: prop.data!.id,
    contract_number: `CT-VAR-${tag}`,
    object: "Contrato fictício para a varredura de telas",
    signed_on: "2026-01-05",
    start_date: "2026-01-05",
    end_date: "2027-01-04",
    global_value: 24000,
    monthly_value: 2000,
  });
  expect(ct.error).toBeNull();
});

const APP_ROUTES = [
  "",
  "notificacoes/",
  "minha-conta/",
  "cadastro-guiado/",
  "contratos/",
  "contratos/novo/",
  "locadores/",
  "imoveis/",
  "imoveis/novo/",
  "unidades/",
  "financeiro/faturas/",
  "financeiro/faturas/nova/",
  "financeiro/alugueis/",
  "financeiro/pagamentos/",
  "financeiro/relatorios/",
  "financeiro/relatorios/lancamentos/",
  "demandas/",
  "demandas/categorias/",
  "calendario/",
  "aprovacoes/",
  "produtividade/",
  "relatorios/",
  "relatorios/?r=contratos_vencendo",
  "relatorios/?r=pagamentos",
  "administracao/departamentos/",
  "administracao/usuarios/",
  "administracao/perfis/",
  "administracao/regras/",
  "administracao/auditoria/",
];
// Fichas de detalhe: abertas a partir do primeiro item da lista correspondente.
const DETAIL_FROM_LIST: [string, RegExp][] = [
  ["imoveis/", /imoveis\/detalhe\/\?id=/],
  ["contratos/", /contratos\/detalhe\/\?id=/],
  ["administracao/usuarios/", /administracao\/usuarios\/detalhe\/\?id=/],
  ["administracao/perfis/", /administracao\/perfis\/detalhe\/\?id=/],
];
const PUBLIC_ROUTES = ["login/", "recuperar-senha/", "primeiro-acesso/", "definir-senha/"];

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      !/favicon|Failed to load resource: the server responded with a status of 40[134]/.test(m.text())
    )
      errors.push(`console: ${m.text()}`);
  });
  return errors;
}

async function checkPage(page: Page, route: string, errors: string[]) {
  await expect(page.getByRole("heading", { level: 1 }).first(), `título em /${route}`).toBeVisible();
  // Aguarda carregamentos (esqueletos) terminarem antes das verificações.
  await expect(page.locator('[role="status"][aria-label="Carregando"]')).toHaveCount(0, { timeout: 15_000 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `rolagem horizontal em /${route}`).toBeLessThanOrEqual(1);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = axe.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `/${route} ${v.id}: ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(" | ")}`,
    );
  expect(serious, `acessibilidade em /${route}`).toEqual([]);
  expect(errors, `erros de console em /${route}`).toEqual([]);
}

test("páginas públicas", async ({ page }) => {
  const errors = watchErrors(page);
  for (const route of PUBLIC_ROUTES) {
    await page.goto(route);
    await checkPage(page, route, errors);
  }
});

test("todas as páginas internas (administrador)", async ({ page }) => {
  test.setTimeout(240_000);
  await loginAdmin(page);
  const errors = watchErrors(page);
  for (const route of APP_ROUTES) {
    await page.goto(route);
    await checkPage(page, route, errors);
  }
  for (const [list, pattern] of DETAIL_FROM_LIST) {
    await page.goto(list);
    const link = page.locator('main a[href*="detalhe/?id="]:visible').first();
    await expect(link, `item para abrir a partir de /${list}`).toBeVisible();
    const href = (await link.getAttribute("href")) ?? "";
    expect(href).toMatch(pattern);
    await link.click();
    await checkPage(page, `${list}detalhe`, errors);
  }
});
