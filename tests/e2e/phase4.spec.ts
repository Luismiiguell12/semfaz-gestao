// Fase 4: demandas (lista, kanban com arrastar, detalhe, comentários),
// calendário (mês, semana e dia) e exclusão por aprovação.
import { expect, test, type Page } from "@playwright/test";
import { e2eState, expectNoHorizontalScroll, login, loginAdmin } from "./helpers";

const SEMFAZ = "00000000-0000-4000-8000-000000000101";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Maceio" });
const plusDays = (n: number) =>
  new Date(Date.now() + n * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Maceio" });

async function createTask(page: Page, title: string) {
  await page.goto("demandas/");
  await page.getByRole("button", { name: "Nova demanda" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel(/^Título/).fill(title);
  await dlg.getByLabel(/^Descrição/).fill("Demanda criada em teste automatizado");
  await dlg.getByLabel(/^Secretaria/).selectOption(SEMFAZ);
  await dlg.getByLabel(/^Categoria/).selectOption({ label: "Financeiro" });
  await dlg.getByLabel(/^Responsável principal/).selectOption({ label: e2eState().manager.name });
  await dlg.getByLabel("Buscar participante").fill(e2eState().colab.name);
  await dlg.getByRole("list", { name: "Pessoas" }).getByText(e2eState().colab.name).click();
  await dlg.getByLabel(/^Prazo/).fill(plusDays(1));
  await dlg.getByLabel(/^Prioridade/).selectOption("high");
  await dlg.getByRole("button", { name: "Criar demanda" }).click();
  await expect(page.getByText("Demanda criada.")).toBeVisible();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

test("demanda: criação, comentário, status, kanban e participante", async ({ page, browser }) => {
  const title = `Conferir processo E2E ${Date.now().toString(36)}`;
  await login(page, e2eState().manager.email);
  await expect(page.getByRole("heading", { name: /^Olá/ })).toBeVisible();
  await createTask(page, title);
  const taskUrl = page.url().replace(/^.*\/semfaz-gestao\//, "");
  await expect(page.getByText(e2eState().colab.name)).toBeVisible();

  // Comentário
  await page.getByRole("tab", { name: /Comentários/ }).click();
  await page.getByLabel("Novo comentário").fill("Primeiro comentário do teste");
  await page.getByRole("button", { name: "Comentar" }).click();
  await expect(page.getByText("Primeiro comentário do teste")).toBeVisible();

  // Status pelo detalhe
  await page.getByLabel("Mover para").selectOption("in_progress");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByText("Situação alterada para Em andamento.")).toBeVisible();
  await page.getByRole("tab", { name: "Histórico" }).click();
  await expect(page.getByText(/A fazer → Em andamento/)).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Kanban: arrastar (computador) ou "Mover para" no cartão (celular)
  await page.goto("demandas/?visao=kanban");
  const card = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: title }) });
  await expect(card).toBeVisible();
  const isMobile = (page.viewportSize()?.width ?? 1000) < 1024;
  if (isMobile) {
    await card.getByLabel(`Mover ${title} para`).selectOption("waiting");
  } else {
    const handle = card.getByRole("button", { name: /^Arrastar/ });
    const target = page.getByRole("region", { name: /^Aguardando terceiros:/ });
    await target.scrollIntoViewIfNeeded();
    const hb = (await handle.boundingBox())!;
    const tb = (await target.boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + 20, hb.y + 20, { steps: 5 });
    await page.mouse.move(tb.x + tb.width / 2, tb.y + 60, { steps: 15 });
    await page.mouse.up();
  }
  await expect(page.getByText(/movida para Aguardando terceiros/)).toBeVisible();
  await expect(
    page.getByRole("region", { name: /^Aguardando terceiros:/ }).getByRole("link", { name: title }),
  ).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Participante vê a demanda e foi notificado
  const ctx = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: "pt-BR" });
  const colab = await ctx.newPage();
  await login(colab, e2eState().colab.email);
  await expect(colab.getByRole("heading", { name: /^Olá/ })).toBeVisible();
  await colab.goto(taskUrl);
  await expect(colab.getByRole("heading", { name: title })).toBeVisible();
  await colab.goto("notificacoes/");
  await expect(colab.getByText(`Você foi incluído na demanda "${title}".`).first()).toBeVisible();
  await ctx.close();
});

test("calendário: evento no mês, semana e dia", async ({ page }) => {
  const title = `Reunião E2E ${Date.now().toString(36)}`;
  await login(page, e2eState().manager.email);
  await expect(page.getByRole("heading", { name: /^Olá/ })).toBeVisible();
  await page.goto(`calendario/?visao=dia&data=${today()}`);
  await page.getByRole("button", { name: "Novo evento" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel(/^Título/).fill(title);
  await dlg.getByLabel(/^Data/).fill(today());
  await dlg.getByLabel(/^Início/).fill("23:00");
  await dlg.getByLabel(/^Término/).fill("23:30");
  await dlg.getByLabel(/^Local/).fill("Sala de reuniões da SEMFAZ");
  await dlg.getByRole("button", { name: "Cadastrar evento" }).click();
  await expect(page.getByText("Evento cadastrado.")).toBeVisible();

  await expect(page.getByRole("button", { name: new RegExp(title) })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await expect(page.getByRole("dialog").getByText("Sala de reuniões da SEMFAZ")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Semana", exact: true }).click();
  await expect(page.getByRole("button", { name: new RegExp(title) })).toBeVisible();
  await page.getByRole("button", { name: "Mês", exact: true }).click();
  await expect(
    page
      .getByRole("button", { name: new RegExp(title) })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("exclusão de demanda: criador solicita e administrador aprova", async ({ page, browser }) => {
  const title = `Demanda a excluir E2E ${Date.now().toString(36)}`;
  await login(page, e2eState().manager.email);
  await expect(page.getByRole("heading", { name: /^Olá/ })).toBeVisible();
  await createTask(page, title);
  const taskUrl = page.url().replace(/^.*\/semfaz-gestao\//, "");
  await page.getByRole("button", { name: "Solicitar exclusão" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel(/^Justificativa/).fill("Demanda cadastrada em duplicidade no teste");
  await dlg.getByRole("button", { name: "Enviar para aprovação" }).click();
  await expect(page.getByText("Solicitação de exclusão enviada para aprovação.")).toBeVisible();
  await expect(page.getByText("Exclusão solicitada")).toBeVisible();
  const requestHref = await page.getByRole("link", { name: "Abrir a solicitação" }).getAttribute("href");

  const ctx = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: "pt-BR" });
  const admin = await ctx.newPage();
  await loginAdmin(admin);
  await admin.goto(requestHref!.replace(/^\/semfaz-gestao\//, ""));
  await expect(
    admin.getByRole("heading", { name: "Exclusão de demanda (solicitada pelo criador)" }),
  ).toBeVisible();
  await admin.getByRole("button", { name: "Aprovar" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Aprovar" }).click();
  await expect(admin.getByText("Solicitação aprovada e efetivada.")).toBeVisible();
  await ctx.close();

  await page.goto(taskUrl);
  await expect(page.getByText("Demanda não encontrada.")).toBeVisible();
});
