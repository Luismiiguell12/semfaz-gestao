"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { EmptyState, ErrorState, InlineAlert, LoadingRows } from "@/components/shared/states";
import { FormField } from "@/components/shared/form-field";
import { RequirePermission } from "@/components/auth/route-guard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import {
  CHARGE_STATUS_LABEL,
  EXPENSE_KIND_LABEL,
  formatCompetence,
  useExpenseReport,
  type ExpenseFilters,
  type ExpenseKind,
  type ExpenseStatus,
} from "@/modules/finance/api";
import { HorizontalBars, MonthlySpendChart } from "@/modules/finance/charts";
import { drillHref, type DrillFilters } from "@/modules/finance/drill";
import { toTree, useDepartments } from "@/modules/departments/api";
import { useProperties } from "@/modules/properties/api";
import { useSuppliers } from "@/modules/consumer-units/api";
import { useLandlords } from "@/modules/landlords/api";
import { useAuth } from "@/providers/auth-provider";
import { ExportButtons } from "@/modules/reports/export-buttons";
import type { ReportFilters } from "@/modules/reports/api";
import { formatCurrency } from "@/lib/format";

const KINDS: ExpenseKind[] = ["rent", "water", "energy"];
const STATUSES: ExpenseStatus[] = ["paid", "pending", "partially_paid", "overdue"];

function monthNow(offset = 0) {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Maceio" }));
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface FormState {
  start: string; // AAAA-MM
  end: string;
  basis: "competence" | "payment";
  kinds: ExpenseKind[];
  statuses: ExpenseStatus[];
  department_id: string;
  property_id: string;
  counterpart_id: string;
}

const INITIAL: FormState = {
  start: monthNow(-11),
  end: monthNow(0),
  basis: "competence",
  kinds: [...KINDS],
  statuses: [],
  department_id: "",
  property_id: "",
  counterpart_id: "",
};

function toFilters(f: FormState): ExpenseFilters {
  return {
    start: `${f.start}-01`,
    end: `${f.end}-01`,
    basis: f.basis,
    kinds: f.kinds,
    statuses: f.statuses,
    department_id: f.department_id || undefined,
    property_id: f.property_id || undefined,
    counterpart_id: f.counterpart_id || undefined,
  };
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="bg-surface-raised rounded-lg border p-4">
      <p className="text-muted-foreground text-sm font-medium">{label}</p>
      <p className="tabular text-brand mt-2 text-2xl leading-none font-bold">{value}</p>
      {detail && <p className="text-muted-foreground mt-2 text-xs">{detail}</p>}
    </div>
  );
}

/** Valor com link para os lançamentos que o compõem. */
function Drill({ value, href }: { value: string | number; href: string }) {
  return Number(value) === 0 ? (
    <span className="tabular text-muted-foreground">{formatCurrency(value)}</span>
  ) : (
    <Link href={href} className="tabular text-primary hover:underline">
      {formatCurrency(value)}
    </Link>
  );
}

function Table({
  caption,
  head,
  children,
  foot,
}: {
  caption: string;
  head: React.ReactNode;
  children: React.ReactNode;
  foot?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-muted-foreground border-b text-left text-xs">{head}</tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
        {foot && <tfoot className="border-t-2 font-semibold">{foot}</tfoot>}
      </table>
    </div>
  );
}
const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th scope="col" className={`px-4 py-2 font-medium ${right ? "text-right" : ""}`}>
    {children}
  </th>
);
const Td = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <td className={`px-4 py-2 ${right ? "text-right" : ""}`}>{children}</td>
);

function ReportContent() {
  const { can } = useAuth();
  const [form, setForm] = React.useState<FormState>(INITIAL);
  const [applied, setApplied] = React.useState<ExpenseFilters>(toFilters(INITIAL));
  const report = useExpenseReport(applied);
  const deps = useDepartments();
  const props = useProperties();
  const suppliers = useSuppliers();
  const landlords = useLandlords();
  const r = report.data;
  const isPayment = applied.basis === "payment";
  const [formError, setFormError] = React.useState<string>();

  // Detalhamento: base competência → lançamentos; base pagamento → pagamentos.
  const base: DrillFilters = {
    from: applied.start.slice(0, 7),
    to: applied.end.slice(0, 7),
    propertyId: applied.property_id,
    departmentId: applied.department_id,
    kinds: applied.kinds.length === KINDS.length ? undefined : applied.kinds,
    statuses: applied.statuses.length ? applied.statuses : undefined,
    supplierId: suppliers.data?.some((s) => s.id === applied.counterpart_id)
      ? applied.counterpart_id
      : undefined,
    landlordId: landlords.data?.some((l) => l.id === applied.counterpart_id)
      ? applied.counterpart_id
      : undefined,
  };
  const target = isPayment ? "/financeiro/pagamentos/" : "/financeiro/relatorios/lancamentos/";
  const link = (extra: Partial<DrillFilters>) => drillHref(target, { ...base, ...extra });

  function apply(e: React.FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    if (!form.start || !form.end) return setFormError("Informe o mês inicial e o final.");
    if (form.end < form.start) return setFormError("O mês final deve ser igual ou posterior ao inicial.");
    if (form.kinds.length === 0) return setFormError("Selecione pelo menos um tipo de despesa.");
    setApplied(toFilters(form));
  }
  const toggle = <T extends string>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const consumptionSeries = (kind: "water" | "energy") => {
    const months = r?.monthly.map((m) => m.period) ?? [];
    return months.map((period) => ({
      competence: period,
      value: (r?.consumption ?? [])
        .filter((c) => c.kind === kind && c.period === period)
        .reduce((acc, c) => acc + Number(c.consumption), 0),
    }));
  };
  const periodLabel = `${formatCompetence(applied.start)} a ${formatCompetence(applied.end)}`;
  // Exportação: relatório "despesas_lancamentos" do catálogo, com os filtros equivalentes.
  const exportBlocked = isPayment
    ? "A exportação usa a base de competência. Para pagamentos, use o relatório Pagamentos em Relatórios."
    : applied.kinds.length === 2
      ? "Para exportar, selecione um tipo de despesa ou todos."
      : applied.statuses.length > 1
        ? "Para exportar, selecione uma situação ou nenhuma."
        : undefined;
  const exportFilters: ReportFilters = {
    de: applied.start.slice(0, 7),
    ate: applied.end.slice(0, 7),
    ...(applied.department_id ? { departamento: applied.department_id } : {}),
    ...(applied.property_id ? { imovel: applied.property_id } : {}),
    ...(applied.kinds.length === 1 ? { tipo: applied.kinds[0] } : {}),
    ...(applied.statuses.length === 1 ? { status: applied.statuses[0] } : {}),
    ...(base.supplierId ? { fornecedor: base.supplierId } : {}),
  };

  return (
    <>
      <PageHeader
        title="Relatórios de despesas"
        description="Aluguel, água e energia no seu escopo. Faturas e aluguéis cancelados ficam fora; estornos são abatidos."
        actions={
          <ExportButtons
            report="despesas_lancamentos"
            filters={exportFilters}
            disabled={!!exportBlocked}
            disabledReason={exportBlocked}
          />
        }
      />
      {can("reports.export") && (
        <p className="text-muted-foreground -mt-3 mb-4 text-xs">
          {exportBlocked ??
            "A exportação traz os lançamentos (por competência) dos filtros aplicados e é registrada na auditoria."}
        </p>
      )}

      <Panel className="mb-6" title="Filtros">
        <form onSubmit={apply} noValidate className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {formError && (
            <InlineAlert tone="danger" className="md:col-span-2 xl:col-span-4">
              {formError}
            </InlineAlert>
          )}
          <div className="grid grid-cols-2 gap-2">
            <FormField id="r-start" label="De">
              <Input
                type="month"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
              />
            </FormField>
            <FormField id="r-end" label="Até">
              <Input
                type="month"
                value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
              />
            </FormField>
          </div>
          <FormField id="r-basis" label="Base de apuração">
            <NativeSelect
              value={form.basis}
              onChange={(e) => setForm({ ...form, basis: e.target.value as FormState["basis"] })}
            >
              <option value="competence">Por competência</option>
              <option value="payment">Por data de pagamento</option>
            </NativeSelect>
          </FormField>
          <FormField id="r-dept" label="Secretaria">
            <NativeSelect
              value={form.department_id}
              onChange={(e) => setForm({ ...form, department_id: e.target.value })}
            >
              <option value="">Todas no meu escopo</option>
              {toTree(deps.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {"  ".repeat(d.depth)}
                  {d.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="r-prop" label="Imóvel">
            <NativeSelect
              value={form.property_id}
              onChange={(e) => setForm({ ...form, property_id: e.target.value })}
            >
              <option value="">Todos</option>
              {props.data
                ?.filter((p) => !p.deleted_at)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </NativeSelect>
          </FormField>
          <FormField id="r-cp" label="Fornecedor ou locador">
            <NativeSelect
              value={form.counterpart_id}
              onChange={(e) => setForm({ ...form, counterpart_id: e.target.value })}
            >
              <option value="">Todos</option>
              <optgroup label="Fornecedores">
                {suppliers.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
              {landlords.data && landlords.data.length > 0 && (
                <optgroup label="Locadores">
                  {landlords.data.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </NativeSelect>
          </FormField>
          <fieldset className="text-sm">
            <legend className="font-medium">Tipo de despesa</legend>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              {KINDS.map((k) => (
                <label key={k} className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={form.kinds.includes(k)}
                    onCheckedChange={() => setForm({ ...form, kinds: toggle(form.kinds, k) })}
                  />
                  {EXPENSE_KIND_LABEL[k]}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="text-sm">
            <legend className="font-medium">Situação</legend>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              {STATUSES.map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={form.statuses.includes(s)}
                    onCheckedChange={() => setForm({ ...form, statuses: toggle(form.statuses, s) })}
                  />
                  {CHARGE_STATUS_LABEL[s]}
                </label>
              ))}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">Nenhuma marcada: todas.</p>
          </fieldset>
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4">
            <Button type="submit" loading={report.isFetching}>
              Aplicar filtros
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setForm(INITIAL);
                setApplied(toFilters(INITIAL));
              }}
            >
              Limpar
            </Button>
          </div>
        </form>
      </Panel>

      {report.isLoading && <LoadingRows />}
      {report.isError && <ErrorState message={report.error.message} onRetry={() => report.refetch()} />}
      {r && r.summary.items === 0 && (
        <Panel>
          <EmptyState
            icon={BarChart3}
            title="Nenhuma despesa com estes filtros"
            description={`Não há ${isPayment ? "pagamentos" : "faturas ou aluguéis"} no período de ${periodLabel} dentro do seu escopo.`}
          />
        </Panel>
      )}
      {r && r.summary.items > 0 && (
        <div className="space-y-6">
          <section aria-label="Resumo">
            <h2 className="sr-only">Resumo do período</h2>
            {isPayment ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                  label="Total pago no período"
                  value={formatCurrency(r.summary.paid)}
                  detail={periodLabel}
                />
                <SummaryCard label="Lançamentos com pagamento" value={String(r.summary.items)} />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                  label="Total de despesas"
                  value={formatCurrency(r.summary.total)}
                  detail={periodLabel}
                />
                <SummaryCard label="Total pago" value={formatCurrency(r.summary.paid)} />
                <SummaryCard label="Pendente (a vencer)" value={formatCurrency(r.summary.pending)} />
                <SummaryCard label="Vencido" value={formatCurrency(r.summary.overdue)} />
              </div>
            )}
            {isPayment && (
              <p className="text-muted-foreground mt-2 text-xs">
                Na base por data de pagamento, os valores são os pagamentos aprovados no período (estornos
                abatidos). Saldos pendentes e vencidos aparecem na base por competência.
              </p>
            )}
          </section>

          <section aria-labelledby="h-evolucao">
            <h2 id="h-evolucao" className="text-brand mb-3 text-base font-semibold">
              Evolução mensal das despesas
            </h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {applied.kinds.map((k) => (
                <MonthlySpendChart
                  key={k}
                  title={EXPENSE_KIND_LABEL[k]}
                  data={r.monthly.map((m) => ({ competence: m.period, value: m[k] }))}
                  field="value"
                  emptyText="Nenhum valor no período."
                  hrefFor={(c) => link({ from: c.slice(0, 7), to: c.slice(0, 7), kinds: [k] })}
                />
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <HorizontalBars
              title="Despesas por imóvel (maiores valores)"
              limit={10}
              rows={r.by_property.map((p) => ({
                key: p.id,
                name: p.name ?? "Acesso restrito",
                value: Number(p.total),
                href: link({ propertyId: p.id }),
              }))}
            />
            <HorizontalBars
              title="Despesas por secretaria"
              rows={r.by_department.map((d) => ({
                key: d.id,
                name: d.name ?? "Acesso restrito",
                value: Number(d.total),
                href: link({ departmentId: d.id }),
              }))}
            />
            {!isPayment && (
              <HorizontalBars
                title="Pago × pendente × vencido"
                rows={[
                  {
                    key: "paid",
                    name: "Pago",
                    value: Number(r.summary.paid),
                    barClassName: "bg-success",
                    href: link({ statuses: ["paid", "partially_paid"] }),
                  },
                  {
                    key: "pending",
                    name: "Pendente (a vencer)",
                    value: Number(r.summary.pending),
                    barClassName: "bg-warning",
                    href: link({ statuses: ["pending", "partially_paid"] }),
                  },
                  {
                    key: "overdue",
                    name: "Vencido",
                    value: Number(r.summary.overdue),
                    barClassName: "bg-danger",
                    href: link({ statuses: ["overdue"] }),
                  },
                ]}
              />
            )}
          </div>

          {(applied.kinds.includes("energy") || applied.kinds.includes("water")) && (
            <section aria-labelledby="h-consumo">
              <h2 id="h-consumo" className="text-brand mb-3 text-base font-semibold">
                Evolução do consumo (por competência)
              </h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {applied.kinds.includes("energy") && (
                  <MonthlySpendChart
                    title="Energia"
                    unit="kWh"
                    data={consumptionSeries("energy")}
                    field="value"
                    emptyText="Nenhuma fatura de energia no período."
                  />
                )}
                {applied.kinds.includes("water") && (
                  <MonthlySpendChart
                    title="Água"
                    unit="m³"
                    data={consumptionSeries("water")}
                    field="value"
                    emptyText="Nenhuma fatura de água no período."
                  />
                )}
              </div>
            </section>
          )}

          <Panel title="Por tipo de despesa" bodyClassName="p-0">
            <Table
              caption="Despesas por tipo"
              head={
                <>
                  <Th>Tipo</Th>
                  <Th right>Total</Th>
                  {!isPayment && (
                    <>
                      <Th right>Pago</Th>
                      <Th right>Pendente</Th>
                      <Th right>Vencido</Th>
                    </>
                  )}
                </>
              }
              foot={
                <tr>
                  <Td>Total</Td>
                  <Td right>{formatCurrency(r.summary.total)}</Td>
                  {!isPayment && (
                    <>
                      <Td right>{formatCurrency(r.summary.paid)}</Td>
                      <Td right>{formatCurrency(r.summary.pending)}</Td>
                      <Td right>{formatCurrency(r.summary.overdue)}</Td>
                    </>
                  )}
                </tr>
              }
            >
              {r.by_kind.map((k) => (
                <tr key={k.kind}>
                  <Td>{EXPENSE_KIND_LABEL[k.kind]}</Td>
                  <Td right>
                    <Drill value={k.total} href={link({ kinds: [k.kind] })} />
                  </Td>
                  {!isPayment && (
                    <>
                      <Td right>{formatCurrency(k.paid)}</Td>
                      <Td right>
                        <Drill
                          value={k.pending}
                          href={link({ kinds: [k.kind], statuses: ["pending", "partially_paid"] })}
                        />
                      </Td>
                      <Td right>
                        <Drill value={k.overdue} href={link({ kinds: [k.kind], statuses: ["overdue"] })} />
                      </Td>
                    </>
                  )}
                </tr>
              ))}
            </Table>
          </Panel>

          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
            <Panel title="Por imóvel" bodyClassName="p-0">
              <Table
                caption="Despesas por imóvel"
                head={
                  <>
                    <Th>Imóvel</Th>
                    <Th right>Total</Th>
                    {!isPayment && <Th right>Vencido</Th>}
                  </>
                }
              >
                {r.by_property.map((p) => (
                  <tr key={p.id}>
                    <Td>
                      {p.name ? (
                        <Link
                          href={`/imoveis/detalhe/?id=${p.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {p.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Acesso restrito</span>
                      )}
                    </Td>
                    <Td right>
                      <Drill value={p.total} href={link({ propertyId: p.id })} />
                    </Td>
                    {!isPayment && (
                      <Td right>
                        <Drill value={p.overdue} href={link({ propertyId: p.id, statuses: ["overdue"] })} />
                      </Td>
                    )}
                  </tr>
                ))}
              </Table>
            </Panel>
            <Panel title="Por secretaria" bodyClassName="p-0">
              <Table
                caption="Despesas por secretaria"
                head={
                  <>
                    <Th>Secretaria</Th>
                    <Th right>Total</Th>
                    {!isPayment && <Th right>Vencido</Th>}
                  </>
                }
              >
                {r.by_department.map((d) => (
                  <tr key={d.id}>
                    <Td>{d.name ?? <span className="text-muted-foreground">Acesso restrito</span>}</Td>
                    <Td right>
                      <Drill value={d.total} href={link({ departmentId: d.id })} />
                    </Td>
                    {!isPayment && (
                      <Td right>
                        <Drill value={d.overdue} href={link({ departmentId: d.id, statuses: ["overdue"] })} />
                      </Td>
                    )}
                  </tr>
                ))}
              </Table>
            </Panel>
          </div>

          <Panel
            title="Por fornecedor ou locador"
            description="Aluguéis com mais de um locador são distribuídos pelo percentual de participação."
            bodyClassName="p-0"
          >
            <Table
              caption="Despesas por fornecedor ou locador"
              head={
                <>
                  <Th>Nome</Th>
                  <Th>Tipo</Th>
                  <Th right>Total</Th>
                </>
              }
            >
              {r.by_counterpart.map((c) => (
                <tr key={`${c.type}-${c.id}`}>
                  <Td>{c.name ?? <span className="text-muted-foreground">Acesso restrito</span>}</Td>
                  <Td>{c.type === "supplier" ? "Fornecedor" : "Locador"}</Td>
                  <Td right>
                    {c.id ? (
                      <Drill
                        value={c.total}
                        href={link(
                          c.type === "supplier"
                            ? { supplierId: c.id, landlordId: undefined }
                            : { landlordId: c.id, supplierId: undefined },
                        )}
                      />
                    ) : (
                      formatCurrency(c.total)
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          </Panel>

          <Panel title="Mensal (competência × tipo de despesa)" bodyClassName="p-0">
            <Table
              caption="Despesas por mês e tipo"
              head={
                <>
                  <Th>{isPayment ? "Mês do pagamento" : "Competência"}</Th>
                  {applied.kinds.map((k) => (
                    <Th key={k} right>
                      {EXPENSE_KIND_LABEL[k]}
                    </Th>
                  ))}
                  <Th right>Total</Th>
                </>
              }
            >
              {r.monthly.map((m) => {
                const month = m.period.slice(0, 7);
                return (
                  <tr key={m.period}>
                    <Td>{formatCompetence(m.period)}</Td>
                    {applied.kinds.map((k) => (
                      <Td key={k} right>
                        <Drill value={m[k]} href={link({ from: month, to: month, kinds: [k] })} />
                      </Td>
                    ))}
                    <Td right>
                      <Drill value={m.total} href={link({ from: month, to: month })} />
                    </Td>
                  </tr>
                );
              })}
            </Table>
          </Panel>

          <Panel
            title="Comparativo com o mesmo período do ano anterior"
            description={`${periodLabel} × ${formatCompetence(r.comparison.previous_start)} a ${formatCompetence(r.comparison.previous_end)}`}
            bodyClassName="p-0"
          >
            {r.comparison.available ? (
              <Table
                caption="Comparativo com o ano anterior"
                head={
                  <>
                    <Th>Tipo</Th>
                    <Th right>Período atual</Th>
                    <Th right>Ano anterior</Th>
                    <Th right>Variação (R$)</Th>
                    <Th right>Variação (%)</Th>
                  </>
                }
                foot={
                  <tr>
                    <Td>Total</Td>
                    <Td right>{formatCurrency(r.comparison.total_current)}</Td>
                    <Td right>{formatCurrency(r.comparison.total_previous)}</Td>
                    <Td right>
                      {formatCurrency(
                        Number(r.comparison.total_current) - Number(r.comparison.total_previous),
                      )}
                    </Td>
                    <Td right>
                      {Number(r.comparison.total_previous) === 0
                        ? "—"
                        : `${((Number(r.comparison.total_current) / Number(r.comparison.total_previous) - 1) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`}
                    </Td>
                  </tr>
                }
              >
                {r.comparison.by_kind.map((c) => (
                  <tr key={c.kind}>
                    <Td>{EXPENSE_KIND_LABEL[c.kind]}</Td>
                    <Td right>{formatCurrency(c.current)}</Td>
                    <Td right>{formatCurrency(c.previous)}</Td>
                    <Td right>{formatCurrency(c.diff)}</Td>
                    <Td right>
                      {c.percent === null
                        ? "—"
                        : `${Number(c.percent).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`}
                    </Td>
                  </tr>
                ))}
              </Table>
            ) : (
              <p className="text-muted-foreground px-4 py-6 text-sm">
                Não há despesas registradas no mesmo período do ano anterior para comparar.
              </p>
            )}
          </Panel>

          {r.consumption.length > 0 && (
            <Panel
              title="Consumo por imóvel e mês"
              description="Faturas de água e energia por competência, ao lado dos valores."
              bodyClassName="p-0"
            >
              <Table
                caption="Consumo por imóvel e mês"
                head={
                  <>
                    <Th>Imóvel</Th>
                    <Th>Competência</Th>
                    <Th>Tipo</Th>
                    <Th right>Consumo</Th>
                    <Th right>Valor</Th>
                  </>
                }
              >
                {r.consumption.map((c) => (
                  <tr key={`${c.property_id}-${c.period}-${c.kind}-${c.measure_unit}`}>
                    <Td>
                      <Link
                        href={`/imoveis/detalhe/?id=${c.property_id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {c.property_name}
                      </Link>
                    </Td>
                    <Td>{formatCompetence(c.period)}</Td>
                    <Td>{EXPENSE_KIND_LABEL[c.kind]}</Td>
                    <Td right>
                      <span className="tabular">
                        {Number(c.consumption).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}{" "}
                        {c.measure_unit}
                      </span>
                    </Td>
                    <Td right>
                      <Drill
                        value={c.amount}
                        href={drillHref("/financeiro/relatorios/lancamentos/", {
                          from: c.period.slice(0, 7),
                          to: c.period.slice(0, 7),
                          propertyId: c.property_id,
                          kinds: [c.kind],
                        })}
                      />
                    </Td>
                  </tr>
                ))}
              </Table>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}

export default function ExpenseReportsPage() {
  return (
    <RequirePermission permission="finance.reports.view">
      <ReportContent />
    </RequirePermission>
  );
}
