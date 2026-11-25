"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FileBarChart, Info } from "lucide-react";
import { PageHeader, Panel } from "@/components/shared/page-header";
import {
  EmptyState,
  ErrorState,
  FullPageLoading,
  InlineAlert,
  LoadingRows,
} from "@/components/shared/states";
import { FormField } from "@/components/shared/form-field";
import { DepartmentSelect } from "@/components/shared/pickers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { useProperties } from "@/modules/properties/api";
import { useSuppliers } from "@/modules/consumer-units/api";
import { useTaskCategories } from "@/modules/tasks/api";
import {
  cleanFilters,
  formatCell,
  PREVIEW_ROWS,
  REPORT_BY_ID,
  REPORTS,
  useReportPreview,
  type FilterDef,
  type ReportDef,
  type ReportFilters,
} from "@/modules/reports/api";
import { ExportButtons } from "@/modules/reports/export-buttons";
import { formatInteger } from "@/lib/format";
import { toAppError } from "@/lib/errors";
import { useAuth } from "@/providers/auth-provider";
import { ScrollRegion } from "@/components/shared/scroll-region";

const GROUPS: ReportDef["group"][] = ["Gestão", "Financeiro", "Acompanhamento"];
const RIGHT = new Set(["money", "number", "percent"]);

function Catalog({ reports }: { reports: ReportDef[] }) {
  const { can } = useAuth();
  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Consulte com filtros e, se tiver permissão, exporte para Excel ou PDF. Toda exportação é registrada na auditoria."
      />
      {!can("reports.export") && (
        <InlineAlert tone="info" className="mb-6">
          Você pode consultar os relatórios abaixo. A exportação para Excel e PDF depende da permissão
          “Exportar relatórios”.
        </InlineAlert>
      )}
      <div className="space-y-6">
        {GROUPS.map((g) => {
          const list = reports.filter((r) => r.group === g);
          if (!list.length) return null;
          return (
            <Panel key={g} title={g}>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {list.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/relatorios/?r=${r.id}`}
                      className="hover:border-primary/50 hover:bg-primary-soft/40 focus-visible:ring-ring flex h-full flex-col rounded-md border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <span className="text-foreground font-semibold">{r.title}</span>
                      <span className="text-muted-foreground mt-1 text-sm">{r.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          );
        })}
      </div>
    </>
  );
}

type FormValues = Record<string, string>;

function FilterControl({
  fd,
  value,
  onChange,
}: {
  fd: FilterDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const props = useProperties();
  const suppliers = useSuppliers();
  const categories = useTaskCategories();
  const id = `rf-${fd.key}`;
  const common = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange(e.target.value),
  };
  let control: React.ReactElement<Record<string, unknown>>;
  switch (fd.kind) {
    case "month":
      control = <Input type="month" {...common} />;
      break;
    case "department":
      control = <DepartmentSelect emptyLabel="Todas no meu escopo" {...common} />;
      break;
    case "property":
      control = (
        <NativeSelect {...common}>
          <option value="">Todos</option>
          {(props.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      );
      break;
    case "supplier":
      control = (
        <NativeSelect {...common}>
          <option value="">Todos</option>
          {(suppliers.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
      );
      break;
    case "category":
      control = (
        <NativeSelect {...common}>
          <option value="">Todas</option>
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      );
      break;
    default:
      control = (
        <NativeSelect {...common}>
          {fd.kind !== "periodType" && <option value="">Todos</option>}
          {(fd.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      );
  }
  return (
    <FormField id={id} label={fd.label} hint={fd.hint}>
      {control}
    </FormField>
  );
}

function initialValues(def: ReportDef): FormValues {
  const v: FormValues = {};
  for (const fd of def.filters) if (fd.kind === "periodType") v[fd.key] = fd.options?.[0]?.value ?? "";
  return v;
}

function ReportView({ def }: { def: ReportDef }) {
  const [form, setForm] = React.useState<FormValues>(() => initialValues(def));
  const [applied, setApplied] = React.useState<ReportFilters>(() => cleanFilters(initialValues(def)));
  const [error, setError] = React.useState<string>();
  const preview = useReportPreview(def, applied);
  const rows = preview.data ?? [];
  const more = rows.length > PREVIEW_ROWS;
  const shown = rows.slice(0, PREVIEW_ROWS);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (form.de && form.ate && form.ate < form.de)
      return setError("O mês final deve ser igual ou posterior ao inicial.");
    try {
      setApplied(cleanFilters(form));
    } catch {
      setError("Revise os filtros informados.");
    }
  }

  return (
    <>
      <Link
        href="/relatorios/"
        className="text-primary mb-3 inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Todos os relatórios
      </Link>
      <PageHeader
        title={def.title}
        description={def.description}
        actions={<ExportButtons report={def.id} filters={applied} disabled={preview.isLoading} />}
      />
      {def.notice && (
        <InlineAlert tone="warning" className="mb-4">
          {def.notice}
        </InlineAlert>
      )}
      {def.filters.length > 0 && (
        <Panel className="mb-6" title="Filtros">
          <form onSubmit={apply} noValidate className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {error && (
              <InlineAlert tone="danger" className="md:col-span-2 xl:col-span-4">
                {error}
              </InlineAlert>
            )}
            {def.filters.map((fd) => (
              <FilterControl
                key={fd.key}
                fd={fd}
                value={form[fd.key] ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, [fd.key]: v }))}
              />
            ))}
            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4">
              <Button type="submit">Aplicar filtros</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setForm(initialValues(def));
                  setApplied(cleanFilters(initialValues(def)));
                }}
              >
                Limpar
              </Button>
            </div>
          </form>
        </Panel>
      )}
      <Panel
        title="Prévia"
        description={
          preview.isSuccess
            ? more
              ? `Mostrando as primeiras ${PREVIEW_ROWS} linhas. O arquivo exportado traz todas (até 5.000).`
              : `${formatInteger(rows.length)} ${rows.length === 1 ? "linha" : "linhas"}`
            : undefined
        }
        bodyClassName="p-0"
      >
        {preview.isLoading ? (
          <div className="p-5">
            <LoadingRows />
          </div>
        ) : preview.isError ? (
          <ErrorState message={toAppError(preview.error).message} onRetry={() => preview.refetch()} />
        ) : shown.length === 0 ? (
          <EmptyState
            title="Nenhum registro"
            description="Não há dados no seu escopo com os filtros informados."
          />
        ) : (
          <ScrollRegion label={def.title}>
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">{def.title}</caption>
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  {def.columns.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      className={`px-4 py-2 font-medium ${RIGHT.has(c.type) ? "text-right" : ""}`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((r, i) => (
                  <tr key={i}>
                    {def.columns.map((c) => (
                      <td
                        key={c.key}
                        className={`px-4 py-2 ${RIGHT.has(c.type) ? "tabular text-right" : ""}`}
                      >
                        {formatCell(c.type, r[c.key] ?? null)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        )}
      </Panel>
      <p className="text-muted-foreground mt-2 flex items-start gap-1.5 text-xs">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        Os dados respeitam o seu escopo de acesso. A exportação é gerada no servidor com as suas permissões e
        registrada na auditoria (relatório, filtros, formato e quantidade de linhas).
      </p>
    </>
  );
}

function ReportsContent() {
  const { can } = useAuth();
  const sp = useSearchParams();
  const router = useRouter();
  const visible = REPORTS.filter((r) => !r.permission || can(r.permission));
  const id = sp.get("r");
  const def = id ? REPORT_BY_ID.get(id) : undefined;

  if (!id) return <Catalog reports={visible} />;
  if (!def || !visible.includes(def)) {
    return (
      <EmptyState
        icon={FileBarChart}
        title="Relatório indisponível"
        description="O relatório não existe ou você não tem permissão para consultá-lo."
        action={<Button onClick={() => router.push("/relatorios/")}>Ver relatórios</Button>}
      />
    );
  }
  return <ReportView key={def.id} def={def} />;
}

export default function ReportsPage() {
  return (
    <React.Suspense fallback={<FullPageLoading />}>
      <ReportsContent />
    </React.Suspense>
  );
}
