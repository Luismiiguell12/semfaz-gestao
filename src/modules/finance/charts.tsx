"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";
import { formatCompetence } from "./api";

// Especificação visual (guia de visualização de dados do projeto):
// uma série por gráfico (sem legenda; o título nomeia), barras <= 24px com
// cantos de 4px no topo, grade de 1px recessiva, eixo Y em valores redondos,
// textos em tokens de texto, dica ao passar o mouse e alternativa em tabela.
const BAR = "var(--primary)";
const GRID = "var(--border)";
const TEXT = "var(--muted-foreground)";

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const monthShort = (c: string) => {
  const [y, m] = c.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(m) - 1]}/${y!.slice(2)}`;
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background rounded-md border px-3 py-2 text-xs shadow-sm">
      <p className="text-muted-foreground">{label ? formatCompetence(label) : ""}</p>
      <p className="tabular text-foreground mt-0.5 text-sm font-semibold">
        {formatCurrency(payload[0]!.value)}
      </p>
    </div>
  );
}

export function MonthlySpendChart({
  title,
  data,
  field,
}: {
  title: string;
  data: { competence: string; rent: string; water: string; energy: string }[];
  field: "rent" | "water" | "energy";
}) {
  const rows = data.map((d) => ({ competence: d.competence, value: Number(d[field]) }));
  const total = rows.reduce((acc, r) => acc + Math.round(r.value * 100), 0) / 100;
  const titleId = React.useId();
  return (
    <figure className="bg-surface-raised rounded-lg border p-4" aria-labelledby={titleId}>
      <figcaption id={titleId} className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-foreground text-sm font-semibold">{title}</span>
        <span className="tabular text-muted-foreground text-xs">
          {formatCurrency(total)} em {rows.length} meses
        </span>
      </figcaption>
      {total === 0 ? (
        <p className="text-muted-foreground flex h-44 items-center justify-center text-center text-sm">
          Nenhum lançamento nos últimos {rows.length} meses.
        </p>
      ) : (
        <>
          <div
            className="h-44"
            role="img"
            aria-label={`${title}: gráfico de colunas por mês. Os valores estão na tabela abaixo.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
                <XAxis
                  dataKey="competence"
                  tickFormatter={monthShort}
                  tick={{ fill: TEXT, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: GRID }}
                  interval="preserveStartEnd"
                  minTickGap={8}
                />
                <YAxis
                  tickFormatter={(v: number) => compact.format(v)}
                  tick={{ fill: TEXT, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
                <Bar
                  dataKey="value"
                  fill={BAR}
                  maxBarSize={24}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-2 text-xs">
            <summary className="text-muted-foreground hover:text-foreground cursor-pointer">
              Ver dados em tabela
            </summary>
            <table className="tabular mt-2 w-full">
              <thead>
                <tr className="text-muted-foreground text-left">
                  <th scope="col" className="py-1 font-medium">
                    Competência
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.competence} className="border-t">
                    <td className="py-1">{formatCompetence(r.competence)}</td>
                    <td className="py-1 text-right">{formatCurrency(r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </figure>
  );
}

/** Despesas por imóvel (aluguel + água + energia no período): barras horizontais. */
export function PropertySpendChart({ data }: { data: { name: string; total: string }[] }) {
  const rows = data.map((d) => ({ name: d.name, value: Number(d.total) }));
  const titleId = React.useId();
  return (
    <figure className="bg-surface-raised rounded-lg border p-4" aria-labelledby={titleId}>
      <figcaption id={titleId} className="text-foreground mb-3 text-sm font-semibold">
        Despesas por imóvel (aluguel, água e energia)
      </figcaption>
      {/* Barras em HTML: rótulos legíveis no celular sem depender de eixo. */}
      <ul className="space-y-2.5">
        {rows.map((r) => {
          const max = rows[0]?.value || 1;
          return (
            <li
              key={r.name}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm"
              title={`${r.name}: ${formatCurrency(r.value)}`}
            >
              <span className="text-foreground truncate">{r.name}</span>
              <span className="tabular text-muted-foreground text-right">{formatCurrency(r.value)}</span>
              <span className="bg-muted col-span-2 h-2 rounded-r-[4px]" aria-hidden="true">
                <span
                  className="bg-primary block h-2 rounded-r-[4px]"
                  style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
