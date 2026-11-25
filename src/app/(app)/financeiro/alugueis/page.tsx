"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Banknote } from "lucide-react";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCompetence, useRents, type RentOverview } from "@/modules/finance/api";
import { ChargeStatusBadge } from "@/modules/finance/components";
import { formatCalendarDate, formatCurrency } from "@/lib/format";

const columns: ColumnDef<RentOverview, unknown>[] = [
  {
    id: "contract",
    accessorFn: (r) => `${r.contract_number} ${r.property_name}`,
    header: "Contrato",
    meta: { label: "Contrato", hideOnCard: true },
    cell: ({ row }) => (
      <Link href={`/financeiro/alugueis/detalhe/?id=${row.original.id}`} className="group block">
        <span className="group-hover:text-primary block font-semibold group-hover:underline">
          Contrato {row.original.contract_number}
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
    accessorFn: (r) => Number(r.amount),
    header: "Valor",
    meta: { label: "Valor" },
    cell: ({ row }) => (
      <span className="tabular">
        {formatCurrency(row.original.amount)}
        {!(row.original.calc_memo as { full_month?: boolean } | null)?.full_month && (
          <span className="text-muted-foreground ml-1 text-xs">(proporcional)</span>
        )}
      </span>
    ),
  },
  {
    id: "balance",
    accessorFn: (r) => Number(r.balance),
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

function RentsContent() {
  const list = useRents();
  const [filter, setFilter] = React.useState<Filter>("open");
  const data = (list.data ?? []).filter((r) =>
    filter === "all"
      ? true
      : filter === "open"
        ? ["pending", "partially_paid", "overdue"].includes(r.status ?? "")
        : r.status === filter,
  );
  return (
    <>
      <PageHeader
        title="Aluguéis"
        description="Gerados automaticamente todo mês para os contratos vigentes. Meses incompletos são proporcionais aos dias de vigência."
      />
      <Panel bodyClassName="p-0">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="px-4 pt-2">
          <TabsList className="border-b-0">
            <TabsTrigger value="open">Em aberto</TabsTrigger>
            <TabsTrigger value="overdue">Vencidos</TabsTrigger>
            <TabsTrigger value="paid">Pagos</TabsTrigger>
            <TabsTrigger value="all">Todos</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="border-t">
          {list.isLoading && <LoadingRows />}
          {list.isError && <ErrorState message={list.error.message} onRetry={() => list.refetch()} />}
          {list.data && (
            <DataTable
              key={filter}
              columns={columns}
              data={data}
              getRowId={(r) => r.id!}
              searchPlaceholder="Buscar por contrato ou imóvel"
              cardTitle={(r) => (
                <Link
                  href={`/financeiro/alugueis/detalhe/?id=${r.id}`}
                  className="text-primary font-semibold hover:underline"
                >
                  Contrato {r.contract_number}
                </Link>
              )}
              emptyState={
                <EmptyState
                  icon={Banknote}
                  title="Nenhum aluguel encontrado"
                  description="Os lançamentos aparecem quando há contrato vigente aprovado."
                />
              }
            />
          )}
        </div>
      </Panel>
    </>
  );
}

export default function RentsPage() {
  return (
    <RequirePermission permission="invoices.view">
      <RentsContent />
    </RequirePermission>
  );
}
