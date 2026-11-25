"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Banknote } from "lucide-react";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState, ErrorState, FullPageLoading, LoadingRows } from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EXPENSE_KIND_LABEL,
  formatCompetence,
  usePayments,
  type PaymentListRow,
} from "@/modules/finance/api";
import {
  hasDrill,
  useDepartmentSubtree,
  useDrillFilters,
  useLandlordContractIds,
} from "@/modules/finance/drill";
import { DrillBanner } from "@/modules/finance/drill-banner";
import { formatCalendarDate, formatCurrency } from "@/lib/format";

const signed = (p: PaymentListRow) => (p.kind === "reversal" ? -Number(p.amount) : Number(p.amount));

const columns: ColumnDef<PaymentListRow, unknown>[] = [
  {
    id: "paid_on",
    accessorKey: "paid_on",
    header: "Data",
    meta: { label: "Data" },
    cell: ({ row }) => <span className="tabular">{formatCalendarDate(row.original.paid_on)}</span>,
  },
  {
    id: "item",
    accessorFn: (p) => `${p.description} ${p.property_name ?? ""}`,
    header: "Lançamento",
    meta: { label: "Lançamento", hideOnCard: true },
    cell: ({ row }) => (
      <div>
        <Link
          href={row.original.href}
          className="text-foreground hover:text-primary font-semibold hover:underline"
        >
          {row.original.description}
        </Link>
        <span className="text-muted-foreground block text-xs">
          Competência {formatCompetence(row.original.competence)}
        </span>
      </div>
    ),
  },
  {
    id: "property",
    accessorKey: "property_name",
    header: "Imóvel",
    meta: { label: "Imóvel" },
    cell: ({ row }) =>
      row.original.property_id ? (
        <Link
          href={`/imoveis/detalhe/?id=${row.original.property_id}`}
          className="text-primary hover:underline"
        >
          {row.original.property_name}
        </Link>
      ) : (
        <span className="text-muted-foreground">Acesso restrito</span>
      ),
  },
  {
    id: "kind",
    accessorFn: (p) => EXPENSE_KIND_LABEL[p.kind_of_expense],
    header: "Despesa",
    meta: { label: "Despesa" },
  },
  {
    id: "movement",
    accessorKey: "kind",
    header: "Movimento",
    meta: { label: "Movimento" },
    cell: ({ row }) =>
      row.original.kind === "reversal" ? (
        <Badge tone="warning">Estorno</Badge>
      ) : (
        <Badge tone="success">Pagamento</Badge>
      ),
  },
  {
    id: "amount",
    accessorFn: signed,
    header: "Valor",
    meta: { label: "Valor", className: "text-right" },
    cell: ({ row }) => <span className="tabular">{formatCurrency(signed(row.original))}</span>,
  },
];

type Tab = "all" | "payment" | "reversal";

function PaymentsContent() {
  const list = usePayments();
  const drill = useDrillFilters();
  const subtree = useDepartmentSubtree(drill.departmentId);
  const landlordContracts = useLandlordContractIds(drill.landlordId);
  const drilled = hasDrill(drill);
  const [tab, setTab] = React.useState<Tab>("all");

  const data = (list.data ?? []).filter((p) => {
    if (tab !== "all" && p.kind !== tab) return false;
    const month = p.paid_on.slice(0, 7);
    if (drill.from && month < drill.from) return false;
    if (drill.to && month > drill.to) return false;
    if (drill.propertyId && p.property_id !== drill.propertyId) return false;
    if (subtree && (!p.department_id || !subtree.has(p.department_id))) return false;
    if (drill.kinds?.length && !drill.kinds.includes(p.kind_of_expense)) return false;
    if (drill.supplierId && p.supplier_id !== drill.supplierId) return false;
    if (drill.landlordId && (!p.contract_id || !landlordContracts.data?.has(p.contract_id))) return false;
    return true;
  });
  const net = data.reduce((acc, p) => acc + Math.round(signed(p) * 100), 0) / 100;

  return (
    <>
      <PageHeader
        title="Pagamentos"
        description="Pagamentos e estornos aprovados de faturas e aluguéis. São registros permanentes: um estorno não apaga o pagamento original."
      />
      {drilled && <DrillBanner filters={drill} clearHref="/financeiro/pagamentos/" />}
      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList className="border-b-0">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="payment">Pagamentos</TabsTrigger>
              <TabsTrigger value="reversal">Estornos</TabsTrigger>
            </TabsList>
          </Tabs>
          {list.data && (
            <p className="text-muted-foreground pb-2 text-sm">
              Total líquido:{" "}
              <span className="tabular text-foreground font-semibold">{formatCurrency(net)}</span>
            </p>
          )}
        </div>
        <div className="border-t">
          {list.isLoading && <LoadingRows />}
          {list.isError && <ErrorState message={list.error.message} onRetry={() => list.refetch()} />}
          {list.data && (
            <DataTable
              key={tab}
              columns={columns}
              data={data}
              getRowId={(p) => p.id}
              searchPlaceholder="Buscar por lançamento ou imóvel"
              cardTitle={(p) => (
                <Link href={p.href} className="text-primary font-semibold hover:underline">
                  {p.description}
                </Link>
              )}
              emptyState={
                <EmptyState
                  icon={Banknote}
                  title="Nenhum pagamento encontrado"
                  description="Os pagamentos aparecem aqui depois de aprovados na Central de Aprovações."
                />
              }
            />
          )}
        </div>
      </Panel>
    </>
  );
}

export default function PaymentsPage() {
  return (
    <RequirePermission permission="invoices.view">
      <React.Suspense fallback={<FullPageLoading />}>
        <PaymentsContent />
      </React.Suspense>
    </RequirePermission>
  );
}
