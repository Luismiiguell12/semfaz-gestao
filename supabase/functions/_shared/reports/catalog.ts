// Catálogo de relatórios (Fase 6). Compartilhado entre o navegador (prévia) e a
// Edge Function reports-export (Excel/PDF): a mesma consulta, com o cliente do
// próprio usuário, gera a prévia e o arquivo, sempre sob a RLS.
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// deno-lint-ignore no-explicit-any
type Client = SupabaseClient<any, any, any>;
export type Row = Record<string, string | number | boolean | null>;

export type ColumnType =
  "text" | "date" | "datetime" | "competence" | "money" | "number" | "percent" | "bool";
export interface Column {
  key: string;
  label: string;
  type: ColumnType;
  /** Largura relativa (PDF e Excel). */
  width?: number;
}

export type FilterKind =
  "month" | "select" | "department" | "property" | "category" | "supplier" | "periodType";
export interface FilterDef {
  key: keyof ReportFilters;
  label: string;
  kind: FilterKind;
  options?: { value: string; label: string }[];
  hint?: string;
}

export interface ReportDef {
  id: string;
  title: string;
  group: "Gestão" | "Financeiro" | "Acompanhamento";
  description: string;
  /** Permissão para ver o relatório (além da RLS). Exportar exige também reports.export. */
  permission: string | null;
  filters: FilterDef[];
  columns: Column[];
  notice?: string;
  fetch: (c: Client, f: ReportFilters, limit: number) => Promise<Row[]>;
}

const month = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Mês no formato AAAA-MM.")
  .optional();
const uuid = z.string().uuid().optional();
export const reportFiltersSchema = z
  .object({
    de: month,
    ate: month,
    status: z
      .string()
      .max(40)
      .regex(/^[a-z_]*$/)
      .optional(),
    tipo: z
      .string()
      .max(40)
      .regex(/^[a-z_]*$/)
      .optional(),
    movimento: z.enum(["payment", "reversal", ""]).optional(),
    periodo: z.enum(["month", "quarter", "semester", "year"]).optional(),
    referencia: month,
    departamento: uuid,
    imovel: uuid,
    categoria: uuid,
    fornecedor: uuid,
  })
  .strict();
export type ReportFilters = z.infer<typeof reportFiltersSchema>;

export const exportRequestSchema = z.object({
  report: z.string().regex(/^[a-z_]{3,40}$/),
  format: z.enum(["xlsx", "pdf"]),
  filters: reportFiltersSchema.default({}),
});

export const MAX_EXPORT_ROWS = 5000;
export const PREVIEW_ROWS = 100;

// ------------------------------------------------------------ utilidades
async function check<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

/** Ids do departamento e de toda a estrutura abaixo dele. */
async function subtree(c: Client, id?: string): Promise<string[] | undefined> {
  if (!id) return undefined;
  const deps = await check<{ id: string; parent_id: string | null }[]>(
    c.from("departments").select("id, parent_id"),
  );
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const d of deps) {
      if (d.parent_id && ids.has(d.parent_id) && !ids.has(d.id)) {
        ids.add(d.id);
        grew = true;
      }
    }
  }
  return [...ids];
}

async function departmentNames(c: Client): Promise<Map<string, string>> {
  const deps = await check<{ id: string; name: string }[]>(c.from("departments").select("id, name"));
  return new Map(deps.map((d) => [d.id, d.name]));
}

async function userNames(c: Client): Promise<Map<string, string>> {
  const us = await check<{ id: string; full_name: string }[]>(
    c.from("user_directory").select("id, full_name"),
  );
  return new Map(us.map((u) => [u.id, u.full_name]));
}

/** Último dia do mês AAAA-MM. */
const monthEnd = (m: string) => {
  const [y, mo] = m.split("-").map(Number) as [number, number];
  return `${m}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, "0")}`;
};
/** Primeiro instante do mês seguinte, em Maceió (-03:00), para filtros de data/hora. */
const nextMonthStartTs = (m: string) => {
  const [y, mo] = m.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, mo, 1));
  return `${d.toISOString().slice(0, 10)}T00:00:00-03:00`;
};

const CHARGE_STATUS: { value: string; label: string }[] = [
  { value: "pending", label: "Pendente" },
  { value: "partially_paid", label: "Parcialmente paga" },
  { value: "paid", label: "Paga" },
  { value: "overdue", label: "Vencida" },
  { value: "cancelled", label: "Cancelada" },
];
const LABEL = {
  charge: Object.fromEntries(CHARGE_STATUS.map((s) => [s.value, s.label])) as Record<string, string>,
  property: { active: "Ativo", inactive: "Inativo", vacated: "Desocupado" } as Record<string, string>,
  validity: {
    not_started: "Não iniciado",
    active: "Vigente",
    expiring: "Próximo do vencimento",
    expired: "Vencido",
  } as Record<string, string>,
  amendment: { term: "Prazo", value: "Valor", term_and_value: "Prazo e valor", other: "Outro" } as Record<
    string,
    string
  >,
  task: {
    todo: "A fazer",
    in_progress: "Em andamento",
    waiting: "Aguardando terceiros",
    review: "Em revisão",
    done: "Concluída",
    cancelled: "Cancelada",
  } as Record<string, string>,
  level: {
    low: "Baixa",
    medium: "Média",
    normal: "Normal",
    high: "Alta",
    critical: "Crítica",
    urgent: "Urgente",
  } as Record<string, string>,
  complexity: {
    simple: "Simples",
    medium: "Média",
    complex: "Complexa",
    very_complex: "Muito complexa",
  } as Record<string, string>,
  approval: {
    pending: "Pendente",
    approved: "Aprovada",
    rejected: "Rejeitada",
    cancelled: "Cancelada",
    failed: "Não efetivada",
  } as Record<string, string>,
  kind: { rent: "Aluguel", water: "Água", energy: "Energia" } as Record<string, string>,
};
const opts = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }));

const F = {
  de: { key: "de", label: "De (mês)", kind: "month" } as FilterDef,
  ate: { key: "ate", label: "Até (mês)", kind: "month" } as FilterDef,
  departamento: { key: "departamento", label: "Secretaria", kind: "department" } as FilterDef,
  imovel: { key: "imovel", label: "Imóvel", kind: "property" } as FilterDef,
};

// ------------------------------------------------------------ relatórios
async function invoices(
  c: Client,
  f: ReportFilters,
  limit: number,
  kind?: "water" | "energy",
  onlyOpen = false,
): Promise<Row[]> {
  const deps = await subtree(c, f.departamento);
  let q = c.from("invoices_overview").select("*").order("competence", { ascending: false }).limit(limit);
  if (kind) q = q.eq("supplier_kind", kind);
  else if (f.tipo === "water" || f.tipo === "energy") q = q.eq("supplier_kind", f.tipo);
  if (f.de) q = q.gte("competence", `${f.de}-01`);
  if (f.ate) q = q.lte("competence", `${f.ate}-01`);
  if (f.imovel) q = q.eq("property_id", f.imovel);
  if (deps) q = q.in("department_id", deps);
  if (onlyOpen) q = q.in("status", ["pending", "partially_paid", "overdue"]);
  if (f.status) q = q.eq("status", f.status);
  const rows = await check<Record<string, unknown>[]>(q);
  return rows.map((r) => ({
    competencia: r.competence as string,
    fornecedor: r.supplier_name as string,
    unidade: r.unit_identifier as string,
    imovel: r.property_name as string,
    consumo: Number(r.consumption),
    medida: r.measure_unit as string,
    valor: Number(r.amount),
    pago: Number(r.paid_total),
    saldo: Number(r.balance),
    vencimento: r.due_date as string,
    situacao: LABEL.charge[r.status as string] ?? (r.status as string),
  }));
}
const INVOICE_COLUMNS: Column[] = [
  { key: "competencia", label: "Competência", type: "competence", width: 1 },
  { key: "fornecedor", label: "Fornecedor", type: "text", width: 1.1 },
  { key: "unidade", label: "UC/Matrícula", type: "text", width: 1.2 },
  { key: "imovel", label: "Imóvel", type: "text", width: 2.2 },
  { key: "consumo", label: "Consumo", type: "number", width: 0.9 },
  { key: "medida", label: "Medida", type: "text", width: 0.6 },
  { key: "valor", label: "Valor", type: "money", width: 1 },
  { key: "pago", label: "Pago", type: "money", width: 1 },
  { key: "saldo", label: "Saldo", type: "money", width: 1 },
  { key: "vencimento", label: "Vencimento", type: "date", width: 1 },
  { key: "situacao", label: "Situação", type: "text", width: 1.1 },
];
const INVOICE_FILTERS = (withStatus = true): FilterDef[] => [
  F.de,
  F.ate,
  F.departamento,
  F.imovel,
  ...(withStatus
    ? [{ key: "status", label: "Situação", kind: "select", options: CHARGE_STATUS } as FilterDef]
    : []),
];

export const REPORTS: ReportDef[] = [
  {
    id: "imoveis",
    title: "Imóveis",
    group: "Gestão",
    description: "Imóveis do seu escopo com endereço, secretaria e situação.",
    permission: "properties.view",
    filters: [
      F.departamento,
      { key: "status", label: "Situação", kind: "select", options: opts(LABEL.property) },
    ],
    columns: [
      { key: "imovel", label: "Imóvel", type: "text", width: 2 },
      { key: "endereco", label: "Endereço", type: "text", width: 2.6 },
      { key: "municipio", label: "Município/UF", type: "text", width: 1.1 },
      { key: "cep", label: "CEP", type: "text", width: 0.8 },
      { key: "secretaria", label: "Secretaria", type: "text", width: 1.8 },
      { key: "finalidade", label: "Finalidade", type: "text", width: 1.6 },
      { key: "situacao", label: "Situação", type: "text", width: 0.8 },
    ],
    async fetch(c, f, limit) {
      const deps = await subtree(c, f.departamento);
      const names = await departmentNames(c);
      let q = c.from("properties").select("*").is("deleted_at", null).order("name").limit(limit);
      if (deps) q = q.in("department_id", deps);
      if (f.status) q = q.eq("status", f.status);
      return (await check<Record<string, unknown>[]>(q)).map((p) => ({
        imovel: p.name as string,
        endereco: [p.street, p.address_number, p.complement, p.district].filter(Boolean).join(", "),
        municipio: `${p.city}/${p.state}`,
        cep: p.postal_code as string,
        secretaria: names.get(p.department_id as string) ?? "Acesso restrito",
        finalidade: p.purpose as string,
        situacao: LABEL.property[p.status as string] ?? (p.status as string),
      }));
    },
  },
  ...(["contratos", "contratos_vencendo"] as const).map((id): ReportDef => ({
    id,
    title: id === "contratos" ? "Contratos" : "Contratos próximos do vencimento",
    group: "Gestão",
    description:
      id === "contratos"
        ? "Contratos com vigência e valor vigentes (considerando aditivos aprovados)."
        : "Contratos com fim de vigência próximo (prazo configurado em Regras e listas).",
    permission: "contracts.view",
    filters:
      id === "contratos"
        ? [
            F.departamento,
            F.imovel,
            { key: "status", label: "Vigência", kind: "select", options: opts(LABEL.validity) },
          ]
        : [F.departamento, F.imovel],
    columns: [
      { key: "contrato", label: "Contrato", type: "text", width: 1 },
      { key: "processo", label: "Processo", type: "text", width: 1 },
      { key: "imovel", label: "Imóvel", type: "text", width: 2 },
      { key: "inicio", label: "Início", type: "date", width: 0.9 },
      { key: "fim", label: "Fim vigente", type: "date", width: 0.9 },
      { key: "dias", label: "Dias para o fim", type: "number", width: 0.8 },
      { key: "mensal", label: "Valor mensal vigente", type: "money", width: 1.1 },
      { key: "global", label: "Valor global", type: "money", width: 1.1 },
      { key: "vigencia", label: "Vigência", type: "text", width: 1.2 },
    ],
    async fetch(c, f, limit) {
      const deps = await subtree(c, f.departamento);
      let q = c.from("contracts_overview").select("*").order("effective_end_date").limit(limit);
      if (id === "contratos_vencendo") q = q.eq("validity_status", "expiring");
      else if (f.status) q = q.eq("validity_status", f.status);
      if (deps) q = q.in("department_id", deps);
      if (f.imovel) q = q.eq("property_id", f.imovel);
      return (await check<Record<string, unknown>[]>(q)).map((r) => ({
        contrato: r.contract_number as string,
        processo: (r.process_number as string) ?? null,
        imovel: r.property_name as string,
        inicio: r.start_date as string,
        fim: r.effective_end_date as string,
        dias: r.days_to_end === null ? null : Number(r.days_to_end),
        mensal: Number(r.effective_monthly_value),
        global: Number(r.global_value),
        vigencia: LABEL.validity[r.validity_status as string] ?? (r.validity_status as string),
      }));
    },
  })),
  {
    id: "aditivos",
    title: "Aditivos",
    group: "Gestão",
    description: "Aditivos aprovados, por data de assinatura.",
    permission: "contracts.view",
    filters: [F.de, F.ate, { key: "tipo", label: "Tipo", kind: "select", options: opts(LABEL.amendment) }],
    columns: [
      { key: "contrato", label: "Contrato", type: "text", width: 1 },
      { key: "imovel", label: "Imóvel", type: "text", width: 1.8 },
      { key: "aditivo", label: "Aditivo", type: "text", width: 0.8 },
      { key: "tipo", label: "Tipo", type: "text", width: 1 },
      { key: "assinatura", label: "Assinatura", type: "date", width: 0.9 },
      { key: "novo_fim", label: "Nova vigência (fim)", type: "date", width: 1 },
      { key: "novo_valor", label: "Novo valor mensal", type: "money", width: 1 },
      { key: "descricao", label: "Descrição", type: "text", width: 2.6 },
    ],
    async fetch(c, f, limit) {
      let q = c
        .from("contract_amendments")
        .select("*")
        .is("deleted_at", null)
        .order("signed_on", { ascending: false })
        .limit(limit);
      if (f.de) q = q.gte("signed_on", `${f.de}-01`);
      if (f.ate) q = q.lte("signed_on", monthEnd(f.ate));
      if (f.tipo) q = q.eq("kind", f.tipo);
      const rows = await check<Record<string, unknown>[]>(q);
      const contracts = new Map(
        (
          await check<{ id: string; contract_number: string; property_name: string }[]>(
            c.from("contracts_overview").select("id, contract_number, property_name"),
          )
        ).map((x) => [x.id, x]),
      );
      return rows.map((r) => ({
        contrato: contracts.get(r.contract_id as string)?.contract_number ?? "Acesso restrito",
        imovel: contracts.get(r.contract_id as string)?.property_name ?? null,
        aditivo: r.amendment_number as string,
        tipo: LABEL.amendment[r.kind as string] ?? (r.kind as string),
        assinatura: r.signed_on as string,
        novo_fim: (r.new_end_date as string) ?? null,
        novo_valor: r.new_monthly_value === null ? null : Number(r.new_monthly_value),
        descricao: r.description as string,
      }));
    },
  },
  {
    id: "despesas_agua",
    title: "Despesas de água",
    group: "Financeiro",
    description: "Faturas da Iguá por competência (canceladas incluídas apenas se filtradas).",
    permission: "invoices.view",
    filters: INVOICE_FILTERS(),
    columns: INVOICE_COLUMNS,
    fetch: (c, f, l) => invoices(c, f, l, "water"),
  },
  {
    id: "despesas_energia",
    title: "Despesas de energia",
    group: "Financeiro",
    description: "Faturas da Energisa por competência.",
    permission: "invoices.view",
    filters: INVOICE_FILTERS(),
    columns: INVOICE_COLUMNS,
    fetch: (c, f, l) => invoices(c, f, l, "energy"),
  },
  {
    id: "faturas_pendentes",
    title: "Faturas pendentes",
    group: "Financeiro",
    description: "Faturas com saldo em aberto (pendentes, parcialmente pagas e vencidas).",
    permission: "invoices.view",
    filters: [
      ...INVOICE_FILTERS(false),
      {
        key: "tipo",
        label: "Tipo",
        kind: "select",
        options: [
          { value: "water", label: "Água" },
          { value: "energy", label: "Energia" },
        ],
      },
    ],
    columns: INVOICE_COLUMNS,
    fetch: (c, f, l) => invoices(c, f, l, undefined, true),
  },
  {
    id: "alugueis",
    title: "Aluguéis",
    group: "Financeiro",
    description: "Aluguéis gerados a partir dos contratos, por competência.",
    permission: "invoices.view",
    filters: INVOICE_FILTERS(),
    columns: [
      { key: "competencia", label: "Competência", type: "competence", width: 1 },
      { key: "contrato", label: "Contrato", type: "text", width: 1 },
      { key: "imovel", label: "Imóvel", type: "text", width: 2.2 },
      { key: "valor", label: "Valor", type: "money", width: 1 },
      { key: "pago", label: "Pago", type: "money", width: 1 },
      { key: "saldo", label: "Saldo", type: "money", width: 1 },
      { key: "vencimento", label: "Vencimento", type: "date", width: 1 },
      { key: "situacao", label: "Situação", type: "text", width: 1.1 },
    ],
    async fetch(c, f, limit) {
      const deps = await subtree(c, f.departamento);
      let q = c
        .from("rent_charges_overview")
        .select("*")
        .order("competence", { ascending: false })
        .limit(limit);
      if (f.de) q = q.gte("competence", `${f.de}-01`);
      if (f.ate) q = q.lte("competence", `${f.ate}-01`);
      if (f.imovel) q = q.eq("property_id", f.imovel);
      if (deps) q = q.in("department_id", deps);
      if (f.status) q = q.eq("status", f.status);
      return (await check<Record<string, unknown>[]>(q)).map((r) => ({
        competencia: r.competence as string,
        contrato: r.contract_number as string,
        imovel: r.property_name as string,
        valor: Number(r.amount),
        pago: Number(r.paid_total),
        saldo: Number(r.balance),
        vencimento: r.due_date as string,
        situacao: LABEL.charge[r.status as string] ?? (r.status as string),
      }));
    },
  },
  {
    id: "pagamentos",
    title: "Pagamentos",
    group: "Financeiro",
    description: "Pagamentos e estornos aprovados, pela data do pagamento (estornos com valor negativo).",
    permission: "invoices.view",
    filters: [
      F.de,
      F.ate,
      F.imovel,
      { key: "tipo", label: "Despesa", kind: "select", options: opts(LABEL.kind) },
      {
        key: "movimento",
        label: "Movimento",
        kind: "select",
        options: [
          { value: "payment", label: "Pagamento" },
          { value: "reversal", label: "Estorno" },
        ],
      },
    ],
    columns: [
      { key: "data", label: "Data", type: "date", width: 0.9 },
      { key: "movimento", label: "Movimento", type: "text", width: 0.9 },
      { key: "despesa", label: "Despesa", type: "text", width: 0.8 },
      { key: "lancamento", label: "Lançamento", type: "text", width: 2 },
      { key: "competencia", label: "Competência", type: "competence", width: 1 },
      { key: "imovel", label: "Imóvel", type: "text", width: 2 },
      { key: "valor", label: "Valor", type: "money", width: 1 },
    ],
    async fetch(c, f, limit) {
      let q = c
        .from("payments")
        .select("id, kind, amount, paid_on, invoice_id, rent_charge_id")
        .order("paid_on", { ascending: false })
        .limit(limit);
      if (f.de) q = q.gte("paid_on", `${f.de}-01`);
      if (f.ate) q = q.lte("paid_on", monthEnd(f.ate));
      if (f.movimento) q = q.eq("kind", f.movimento);
      const pays = await check<Record<string, unknown>[]>(q);
      const invIds = [...new Set(pays.map((p) => p.invoice_id).filter(Boolean))] as string[];
      const rentIds = [...new Set(pays.map((p) => p.rent_charge_id).filter(Boolean))] as string[];
      const inv = new Map(
        (invIds.length
          ? await check<Record<string, unknown>[]>(
              c
                .from("invoices_overview")
                .select(
                  "id, competence, property_id, property_name, supplier_name, supplier_kind, unit_identifier",
                )
                .in("id", invIds),
            )
          : []
        ).map((i) => [i.id as string, i]),
      );
      const rent = new Map(
        (rentIds.length
          ? await check<Record<string, unknown>[]>(
              c
                .from("rent_charges_overview")
                .select("id, competence, property_id, property_name, contract_number")
                .in("id", rentIds),
            )
          : []
        ).map((r) => [r.id as string, r]),
      );
      return pays
        .map((p) => {
          const i = p.invoice_id ? inv.get(p.invoice_id as string) : undefined;
          const r = p.rent_charge_id ? rent.get(p.rent_charge_id as string) : undefined;
          const kind = i ? (i.supplier_kind as string) : "rent";
          return {
            _kind: kind,
            _property: ((i ?? r)?.property_id as string) ?? null,
            data: p.paid_on as string,
            movimento: p.kind === "reversal" ? "Estorno" : "Pagamento",
            despesa: LABEL.kind[kind] ?? kind,
            lancamento: i
              ? `${i.supplier_name} ${i.unit_identifier}`
              : r
                ? `Contrato ${r.contract_number}`
                : "Acesso restrito",
            competencia: ((i ?? r)?.competence as string) ?? null,
            imovel: ((i ?? r)?.property_name as string) ?? null,
            valor: (p.kind === "reversal" ? -1 : 1) * Number(p.amount),
          };
        })
        .filter((x) => (!f.tipo || x._kind === f.tipo) && (!f.imovel || x._property === f.imovel))
        .map(({ _kind: _k, _property: _p, ...rest }) => rest);
    },
  },
  {
    id: "despesas_lancamentos",
    title: "Relatório de despesas (lançamentos)",
    group: "Financeiro",
    description: "Faturas e aluguéis por competência, com os filtros dos Relatórios de despesas.",
    permission: "finance.reports.view",
    filters: [
      F.de,
      F.ate,
      F.departamento,
      F.imovel,
      { key: "tipo", label: "Tipo de despesa", kind: "select", options: opts(LABEL.kind) },
      {
        key: "status",
        label: "Situação",
        kind: "select",
        options: CHARGE_STATUS.filter((s) => s.value !== "cancelled"),
      },
      { key: "fornecedor", label: "Fornecedor", kind: "supplier" },
    ],
    columns: [
      { key: "competencia", label: "Competência", type: "competence", width: 1 },
      { key: "tipo", label: "Tipo", type: "text", width: 0.8 },
      { key: "fornecedor", label: "Fornecedor", type: "text", width: 1.1 },
      { key: "imovel", label: "Imóvel", type: "text", width: 2.2 },
      { key: "valor", label: "Valor", type: "money", width: 1 },
      { key: "pago", label: "Pago", type: "money", width: 1 },
      { key: "saldo", label: "Saldo", type: "money", width: 1 },
      { key: "vencimento", label: "Vencimento", type: "date", width: 1 },
      { key: "situacao", label: "Situação", type: "text", width: 1.1 },
    ],
    async fetch(c, f, limit) {
      const deps = await subtree(c, f.departamento);
      let q = c
        .from("expense_items")
        .select("*")
        .neq("status", "cancelled")
        .order("competence", { ascending: false })
        .limit(limit);
      if (f.de) q = q.gte("competence", `${f.de}-01`);
      if (f.ate) q = q.lte("competence", `${f.ate}-01`);
      if (f.imovel) q = q.eq("property_id", f.imovel);
      if (deps) q = q.in("department_id", deps);
      if (f.tipo) q = q.eq("kind", f.tipo);
      if (f.status) q = q.eq("status", f.status);
      if (f.fornecedor) q = q.eq("supplier_id", f.fornecedor);
      return (await check<Record<string, unknown>[]>(q)).map((r) => ({
        competencia: r.competence as string,
        tipo: LABEL.kind[r.kind as string] ?? (r.kind as string),
        fornecedor: (r.supplier_name as string) ?? (r.kind === "rent" ? "Locador(es) do contrato" : null),
        imovel: r.property_name as string,
        valor: Number(r.amount),
        pago: Number(r.paid_total),
        saldo: Number(r.balance),
        vencimento: r.due_date as string,
        situacao: LABEL.charge[r.status as string] ?? (r.status as string),
      }));
    },
  },
  {
    id: "demandas",
    title: "Demandas",
    group: "Acompanhamento",
    description: "Demandas que você vê (participa ou acompanha no escopo), por data de criação.",
    permission: null,
    filters: [
      F.de,
      F.ate,
      F.departamento,
      { key: "categoria", label: "Categoria", kind: "category" },
      {
        key: "status",
        label: "Situação",
        kind: "select",
        options: [
          { value: "open", label: "Em aberto" },
          { value: "overdue", label: "Atrasadas" },
          ...opts(LABEL.task),
        ],
      },
    ],
    columns: [
      { key: "titulo", label: "Demanda", type: "text", width: 2.4 },
      { key: "categoria", label: "Categoria", type: "text", width: 1.1 },
      { key: "responsavel", label: "Responsável", type: "text", width: 1.4 },
      { key: "secretaria", label: "Secretaria", type: "text", width: 1.4 },
      { key: "criada", label: "Criada em", type: "datetime", width: 1.1 },
      { key: "prazo", label: "Prazo", type: "date", width: 0.9 },
      { key: "situacao", label: "Situação", type: "text", width: 1.1 },
      { key: "atrasada", label: "Atrasada", type: "bool", width: 0.7 },
      { key: "prioridade", label: "Prioridade", type: "text", width: 0.8 },
      { key: "complexidade", label: "Complexidade", type: "text", width: 0.9 },
      { key: "concluida", label: "Concluída em", type: "datetime", width: 1.1 },
    ],
    async fetch(c, f, limit) {
      const deps = await subtree(c, f.departamento);
      let q = c.from("tasks_overview").select("*").order("created_at", { ascending: false }).limit(limit);
      if (f.de) q = q.gte("created_at", `${f.de}-01T00:00:00-03:00`);
      if (f.ate) q = q.lt("created_at", nextMonthStartTs(f.ate));
      if (deps) q = q.in("department_id", deps);
      if (f.categoria) q = q.eq("category_id", f.categoria);
      if (f.status === "open") q = q.in("status", ["todo", "in_progress", "waiting", "review"]);
      else if (f.status === "overdue") q = q.eq("is_overdue", true);
      else if (f.status) q = q.eq("status", f.status);
      return (await check<Record<string, unknown>[]>(q)).map((t) => ({
        titulo: t.title as string,
        categoria: t.category_name as string,
        responsavel: (t.responsible_name as string) ?? null,
        secretaria: (t.department_name as string) ?? null,
        criada: t.created_at as string,
        prazo: (t.due_date as string) ?? null,
        situacao: LABEL.task[t.status as string] ?? (t.status as string),
        atrasada: Boolean(t.is_overdue),
        prioridade: LABEL.level[t.priority as string] ?? (t.priority as string),
        complexidade: LABEL.complexity[t.complexity as string] ?? (t.complexity as string),
        concluida: (t.completed_at as string) ?? null,
      }));
    },
  },
  {
    id: "produtividade",
    title: "Produtividade",
    group: "Acompanhamento",
    description:
      "Indicadores por pessoa no período (sem pontuação). Sem permissão de equipe, só os próprios.",
    permission: "productivity.view_own",
    notice:
      "Os indicadores apoiam a gestão e não devem ser usados como avaliação automática e definitiva dos servidores.",
    filters: [
      {
        key: "periodo",
        label: "Período",
        kind: "periodType",
        options: [
          { value: "month", label: "Mensal" },
          { value: "quarter", label: "Trimestral" },
          { value: "semester", label: "Semestral" },
          { value: "year", label: "Anual" },
        ],
      },
      {
        key: "referencia",
        label: "Mês de referência",
        kind: "month",
        hint: "O período é o que contém este mês.",
      },
      F.departamento,
    ],
    columns: [
      { key: "pessoa", label: "Pessoa", type: "text", width: 2.2 },
      { key: "recebidas", label: "Recebidas", type: "number", width: 0.8 },
      { key: "concluidas", label: "Concluídas", type: "number", width: 0.8 },
      { key: "no_prazo", label: "No prazo", type: "number", width: 0.8 },
      { key: "pendentes", label: "Pendentes", type: "number", width: 0.8 },
      { key: "atrasadas", label: "Atrasadas", type: "number", width: 0.8 },
      { key: "conclusao", label: "Conclusão", type: "percent", width: 0.9 },
      { key: "prazos", label: "Cumprimento de prazos", type: "percent", width: 1 },
      { key: "tempo", label: "Tempo médio (dias)", type: "number", width: 0.9 },
      { key: "simples", label: "Simples", type: "number", width: 0.7 },
      { key: "media", label: "Média", type: "number", width: 0.7 },
      { key: "complexa", label: "Complexa", type: "number", width: 0.7 },
      { key: "muito_complexa", label: "Muito complexa", type: "number", width: 0.8 },
    ],
    async fetch(c, f) {
      const ref = f.referencia ?? new Date().toISOString().slice(0, 7);
      const { data, error } = await c.rpc("productivity_report", {
        p_period_type: f.periodo ?? "month",
        p_ref: `${ref}-01`,
        p_department_id: f.departamento ?? null,
        p_user_id: null,
      });
      if (error) throw new Error(error.message);
      const people = ((data as { people?: { name: string; metrics: Record<string, unknown> }[] })?.people ??
        []) as {
        name: string;
        metrics: Record<string, unknown>;
      }[];
      return people.map(({ name, metrics: m }) => {
        const pc = (m.por_complexidade ?? {}) as Record<string, number>;
        const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
        return {
          pessoa: name,
          recebidas: n(m.recebidas),
          concluidas: n(m.concluidas),
          no_prazo: n(m.no_prazo),
          pendentes: n(m.pendentes),
          atrasadas: n(m.atrasadas),
          conclusao: n(m.percentual_conclusao),
          prazos: n(m.cumprimento_prazos),
          tempo: n(m.tempo_medio_dias),
          simples: pc.simple ?? 0,
          media: pc.medium ?? 0,
          complexa: pc.complex ?? 0,
          muito_complexa: pc.very_complex ?? 0,
        };
      });
    },
  },
  {
    id: "aprovacoes",
    title: "Aprovações",
    group: "Acompanhamento",
    description: "Solicitações que você fez ou pode decidir, por data de solicitação.",
    permission: null,
    filters: [
      F.de,
      F.ate,
      { key: "status", label: "Situação", kind: "select", options: opts(LABEL.approval) },
    ],
    columns: [
      { key: "operacao", label: "Operação", type: "text", width: 2.2 },
      { key: "solicitante", label: "Solicitante", type: "text", width: 1.4 },
      { key: "solicitada", label: "Solicitada em", type: "datetime", width: 1.1 },
      { key: "situacao", label: "Situação", type: "text", width: 0.9 },
      { key: "decisor", label: "Decidida por", type: "text", width: 1.4 },
      { key: "decidida", label: "Decidida em", type: "datetime", width: 1.1 },
      { key: "justificativa", label: "Justificativa", type: "text", width: 2.4 },
    ],
    async fetch(c, f, limit) {
      let q = c
        .from("approval_requests")
        .select(
          "operation_code, status, requested_at, requested_by, decided_at, decided_by, justification, approval_operations(description)",
        )
        .order("requested_at", { ascending: false })
        .limit(limit);
      if (f.de) q = q.gte("requested_at", `${f.de}-01T00:00:00-03:00`);
      if (f.ate) q = q.lt("requested_at", nextMonthStartTs(f.ate));
      if (f.status) q = q.eq("status", f.status);
      const rows = await check<Record<string, unknown>[]>(q);
      const names = await userNames(c);
      return rows.map((r) => ({
        operacao: ((r.approval_operations as { description?: string } | null)?.description ??
          r.operation_code) as string,
        solicitante: names.get(r.requested_by as string) ?? null,
        solicitada: r.requested_at as string,
        situacao: LABEL.approval[r.status as string] ?? (r.status as string),
        decisor: r.decided_by ? (names.get(r.decided_by as string) ?? null) : null,
        decidida: (r.decided_at as string) ?? null,
        justificativa: r.justification as string,
      }));
    },
  },
];

export const REPORT_BY_ID = new Map(REPORTS.map((r) => [r.id, r]));

// ------------------------------------------------------------ formatação (pt-BR, Maceió)
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const dtFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Maceio",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatCell(type: ColumnType, v: Row[string]): string {
  if (v === null || v === undefined || v === "") return "—";
  switch (type) {
    case "money":
      return money.format(Number(v));
    case "number":
      return num.format(Number(v));
    case "percent":
      return `${num.format(Number(v))}%`;
    case "bool":
      return v ? "Sim" : "Não";
    case "date": {
      const [y, m, d] = String(v).slice(0, 10).split("-");
      return `${d}/${m}/${y}`;
    }
    case "competence": {
      const [y, m] = String(v).split("-");
      return `${m}/${y}`;
    }
    case "datetime":
      return dtFmt.format(new Date(String(v))).replace(",", "");
    default:
      return String(v);
  }
}

/** Descrição legível dos filtros aplicados (cabeçalho do PDF/Excel e auditoria). */
export async function describeFilters(c: Client, def: ReportDef, f: ReportFilters): Promise<string> {
  const parts: string[] = [];
  const names =
    f.departamento || f.imovel || f.categoria || f.fornecedor
      ? await lookupNames(c, f)
      : new Map<string, string>();
  for (const fd of def.filters) {
    const v = f[fd.key];
    if (!v) continue;
    let text = String(v);
    if (fd.kind === "month") text = `${text.slice(5, 7)}/${text.slice(0, 4)}`;
    else if (fd.options) text = fd.options.find((o) => o.value === v)?.label ?? text;
    else text = names.get(String(v)) ?? "selecionado";
    parts.push(`${fd.label}: ${text}`);
  }
  return parts.length ? parts.join(" · ") : "Sem filtros";
}

async function lookupNames(c: Client, f: ReportFilters): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  const tasks: Promise<void>[] = [];
  const add = (table: string, id: string | undefined, col = "name") => {
    if (!id) return;
    tasks.push(
      (async () => {
        const { data } = await c.from(table).select(`id, ${col}`).eq("id", id).maybeSingle();
        if (data) m.set(id, (data as unknown as Record<string, string>)[col] ?? "selecionado");
      })(),
    );
  };
  add("departments", f.departamento);
  add("properties", f.imovel);
  add("task_categories", f.categoria);
  add("suppliers", f.fornecedor);
  await Promise.all(tasks);
  return m;
}
