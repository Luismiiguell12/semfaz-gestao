// Fase 5: produtividade sem pontuação — indicadores próprios, equipe e aviso.
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { SERVICE_ROLE_KEY, SUPABASE_URL } from "../integration/env";
import { e2eState, expectNoHorizontalScroll, login } from "./helpers";

const ORG = "00000000-0000-4000-8000-000000000001";
const SEMFAZ = "00000000-0000-4000-8000-000000000101";

test.beforeAll(async () => {
  // O colaborador de teste passa a integrar a SEMFAZ e recebe uma demanda concluída.
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { colab } = e2eState();
  await db.from("profiles").update({ department_id: SEMFAZ }).eq("id", colab.id);
  const cat = await db.from("task_categories").select("id").eq("name", "Relatórios").single();
  const due = new Date(Date.now() + 2 * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Maceio" });
  const t = await db
    .from("tasks")
    .insert({
      organization_id: ORG,
      department_id: SEMFAZ,
      title: `Produtividade E2E ${Date.now().toString(36)}`,
      responsible_id: colab.id,
      category_id: cat.data!.id,
      due_date: due,
      complexity: "complex",
    })
    .select("id")
    .single();
  expect(t.error).toBeNull();
  await db
    .from("task_assignees")
    .insert({ organization_id: ORG, task_id: t.data!.id, user_id: colab.id, role: "responsible" });
  const done = await db.from("tasks").update({ status: "done" }).eq("id", t.data!.id);
  expect(done.error).toBeNull();
});

test("colaborador vê somente os próprios indicadores, com o aviso", async ({ page }) => {
  await login(page, e2eState().colab.email);
  await expect(page.getByRole("heading", { name: /^Olá/ })).toBeVisible();
  await expect(page.getByText("Minha produtividade no mês")).toBeVisible();
  await page.goto("produtividade/");
  await expect(page.getByRole("heading", { name: "Produtividade", exact: true })).toBeVisible();
  await expect(page.getByText(/não devem ser usados como avaliação automática e definitiva/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Meus indicadores" })).toBeVisible();
  const concluidas = page.getByText("Concluídas", { exact: true }).locator("..");
  await expect(concluidas).not.toContainText(/^Concluídas0/);
  await expect(page.getByRole("heading", { name: "Indicadores coletivos da equipe" })).toHaveCount(0);
  await page.getByLabel(/^Tipo de período/).selectOption("year");
  await expect(page.getByText(/Em andamento|Período fechado/).first()).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("gestor vê a equipe do escopo, sem ranking, e abre os indicadores de uma pessoa", async ({ page }) => {
  const { colab } = e2eState();
  await login(page, e2eState().manager.email);
  await expect(page.getByRole("heading", { name: /^Olá/ })).toBeVisible();
  await page.goto("produtividade/");
  await expect(page.getByRole("heading", { name: "Indicadores coletivos da equipe" })).toBeVisible();
  await expect(page.getByText("Ordem alfabética. Sem ranking nem pontuação.")).toBeVisible();
  const row = page.getByRole("button", { name: colab.name });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByRole("heading", { name: `Indicadores de ${colab.name}` })).toBeVisible();
  await expectNoHorizontalScroll(page);
});
