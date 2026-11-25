"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, ListChecks } from "lucide-react";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import {
  EmptyState,
  ErrorState,
  FullPageLoading,
  InlineAlert,
  LoadingRows,
} from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import {
  EXPENSE_KIND_LABEL,
  formatCompetence,
  useExpenseItems,
  type ExpenseItem,
  type ExpenseKind,
} from "@/modules/finance/api";
import { ChargeStatusBadge } from "@/modules/finance/components";
import { useDepartmentSubtree, useDrillFilters, useLandlordContractIds } from "@/modules/finance/drill";
import { DrillBanner } from "@/modules/finance/drill-banner";
import { formatCalendarDate, formatCurrency } from "@/lib/format";

const href = (i: ExpenseItem) =>
  i.source === "invoice"
    ? `/financeiro/faturas/detalhe/?id=${i.id}`
    : `/financeiro/alugueis/detalhe/?id=${i.id}`;

const columns: ColumnDef<ExpenseItem, unknown>[] = [
  {
    id: "item",
    accessorFn: (i) =>
      `${EXPENSE_KIND_LABEL[i.kind as ExpenseKind]} ${i.supplier_name ?? ""} ${i.property_name ?? ""}`,
    header: "Lançamento",
    meta: { label: "Lançamento", hideOnCard: true },
    cell: ({ row }) => (
      <Link href={href(row.original)} className="group block">
        <span className="group-hover:text-primary block font-semibold group-hover:underline">
          {EXPENSE_KIND_LABEL[row.original.kind as ExpenseKind]}
          {row.original.supplier_name ? ` · ${row.original.supplier_name}` : ""}
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

function ItemsContent() {
  const drill = useDrillFilters();
  const subtree = useDepartmentSubtree(drill.departmentId);
  const landlordContracts = useLandlordContractIds(drill.landlordId);
  const list = useExpenseItems(
    {
      from: drill.from,
      to: drill.to,
      propertyId: drill.propertyId,
      departmentIds: subtree ? [...subtree] : undefined,
      statuses: drill.statuses,
      kinds: drill.kinds,
      supplierId: drill.supplierId,
      contractIds: landlordContracts.data ? [...landlordContracts.data] : undefined,
    },
    (!drill.departmentId || subtree !== undefined) && (!drill.landlordId || landlordContracts.isSuccess),
  );
  const total = (list.data ?? []).reduce((acc, i) => acc + Math.round(Number(i.amount) * 100), 0) / 100;
  return (
    <>
      <Link
        href="/financeiro/relatorios/"
        className="text-primary mb-4 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Relatórios de despesas
      </Link>
      <PageHeader
        title="Lançamentos do relatório"
        description="Faturas e aluguéis que compõem o valor selecionado (base competência), dentro do seu escopo."
      />
      <DrillBanner filters={drill} clearHref="/financeiro/relatorios/lancamentos/" />
      {drill.landlordId && (
        <InlineAlert tone="info" className="mb-4">
          No relatório, aluguéis com mais de um locador são distribuídos pelo percentual de participação. Aqui
          aparece o valor integral de cada aluguel.
        </InlineAlert>
      )}
      <Panel
        bodyClassName="p-0"
        title={
          list.data ? `${list.data.length} lançamento${list.data.length === 1 ? "" : "s"}` : "Lançamentos"
        }
        actions={
          list.data && (
            <span className="text-muted-foreground text-sm">
              Total: <span className="tabular text-foreground font-semibold">{formatCurrency(total)}</span>
            </span>
          )
        }
      >
        {list.isLoading && <LoadingRows />}
        {list.isError && <ErrorState message={list.error.message} onRetry={() => list.refetch()} />}
        {list.data && (
          <DataTable
            columns={columns}
            data={list.data}
            getRowId={(i) => `${i.source}-${i.id}`}
            searchPlaceholder="Buscar por tipo, fornecedor ou imóvel"
            cardTitle={(i) => (
              <Link href={href(i)} className="text-primary font-semibold hover:underline">
                {EXPENSE_KIND_LABEL[i.kind as ExpenseKind]}
                {i.supplier_name ? ` · ${i.supplier_name}` : ""} · {i.property_name}
              </Link>
            )}
            emptyState={<EmptyState icon={ListChecks} title="Nenhum lançamento com estes filtros" />}
          />
        )}
      </Panel>
    </>
  );
}

export default function ExpenseItemsPage() {
  return (
    <RequirePermission permission="finance.reports.view">
      <React.Suspense fallback={<FullPageLoading />}>
        <ItemsContent />
      </React.Suspense>
    </RequirePermission>
  );
}
