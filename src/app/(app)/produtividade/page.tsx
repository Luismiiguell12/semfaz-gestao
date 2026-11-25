"use client";

import * as React from "react";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { EmptyState, ErrorState, InlineAlert, LoadingRows } from "@/components/shared/states";
import { FormField } from "@/components/shared/form-field";
import { DepartmentSelect } from "@/components/shared/pickers";
import { RequirePermission } from "@/components/auth/route-guard";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { HorizontalBars, MonthlySpendChart } from "@/modules/finance/charts";
import { COMPLEXITY_LABEL } from "@/modules/tasks/api";
import {
  COMPLEXITY_ORDER,
  PERIOD_LABEL,
  periodLabel,
  useProductivityReport,
  useProductivitySeries,
  type Metrics,
  type PeriodType,
} from "@/modules/productivity/api";
import { formatInteger } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";

const pct = (v: number | null) =>
  v === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const days = (v: number | null) =>
  v === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${v === 1 ? "dia" : "dias"}`;
const thisMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Maceio" }).slice(0, 7);

function Card({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="bg-surface-raised rounded-lg border p-4">
      <p className="text-muted-foreground text-sm font-medium">{label}</p>
      <p className="tabular text-brand mt-2 text-2xl leading-none font-bold">{value}</p>
      {detail && <p className="text-muted-foreground mt-2 text-xs">{detail}</p>}
    </div>
  );
}

function MetricCards({ m }: { m: Metrics }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card label="Recebidas" value={formatInteger(m.recebidas)} detail="Atribuídas no período" />
      <Card
        label="Concluídas"
        value={formatInteger(m.concluidas)}
        detail={`${m.no_prazo} no prazo de ${m.com_prazo} com prazo`}
      />
      <Card label="Pendentes" value={formatInteger(m.pendentes)} detail="Abertas ao fim do período" />
      <Card label="Atrasadas" value={formatInteger(m.atrasadas)} detail="Pendentes com prazo vencido" />
      <Card
        label="Percentual de conclusão"
        value={pct(m.percentual_conclusao)}
        detail="Concluídas ÷ (concluídas + pendentes)"
      />
      <Card
        label="Cumprimento de prazos"
        value={pct(m.cumprimento_prazos)}
        detail="Concluídas no prazo ÷ concluídas com prazo"
      />
      <Card
        label="Tempo médio de execução"
        value={days(m.tempo_medio_dias)}
        detail="Da criação à conclusão"
      />
      <Card
        label="Participação"
        value={formatInteger(m.como_responsavel + m.como_participante)}
        detail={`${m.como_responsavel} como responsável, ${m.como_participante} como participante`}
      />
    </div>
  );
}

function ComplexityBars({ m, title }: { m: Metrics; title: string }) {
  return (
    <HorizontalBars
      title={title}
      format={(v) => formatInteger(v)}
      emptyText="Nenhuma demanda concluída no período."
      rows={COMPLEXITY_ORDER.map((c) => ({
        key: c,
        name: COMPLEXITY_LABEL[c],
        value: m.por_complexidade[c] ?? 0,
      })).filter((r, _i, all) => all.some((x) => x.value > 0))}
    />
  );
}

function ProductivityContent() {
  const { can } = useAuth();
  const [type, setType] = React.useState<PeriodType>("month");
  const [ref, setRef] = React.useState(thisMonth());
  const [dept, setDept] = React.useState("");
  const [person, setPerson] = React.useState("");
  const report = useProductivityReport({ type, ref: `${ref}-01`, departmentId: dept || undefined });
  const r = report.data;
  const me = r?.people.find((p) => p.is_me);
  const selected = r?.people.find((p) => p.user_id === person) ?? me;
  const series = useProductivitySeries(type, 6, selected?.user_id);

  return (
    <>
      <PageHeader
        title="Produtividade"
        description="Métricas de quantidade e prazo das demandas, por período. Não há pontuação nesta versão."
      />
      <InlineAlert tone="warning" className="mb-6" title="Uso dos indicadores">
        Os indicadores apoiam a gestão e não devem ser usados como avaliação automática e definitiva dos
        servidores. Dados individuais são pessoais: cada pessoa vê os próprios; a equipe é vista apenas por
        perfis autorizados.
      </InlineAlert>

      <Panel className="mb-6" title="Período">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <FormField id="pr-type" label="Tipo de período">
            <NativeSelect value={type} onChange={(e) => setType(e.target.value as PeriodType)}>
              {(Object.keys(PERIOD_LABEL) as PeriodType[]).map((t) => (
                <option key={t} value={t}>
                  {PERIOD_LABEL[t]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="pr-ref" label="Mês de referência" hint="O período é o que contém este mês.">
            <Input type="month" value={ref} onChange={(e) => e.target.value && setRef(e.target.value)} />
          </FormField>
          {r?.can_view_team && (
            <>
              <FormField id="pr-dept" label="Secretaria (equipe)">
                <DepartmentSelect
                  emptyLabel="Toda a equipe visível"
                  value={dept}
                  onChange={(e) => setDept(e.target.value)}
                />
              </FormField>
              <FormField id="pr-person" label="Pessoa">
                <NativeSelect value={person} onChange={(e) => setPerson(e.target.value)}>
                  <option value="">Eu</option>
                  {r.people
                    .filter((p) => !p.is_me)
                    .map((p) => (
                      <option key={p.user_id} value={p.user_id}>
                        {p.name}
                      </option>
                    ))}
                </NativeSelect>
              </FormField>
            </>
          )}
        </div>
        {r && (
          <p className="text-muted-foreground mt-3 text-sm">
            {periodLabel(r.period.type, r.period.start)}{" "}
            {r.period.closed ? (
              <Badge tone="neutral">Período fechado</Badge>
            ) : (
              <Badge tone="info">Em andamento</Badge>
            )}
          </p>
        )}
      </Panel>

      {report.isLoading && <LoadingRows />}
      {report.isError && <ErrorState message={report.error.message} onRetry={() => report.refetch()} />}
      {r && (
        <div className="space-y-8">
          <section aria-labelledby="h-ind">
            <h2 id="h-ind" className="text-brand mb-3 text-base font-semibold">
              {selected && !selected.is_me ? `Indicadores de ${selected.name}` : "Meus indicadores"}
            </h2>
            {selected ? (
              <>
                <MetricCards m={selected.metrics} />
                <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                  {series.data ? (
                    <MonthlySpendChart
                      title={`Concluídas nos últimos 6 períodos (${PERIOD_LABEL[type].toLowerCase()})`}
                      unit="demandas"
                      data={series.data.map((s) => ({ competence: s.start, value: s.metrics.concluidas }))}
                      field="value"
                      emptyText="Nenhuma demanda concluída nos últimos períodos."
                    />
                  ) : (
                    <LoadingRows rows={2} />
                  )}
                  <ComplexityBars m={selected.metrics} title="Concluídas por complexidade" />
                </div>
              </>
            ) : (
              <EmptyState
                title="Sem indicadores próprios"
                description="Você ainda não tem demandas atribuídas."
              />
            )}
          </section>

          {r.can_view_team && (
            <section aria-labelledby="h-team">
              <h2 id="h-team" className="text-brand mb-3 text-base font-semibold">
                Indicadores coletivos da equipe
              </h2>
              <MetricCards m={r.totals} />
              <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                <HorizontalBars
                  title="Produtividade por colaborador: concluídas (ordem alfabética)"
                  format={(v) => formatInteger(v)}
                  emptyText="Ninguém com demandas no período."
                  rows={r.people.map((p) => ({ key: p.user_id, name: p.name, value: p.metrics.concluidas }))}
                />
                <ComplexityBars m={r.totals} title="Equipe: concluídas por complexidade" />
              </div>
              <Panel
                className="mt-4"
                title="Por pessoa"
                description="Ordem alfabética. Sem ranking nem pontuação."
                bodyClassName="p-0"
              >
                <div className="relative overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <caption className="sr-only">Indicadores por pessoa</caption>
                    <thead>
                      <tr className="text-muted-foreground border-b text-left text-xs">
                        {[
                          "Pessoa",
                          "Recebidas",
                          "Concluídas",
                          "Pendentes",
                          "Atrasadas",
                          "Conclusão",
                          "Prazos",
                          "Tempo médio",
                        ].map((h, i) => (
                          <th
                            key={h}
                            scope="col"
                            className={`px-4 py-2 font-medium ${i ? "text-right" : ""}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {r.people.map((p) => (
                        <tr key={p.user_id}>
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              className="text-primary text-left hover:underline"
                              onClick={() => setPerson(p.is_me ? "" : p.user_id)}
                            >
                              {p.name}
                              {p.is_me ? " (você)" : ""}
                            </button>
                          </td>
                          <td className="tabular px-4 py-2 text-right">{p.metrics.recebidas}</td>
                          <td className="tabular px-4 py-2 text-right">{p.metrics.concluidas}</td>
                          <td className="tabular px-4 py-2 text-right">{p.metrics.pendentes}</td>
                          <td className="tabular px-4 py-2 text-right">{p.metrics.atrasadas}</td>
                          <td className="tabular px-4 py-2 text-right">
                            {pct(p.metrics.percentual_conclusao)}
                          </td>
                          <td className="tabular px-4 py-2 text-right">
                            {pct(p.metrics.cumprimento_prazos)}
                          </td>
                          <td className="tabular px-4 py-2 text-right">{days(p.metrics.tempo_medio_dias)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
              <p className="text-muted-foreground mt-2 text-xs">
                No coletivo, uma demanda com várias pessoas conta uma vez para cada participante.
                {can("reports.export")
                  ? " A exportação para Excel e PDF será liberada na fase de Relatórios."
                  : ""}
              </p>
            </section>
          )}
        </div>
      )}
    </>
  );
}

export default function ProductivityPage() {
  return (
    <RequirePermission permission="productivity.view_own">
      <ProductivityContent />
    </RequirePermission>
  );
}
