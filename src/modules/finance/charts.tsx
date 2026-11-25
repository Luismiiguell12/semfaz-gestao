"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";
import { formatCompetence } from "./api";

// Especificação visual (guia de visualização de dados do projeto):
// uma série por gráfico (sem legenda; o título nomeia), barras <= 24px com
// cantos de 4px no topo, grade de 1px recessiva, eixo Y em valores redondos,
// textos em tokens de texto, dica ao passar o mouse e alternativa em tabela.
// Nunca dois eixos Y: medidas diferentes (R$, kWh, m³) ficam em gráficos separados.
const BAR = "var(--primary)";
const GRID = "var(--border)";
const TEXT = "var(--muted-foreground)";

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const monthShort = (c: string) => {
  const [y, m] = c.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(m) - 1]}/${y!.slice(2)}`;
};

/** Formata um valor da série: moeda (padrão) ou quantidade com unidade (kWh, m³). */
function makeFormat(unit?: string) {
  return (v: number) => (unit ? `${integer.format(v)} ${unit}` : formatCurrency(v));
}

function ChartTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  format: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background rounded-md border px-3 py-2 text-xs shadow-sm">
      <p className="text-muted-foreground">{label ? formatCompetence(label) : ""}</p>
      <p className="tabular text-foreground mt-0.5 text-sm font-semibold">{format(payload[0]!.value)}</p>
    </div>
  );
}

/**
 * Colunas mensais de uma única série. Com `hrefFor`, cada coluna abre a lista
 * de lançamentos que compõem o valor (e a tabela acessível ganha links).
 */
export function MonthlySpendChart<F extends string>({
  title,
  data,
  field,
  unit,
  hrefFor,
  emptyText,
}: {
  title: string;
  data: ({ competence: string } & Record<F, string | number>)[];
  field: F;
  /** Unidade de quantidade (kWh, m³). Sem unidade, valores em R$. */
  unit?: string;
  hrefFor?: (competence: string) => string;
  emptyText?: string;
}) {
  const router = useRouter();
  const format = makeFormat(unit);
  const rows = data.map((d) => ({ competence: d.competence, value: Number(d[field]) }));
  const total = unit
    ? rows.reduce((acc, r) => acc + r.value, 0)
    : rows.reduce((acc, r) => acc + Math.round(r.value * 100), 0) / 100;
  const titleId = React.useId();
  return (
    <figure className="bg-surface-raised rounded-lg border p-4" aria-labelledby={titleId}>
      <figcaption id={titleId} className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-foreground text-sm font-semibold">{title}</span>
        <span className="tabular text-muted-foreground text-right text-xs">
          {format(total)} em {rows.length} {rows.length === 1 ? "mês" : "meses"}
        </span>
      </figcaption>
      {total === 0 ? (
        <p className="text-muted-foreground flex h-44 items-center justify-center text-center text-sm">
          {emptyText ?? `Nenhum lançamento nos últimos ${rows.length} meses.`}
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
                <Tooltip content={<ChartTooltip format={format} />} cursor={{ fill: "var(--muted)" }} />
                <Bar
                  dataKey="value"
                  fill={BAR}
                  maxBarSize={24}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                  className={hrefFor ? "cursor-pointer" : undefined}
                  onClick={
                    hrefFor
                      ? (d: { payload?: { competence?: string } }) => {
                          const c = d.payload?.competence;
                          if (c) router.push(hrefFor(c));
                        }
                      : undefined
                  }
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
                    {unit ? "Quantidade" : "Valor"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.competence} className="border-t">
                    <td className="py-1">{formatCompetence(r.competence)}</td>
                    <td className="py-1 text-right">
                      {hrefFor && r.value !== 0 ? (
                        <Link href={hrefFor(r.competence)} className="text-primary hover:underline">
                          {format(r.value)}
                        </Link>
                      ) : (
                        format(r.value)
                      )}
                    </td>
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

export interface BarRow {
  key: string;
  name: string;
  value: number;
  href?: string;
  /** Classe de cor da barra (padrão: cor primária). Cores de situação só com rótulo. */
  barClassName?: string;
}

/** Barras horizontais em HTML: rótulos legíveis no celular sem depender de eixo. */
export function HorizontalBars({
  title,
  rows,
  emptyText = "Nenhum valor no período.",
  limit,
}: {
  title: string;
  rows: BarRow[];
  emptyText?: string;
  limit?: number;
}) {
  const titleId = React.useId();
  const shown = limit ? rows.slice(0, limit) : rows;
  const max = Math.max(...shown.map((r) => Math.abs(r.value)), 0) || 1;
  return (
    <figure className="bg-surface-raised rounded-lg border p-4" aria-labelledby={titleId}>
      <figcaption id={titleId} className="text-foreground mb-3 text-sm font-semibold">
        {title}
      </figcaption>
      {shown.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">{emptyText}</p>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((r) => (
            <li
              key={r.key}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm"
              title={`${r.name}: ${formatCurrency(r.value)}`}
            >
              {r.href ? (
                <Link href={r.href} className="text-foreground hover:text-primary truncate hover:underline">
                  {r.name}
                </Link>
              ) : (
                <span className="text-foreground truncate">{r.name}</span>
              )}
              <span className="tabular text-muted-foreground text-right">{formatCurrency(r.value)}</span>
              <span className="bg-muted col-span-2 h-2 rounded-r-[4px]" aria-hidden="true">
                <span
                  className={`block h-2 rounded-r-[4px] ${r.barClassName ?? "bg-primary"}`}
                  style={{ width: `${r.value > 0 ? Math.max(2, (r.value / max) * 100) : 0}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
      {limit && rows.length > limit && (
        <p className="text-muted-foreground mt-3 text-xs">
          Exibindo os {limit} maiores de {rows.length}. A tabela completa está abaixo.
        </p>
      )}
    </figure>
  );
}

/** Despesas por imóvel no Painel (mesma base dos relatórios). */
export function PropertySpendChart({ data }: { data: { id?: string; name: string; total: string }[] }) {
  return (
    <HorizontalBars
      title="Despesas por imóvel (aluguel, água e energia)"
      rows={data.map((d) => ({
        key: d.id ?? d.name,
        name: d.name,
        value: Number(d.total),
        href: d.id ? `/imoveis/detalhe/?id=${d.id}` : undefined,
      }))}
    />
  );
}
