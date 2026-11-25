"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Receipt } from "lucide-react";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState, ErrorState, FullPageLoading, LoadingRows } from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import { Button } from "@/components/ui/button";
import { FilterTab, FilterTabs, FilterTabsList } from "@/components/ui/filter-tabs";
import { formatCompetence, useInvoices, type InvoiceOverview } from "@/modules/finance/api";
import { ChargeStatusBadge } from "@/modules/finance/components";
import { useAuth } from "@/providers/auth-provider";
import { hasDrill, useDepartmentSubtree, useDrillFilters } from "@/modules/finance/drill";
import { DrillBanner } from "@/modules/finance/drill-banner";
import { formatCalendarDate, formatCurrency } from "@/lib/format";

const columns: ColumnDef<InvoiceOverview, unknown>[] = [
  {
    id: "unit",
    accessorFn: (i) => `${i.unit_identifier} ${i.supplier_name} ${i.property_name} ${i.invoice_number ?? ""}`,
    header: "Unidade",
    meta: { label: "Unidade", hideOnCard: true },
    cell: ({ row }) => (
      <Link href={`/financeiro/faturas/detalhe/?id=${row.original.id}`} className="group block">
        <span className="group-hover:text-primary block font-semibold group-hover:underline">
          {row.original.supplier_name} {row.original.unit_identifier}
        </span>
        <span className="text-muted-foreground block text-xs">{row.original.property_name}</span>
      </Link>
    ),
  },
  {
    id: "competence",
    accessorKey: "competence",
    header: "Competência",
    meta: { label: "Competência" },
    cell: ({ row }) => <span className="tabular">{formatCompetence(row.original.competence)}</span>,
  },
  {
    id: "due",
    accessorKey: "due_date",
    header: "Vencimento",
    meta: { label: "Vencimento" },
    cell: ({ row }) => <span className="tabular">{formatCalendarDate(row.original.due_date)}</span>,
  },
  {
    id: "amount",
    accessorFn: (i) => Number(i.amount),
    header: "Valor",
    meta: { label: "Valor" },
    cell: ({ row }) => <span className="tabular">{formatCurrency(row.original.amount)}</span>,
  },
  {
    id: "balance",
    accessorFn: (i) => Number(i.balance),
    header: "Saldo",
    meta: { label: "Saldo" },
    cell: ({ row }) => <span className="tabular">{formatCurrency(row.original.balance)}</span>,
  },
  {
    id: "status",
    accessorKey: "status",
    header: "Situação",
    meta: { label: "Situação" },
    cell: ({ row }) => <ChargeStatusBadge status={row.original.status} />,
  },
];

type Filter = "open" | "overdue" | "paid" | "all";

function InvoicesContent() {
  const { can } = useAuth();
  const drill = useDrillFilters();
  const subtree = useDepartmentSubtree(drill.departmentId);
  const drilled = hasDrill(drill);
  const list = useInvoices(
    {
      from: drill.from,
      to: drill.to,
      propertyId: drill.propertyId,
      departmentIds: subtree ? [...subtree] : undefined,
      statuses: drill.statuses,
      kinds: drill.kinds?.filter((k) => k !== "rent"),
      supplierId: drill.supplierId,
    },
    !drill.departmentId || subtree !== undefined,
  );
  const [filter, setFilter] = React.useState<Filter>(drilled ? "all" : "open");
  const data = (list.data ?? []).filter((i) =>
    filter === "all"
      ? true
      : filter === "open"
        ? ["pending", "partially_paid", "overdue"].includes(i.status ?? "")
        : i.status === filter,
  );
  return (
    <>
      <PageHeader
        title="Faturas de água e energia"
        description="A situação é calculada pelos pagamentos aprovados e pelo vencimento; anexar um comprovante não marca a fatura como paga."
        actions={
          can("invoices.manage") && (
            <Button asChild>
              <Link href="/financeiro/faturas/nova/">
                <Plus aria-hidden="true" /> Lançar fatura
              </Link>
            </Button>
          )
        }
      />
      {drilled && <DrillBanner filters={drill} clearHref="/financeiro/faturas/" />}
      <Panel bodyClassName="p-0">
        <FilterTabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="px-4 pt-2">
          <FilterTabsList className="border-b-0" aria-label="Filtrar faturas por situação">
            <FilterTab value="open">Em aberto</FilterTab>
            <FilterTab value="overdue">Vencidas</FilterTab>
            <FilterTab value="paid">Pagas</FilterTab>
            <FilterTab value="all">Todas</FilterTab>
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
              getRowId={(i) => i.id!}
              searchPlaceholder="Buscar por unidade, imóvel ou número"
              cardTitle={(i) => (
                <Link
                  href={`/financeiro/faturas/detalhe/?id=${i.id}`}
                  className="text-primary font-semibold hover:underline"
                >
                  {i.supplier_name} {i.unit_identifier}
                </Link>
              )}
              emptyState={<EmptyState icon={Receipt} title="Nenhuma fatura encontrada" />}
            />
          )}
        </div>
      </Panel>
    </>
  );
}

export default function InvoicesPage() {
  return (
    <RequirePermission permission="invoices.view">
      <React.Suspense fallback={<FullPageLoading />}>
        <InvoicesContent />
      </React.Suspense>
    </RequirePermission>
  );
}
