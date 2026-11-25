// Fase 6: relatórios com filtros, prévia e exportação auditada (Excel e PDF).
import { expect, test } from "@playwright/test";
import { e2eState, expectNoHorizontalScroll, login } from "./helpers";

test("gestor filtra, vê a prévia e exporta Excel e PDF", async ({ page }) => {
  await login(page, e2eState().manager.email);
  await expect(page.getByRole("heading", { name: /^Olá/ })).toBeVisible();
  await page.goto("relatorios/");
  await expect(page.getByRole("heading", { name: "Relatórios", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Gestão" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Financeiro" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Acompanhamento" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page
    .getByRole("region", { name: "Gestão" })
    .getByRole("link", { name: /^Contratos próximos do vencimento/ })
    .click();
  await expect(page.getByRole("heading", { name: "Contratos próximos do vencimento" })).toBeVisible();
  await page.getByRole("link", { name: "Todos os relatórios" }).click();
  await page
    .getByRole("region", { name: "Gestão" })
    .getByRole("link", { name: /^Imóveis/ })
    .click();
  await expect(page.getByRole("heading", { name: "Imóveis", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Prévia" })).toBeVisible();
  await page.getByLabel("Situação").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(
    page
      .getByRole("region", { name: "Prévia" })
      .getByText(/linha|Nenhum registro/)
      .first(),
  ).toBeVisible();
  await expectNoHorizontalScroll(page);

  const [xlsx] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Excel" }).click(),
  ]);
  expect(xlsx.suggestedFilename()).toMatch(/^semfaz-imoveis-\d+\.xlsx$/);
  await expect(page.getByText("A exportação foi registrada na auditoria.").first()).toBeVisible();

  const [pdf] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "PDF" }).click(),
  ]);
  expect(pdf.suggestedFilename()).toMatch(/^semfaz-imoveis-\d+\.pdf$/);
});

test("exportação nas telas de despesas e de produtividade", async ({ page }) => {
  await login(page, e2eState().manager.email);
  await expect(page.getByRole("heading", { name: /^Olá/ })).toBeVisible();
  await page.goto("financeiro/relatorios/");
  await expect(page.getByRole("heading", { name: "Relatórios de despesas" })).toBeVisible();
  const [desp] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "PDF" }).click(),
  ]);
  expect(desp.suggestedFilename()).toMatch(/^semfaz-despesas_lancamentos-\d+\.pdf$/);

  await page.goto("produtividade/");
  await expect(page.getByRole("heading", { name: "Produtividade", exact: true })).toBeVisible();
  const [prod] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Excel" }).click(),
  ]);
  expect(prod.suggestedFilename()).toMatch(/^semfaz-produtividade-\d+\.xlsx$/);
});

test("colaborador consulta relatórios sem botões de exportação", async ({ page }) => {
  await login(page, e2eState().colab.email);
  await expect(page.getByRole("heading", { name: /^Olá/ })).toBeVisible();
  await page.goto("relatorios/");
  await expect(page.getByText(/A exportação para Excel e PDF depende da permissão/)).toBeVisible();
  await page
    .getByRole("region", { name: "Acompanhamento" })
    .getByRole("link", { name: /^Demandas/ })
    .click();
  await expect(page.getByRole("heading", { name: "Demandas", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Prévia" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Excel" })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});
