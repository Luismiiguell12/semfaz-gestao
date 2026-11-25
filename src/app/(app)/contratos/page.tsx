"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { FileSignature, Plus } from "lucide-react";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/states";
import { ValidityBadge } from "@/components/shared/status-badges";
import { RequirePermission } from "@/components/auth/route-guard";
import { Button } from "@/components/ui/button";
import { FilterTab, FilterTabs, FilterTabsList } from "@/components/ui/filter-tabs";
import { useContracts, type ContractOverview } from "@/modules/contracts/api";
import { useAuth } from "@/providers/auth-provider";
import { formatCalendarDate, formatCurrency } from "@/lib/format";

const columns: ColumnDef<ContractOverview, unknown>[] = [
  {
    id: "number",
    accessorFn: (c) => `${c.contract_number} ${c.property_name} ${c.process_number ?? ""}`,
    header: "Contrato",
    meta: { label: "Contrato", hideOnCard: true },
    cell: ({ row }) => (
      <Link href={`/contratos/detalhe/?id=${row.original.id}`} className="group block">
        <span className="group-hover:text-primary block font-semibold group-hover:underline">
          {row.original.contract_number}
        </span>
        <span className="text-muted-foreground block text-xs">{row.original.property_name}</span>
      </Link>
    ),
  },
  {
    id: "end",
    accessorFn: (c) => c.effective_end_date ?? "",
    header: "Vigência até",
    meta: { label: "Vigência até" },
    cell: ({ row }) => <span className="tabular">{formatCalendarDate(row.original.effective_end_date)}</span>,
  },
  {
    id: "value",
    accessorFn: (c) => Number(c.effective_monthly_value ?? 0),
    header: "Valor mensal vigente",
    meta: { label: "Valor mensal", className: "text-right" },
    cell: ({ row }) => (
      <span className="tabular">{formatCurrency(row.original.effective_monthly_value)}</span>
    ),
  },
  {
    id: "status",
    accessorFn: (c) => c.validity_status ?? "",
    header: "Situação",
    meta: { label: "Situação" },
    cell: ({ row }) => <ValidityBadge status={row.original.validity_status} />,
  },
];

type Filter = "all" | "current" | "expiring" | "expired";

function ContractsContent() {
  const { can } = useAuth();
  const list = useContracts();
  const [filter, setFilter] = React.useState<Filter>("all");
  const data = (list.data ?? []).filter((c) =>
    filter === "all"
      ? true
      : filter === "current"
        ? c.validity_status === "active" || c.validity_status === "expiring"
        : c.validity_status === filter,
  );
  return (
    <>
      <PageHeader
        title="Contratos"
        description="Vigência e valor vigentes são calculados a partir do contrato e dos aditivos aprovados. Novos contratos e aditivos passam pela Central de Aprovações."
        actions={
          can("contracts.manage") && (
            <Button asChild>
              <Link href="/contratos/novo/">
                <Plus aria-hidden="true" /> Solicitar contrato
              </Link>
            </Button>
          )
        }
      />
      <Panel bodyClassName="p-0">
        <FilterTabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="px-4 pt-2">
          <FilterTabsList className="border-b-0" aria-label="Filtrar contratos por vigência">
            <FilterTab value="all">Todos</FilterTab>
            <FilterTab value="current">Vigentes</FilterTab>
            <FilterTab value="expiring">Próximos do vencimento</FilterTab>
            <FilterTab value="expired">Vencidos</FilterTab>
          </FilterTabsList>
        </FilterTabs>
        <div className="border-t">
          {list.isLoading && <LoadingRows />}
          {list.isError && <ErrorState message={list.error.message} onRetry={() => list.refetch()} />}
          {list.data && (
            <DataTable
              key={filter}
              columns={columns}
              data={data}
              getRowId={(c) => c.id!}
              searchPlaceholder="Buscar por número, imóvel ou processo"
              cardTitle={(c) => (
                <Link
                  href={`/contratos/detalhe/?id=${c.id}`}
                  className="text-primary font-semibold hover:underline"
                >
                  Contrato {c.contract_number}
                </Link>
              )}
              emptyState={
                <EmptyState
                  icon={FileSignature}
                  title="Nenhum contrato encontrado"
                  description="Contratos aparecem aqui depois da aprovação do cadastro."
                />
              }
            />
          )}
        </div>
      </Panel>
    </>
  );
}

export default function ContractsPage() {
  return (
    <RequirePermission permission="contracts.view">
      <ContractsContent />
    </RequirePermission>
  );
}
