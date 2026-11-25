// Alteração 01: cadastro guiado a partir do contrato, menus reorganizados e
// Relatórios de despesas. Dados exclusivamente fictícios, criados no banco local.
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { SERVICE_ROLE_KEY, SUPABASE_URL } from "../integration/env";
import { e2eState, expectNoHorizontalScroll, login, loginAdmin } from "./helpers";

const ORG = "00000000-0000-4000-8000-000000000001";
const SEMFAZ = "00000000-0000-4000-8000-000000000101";
const svc = () => createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/** CPF fictício com dígitos verificadores válidos. */
function fakeCpf(): string {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  if (new Set(base).size === 1) base[0] = (base[0]! + 1) % 10;
  const dv = (digits: number[]) => {
    const sum = digits.reduce((acc, d, i) => acc + d * (digits.length + 1 - i), 0);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  return [...base, d1, d2].join("");
}

async function openMenu(page: Page) {
  const isMobile = (page.viewportSize()?.width ?? 1000) < 1024;
  if (isMobile) await page.getByRole("button", { name: "Abrir menu" }).click();
  return { nav: page.getByRole("navigation", { name: "Menu principal" }).last(), isMobile };
}

async function approveAsAdmin(browser: Browser, page: Page, requestUrl: string) {
  const ctx = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: "pt-BR" });
  const admin = await ctx.newPage();
  await loginAdmin(admin);
  await admin.goto(requestUrl);
  await expect(admin.getByRole("heading", { name: /Cadastro a partir de contrato/ })).toBeVisible();
  await admin.getByRole("button", { name: "Aprovar" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Aprovar" }).click();
  await expect(admin.getByText("Solicitação aprovada e efetivada.")).toBeVisible();
  await ctx.close();
}

async function startWizard(page: Page) {
  await page.goto("cadastro-guiado/");
  await page.getByRole("button", { name: "Iniciar novo cadastro" }).click();
  await expect(page.getByRole("heading", { name: "1. Dados do contrato" })).toBeVisible();
}

async function fillContract(page: Page, number: string) {
  await page.getByLabel(/^Número do contrato/).fill(number);
  await page.getByLabel(/^Data de assinatura/).fill("2026-01-01");
  await page.getByLabel(/^Objeto/).fill("Locação de imóvel para teste automatizado");
  await page.getByLabel(/^Início da vigência/).fill("2026-01-01");
  await page.getByLabel(/^Fim da vigência/).fill("2026-12-31");
  await page.getByLabel(/^Valor mensal/).fill("1.000,00");
  await page.getByRole("button", { name: /Usar a sugestão de valor global \(R\$\s12\.000,00\)/ }).click();
  await expect(page.getByLabel(/^Valor global/)).toHaveValue("12.000,00");
  await page.getByRole("button", { name: "Próxima etapa" }).click();
  await expect(page.getByRole("heading", { name: "2. Locadores" })).toBeVisible();
}

async function sendPackage(page: Page): Promise<string> {
  await expect(page.getByRole("heading", { name: "5. Revisão e envio" })).toBeVisible();
  await page.getByLabel(/^Justificativa/).fill("Contrato recebido pela SEMFAZ em teste automatizado");
  await page.getByRole("button", { name: "Enviar para aprovação" }).click();
  await expect(page.getByText("Cadastro enviado para aprovação.").first()).toBeVisible();
  const link = page.getByRole("link", { name: "Abrir a solicitação" });
  await expect(link).toBeVisible();
  return (await link.getAttribute("href"))!.replace(/^\/semfaz-gestao\//, "");
}

test("menu reorganizado: Gestão, Financeiro e itens em breve", async ({ page }) => {
  await login(page, e2eState().manager.email);
  await expect(page.getByRole("heading", { name: /^Olá/ })).toBeVisible();
  const { nav } = await openMenu(page);
  const links = nav.getByRole("link");
  const labels = (await links.allInnerTexts()).map((t) => t.trim());
  const order = [
    "Novo cadastro a partir de contrato",
    "Contratos",
    "Locadores",
    "Imóveis",
    "Unidades consumidoras",
    "Faturas",
    "Aluguéis",
    "Pagamentos",
    "Relatórios de despesas",
  ];
  const positions = order.map((l) => labels.indexOf(l));
  expect(positions.every((p) => p >= 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  for (const soon of ["Demandas", "Calendário", "Relatórios"]) {
    await expect(nav.locator('[aria-disabled="true"]', { hasText: soon }).first()).toBeVisible();
  }
  await nav.getByRole("link", { name: "Unidades consumidoras" }).click();
  await expect(page.getByRole("heading", { name: /Unidades consumidoras/ }).first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Trilha de navegação" })).toContainText(
    "Unidades consumidoras",
  );
  await page.goto("financeiro/relatorios/");
  await expect(page.getByRole("heading", { name: "Relatórios de despesas" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Trilha de navegação" })).toContainText(
    "Relatórios de despesas",
  );
  await page.goto("financeiro/pagamentos/");
  await expect(page.getByRole("heading", { name: "Pagamentos", exact: true })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("assistente: locador, imóvel e unidade novos em um único pacote", async ({ page, browser }) => {
  const tag = Date.now().toString(36).toUpperCase();
  const propertyName = `Imóvel Assistente ${tag}`;
  const landlordName = `Locador Assistente ${tag}`;
  const uc = `AS${tag}`.slice(0, 20);
  await login(page, e2eState().manager.email);
  await expect(page.getByRole("heading", { name: /^Olá/ })).toBeVisible();
  await startWizard(page);
  await fillContract(page, `CT-AS-${tag}`);

  // 2) Locador novo, cadastrado ali mesmo
  await page.getByRole("button", { name: "Cadastrar novo locador" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel(/^CPF/).fill(fakeCpf());
  await dlg.getByLabel(/^Nome/).fill(landlordName);
  await dlg.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByRole("link", { name: landlordName })).toBeVisible();
  await page.getByRole("button", { name: "Próxima etapa" }).click();

  // 3) Imóvel novo
  await expect(page.getByRole("heading", { name: "3. Imóvel" })).toBeVisible();
  await page.getByText("Cadastrar novo imóvel").click();
  await page.getByLabel(/^Nome ou identificação/).fill(propertyName);
  await page.getByLabel(/^Finalidade/).fill("Sede de teste do assistente");
  await page.getByLabel(/^CEP/).fill("49400-901");
  await page.getByLabel(/^Logradouro/).fill("Rua do Assistente");
  await page.getByLabel(/^Número$|^Número\*?$/).fill(tag.slice(-4));
  await page.getByLabel(/^Bairro/).fill("Centro");
  await page.getByLabel(/^Secretaria responsável/).selectOption(SEMFAZ);
  await page.getByRole("button", { name: "Próxima etapa" }).click();

  // 4) Unidade consumidora nova
  await expect(page.getByRole("heading", { name: "4. Unidades consumidoras" })).toBeVisible();
  await page.getByLabel(/^Fornecedor/).selectOption({ label: "Energisa (energia)" });
  await page.getByLabel(/^Número da UC/).fill(uc);
  await page.getByRole("button", { name: "Verificar" }).click();
  await page.getByLabel(/^Titular/).fill("Prefeitura Teste");
  await expect(page.getByLabel(/^Data de vinculação/)).toHaveValue("2026-01-01");
  await page.getByRole("button", { name: "Adicionar unidade" }).click();
  await expect(page.getByText(`Energisa ${uc}`)).toBeVisible();
  await page.getByRole("button", { name: "Próxima etapa" }).click();

  // 5) Revisão e envio: uma única solicitação
  const requestUrl = await sendPackage(page);
  await expectNoHorizontalScroll(page);
  await approveAsAdmin(browser, page, requestUrl);

  // Tudo criado e integrado: imóvel com locador, contrato atual e unidade.
  const db = svc();
  const prop = await db.from("properties").select("id").eq("name", propertyName).single();
  expect(prop.error).toBeNull();
  await page.goto(`imoveis/detalhe/?id=${prop.data!.id}`);
  await page.getByRole("tab", { name: "Locadores" }).click();
  await expect(page.getByRole("link", { name: landlordName })).toBeVisible();
  await page.getByRole("tab", { name: "Contratos" }).click();
  await expect(page.getByText("Contrato atual")).toBeVisible();
  await page.getByRole("tab", { name: "Unidades consumidoras" }).click();
  await expect(page.getByText(`Energisa ${uc}`)).toBeVisible();
});

test("assistente: renovação com locador e imóvel existentes, duplicidades e transferência de UC", async ({
  page,
  browser,
}) => {
  const tag = Date.now().toString(36).toUpperCase();
  const db = svc();
  const cpf = fakeCpf();
  const landlordName = `Locador Renovação ${tag}`;
  const propertyName = `Imóvel Renovação ${tag}`;
  const otherName = `Imóvel Anterior ${tag}`;
  const rnd = () => String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  const cep = `49${rnd()}-${rnd()}`;
  const uc = `RN${tag}`.slice(0, 20);
  const ll = await db
    .from("landlords")
    .insert({ organization_id: ORG, person_type: "individual", name: landlordName, document: cpf })
    .select("id")
    .single();
  expect(ll.error).toBeNull();
  const props = await db
    .from("properties")
    .insert([
      {
        organization_id: ORG,
        name: propertyName,
        street: "Rua da Renovação",
        address_number: "77",
        district: "Centro",
        postal_code: cep,
        city: "Lagarto",
        state: "SE",
        department_id: SEMFAZ,
        purpose: "Teste de renovação",
      },
      {
        organization_id: ORG,
        name: otherName,
        street: "Rua Anterior",
        address_number: "1",
        district: "Centro",
        postal_code: "49400-000",
        city: "Lagarto",
        state: "SE",
        department_id: SEMFAZ,
        purpose: "Teste de renovação",
      },
    ])
    .select("id, name");
  expect(props.error).toBeNull();
  const other = props.data!.find((p) => p.name === otherName)!;
  const sup = await db.from("suppliers").select("id").eq("name", "Energisa").single();
  const unit = await db
    .from("consumer_units")
    .insert({
      organization_id: ORG,
      supplier_id: sup.data!.id,
      identifier: uc,
      holder_name: "Prefeitura Teste",
    })
    .select("id")
    .single();
  await db.from("unit_assignments").insert({
    organization_id: ORG,
    unit_id: unit.data!.id,
    property_id: other.id,
    start_date: "2025-01-01",
  });

  await login(page, e2eState().manager.email);
  await expect(page.getByRole("heading", { name: /^Olá/ })).toBeVisible();
  await startWizard(page);
  await fillContract(page, `CT-RN-${tag}`);

  // 2) CPF já cadastrado: o sistema oferece o cadastro existente (sem duplicar)
  await page.getByRole("button", { name: "Cadastrar novo locador" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel(/^CPF/).fill(cpf);
  await dlg.getByLabel(/^Nome/).fill("Nome Diferente Qualquer");
  await dlg.getByRole("button", { name: "Cadastrar" }).click();
  await expect(dlg.getByText("CPF/CNPJ já cadastrado")).toBeVisible();
  await dlg.getByRole("button", { name: "Usar o cadastro existente" }).click();
  await expect(page.getByRole("link", { name: landlordName })).toBeVisible();
  const count = await db
    .from("landlords")
    .select("id", { count: "exact", head: true })
    .eq("name", "Nome Diferente Qualquer");
  expect(count.count).toBe(0);
  await page.getByRole("button", { name: "Próxima etapa" }).click();

  // 3) Possível duplicidade de imóvel → usar o existente
  await page.getByText("Cadastrar novo imóvel").click();
  await page.getByLabel(/^CEP/).fill(cep);
  await page.getByLabel(/^Número$|^Número\*?$/).fill("77");
  await expect(page.getByText("Possível imóvel já cadastrado")).toBeVisible();
  await page.getByRole("button", { name: "Usar este imóvel" }).click();
  await expect(page.locator("#w-prop")).toHaveValue(props.data!.find((p) => p.name === propertyName)!.id);
  await page.getByRole("button", { name: "Próxima etapa" }).click();

  // 4) UC já cadastrada em outro imóvel → transferência
  await page.getByLabel(/^Fornecedor/).selectOption({ label: "Energisa (energia)" });
  await page.getByLabel(/^Número da UC/).fill(uc.toLowerCase());
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page.getByText("Unidade já cadastrada")).toBeVisible();
  await expect(page.getByRole("link", { name: otherName })).toBeVisible();
  await page.getByRole("button", { name: "Transferir para este imóvel" }).click();
  await expect(page.getByText("Transferência", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Próxima etapa" }).click();

  const requestUrl = await sendPackage(page);
  await approveAsAdmin(browser, page, requestUrl);

  // Histórico preservado: vínculo anterior encerrado na véspera do novo.
  const hist = await db
    .from("unit_assignments")
    .select("property_id, start_date, end_date")
    .eq("unit_id", unit.data!.id)
    .order("start_date");
  expect(hist.data).toHaveLength(2);
  expect(hist.data![0]!.end_date).toBe("2025-12-31");
  expect(hist.data![1]!.end_date).toBeNull();
});

test("relatórios de despesas: totais, filtro por imóvel e detalhamento", async ({ page }) => {
  const tag = Date.now().toString(36).toUpperCase();
  const db = svc();
  const prop = await db
    .from("properties")
    .insert({
      organization_id: ORG,
      name: `Imóvel Relatório ${tag}`,
      street: "Rua do Relatório",
      address_number: "5",
      district: "Centro",
      postal_code: "49400-000",
      city: "Lagarto",
      state: "SE",
      department_id: SEMFAZ,
      purpose: "Teste de relatórios",
    })
    .select("id")
    .single();
  const sup = await db.from("suppliers").select("id").eq("name", "Iguá").single();
  const unit = await db
    .from("consumer_units")
    .insert({
      organization_id: ORG,
      supplier_id: sup.data!.id,
      identifier: `RL${tag}`.slice(0, 20),
      holder_name: "Prefeitura Teste",
    })
    .select("id")
    .single();
  await db.from("unit_assignments").insert({
    organization_id: ORG,
    unit_id: unit.data!.id,
    property_id: prop.data!.id,
    start_date: "2025-01-01",
  });
  const inv = await db.from("invoices").insert([
    {
      organization_id: ORG,
      unit_id: unit.data!.id,
      supplier_id: sup.data!.id,
      property_id: prop.data!.id,
      competence: "2025-03-01",
      consumption: 12,
      measure_unit: "m³",
      amount: 123.45,
      due_date: "2025-04-10",
    },
    {
      organization_id: ORG,
      unit_id: unit.data!.id,
      supplier_id: sup.data!.id,
      property_id: prop.data!.id,
      competence: "2025-04-01",
      consumption: 15,
      measure_unit: "m³",
      amount: 200,
      due_date: "2025-05-10",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: "Cancelada no teste automatizado",
    },
  ]);
  expect(inv.error).toBeNull();

  await login(page, e2eState().manager.email);
  await expect(page.getByRole("heading", { name: /^Olá/ })).toBeVisible();
  await page.goto("financeiro/relatorios/");
  await page.getByLabel(/^De\*?$/).fill("2025-01");
  await page.getByLabel(/^Até\*?$/).fill("2025-06");
  await page.getByLabel(/^Imóvel\*?$/).selectOption({ label: `Imóvel Relatório ${tag}` });
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  // Cancelada fora do total; valor em aberto e vencido.
  const resumo = page.getByRole("region", { name: "Resumo" });
  await expect(resumo).toContainText(/Total de despesas\s*R\$\s123,45/);
  await expect(resumo).toContainText(/Total pago\s*R\$\s0,00/);
  await expect(resumo).toContainText(/Vencido\s*R\$\s123,45/);
  await expect(page.getByText("Comparativo com o mesmo período do ano anterior")).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Detalhamento: o valor abre os lançamentos que o compõem.
  await page
    .getByRole("region", { name: /Por tipo de despesa/ })
    .getByRole("link", { name: "R$ 123,45" })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Lançamentos do relatório" })).toBeVisible();
  await expect(page.getByText("1 lançamento", { exact: true })).toBeVisible();
  await expect(page.getByText("R$ 123,45").first()).toBeVisible();
});
