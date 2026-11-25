"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, PlugZap } from "lucide-react";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SUPPLIER_KIND_LABEL, useConsumerUnits } from "@/modules/consumer-units/api";
import { useAuth } from "@/providers/auth-provider";
import { UnitDialog } from "./unit-dialog";

type Row = NonNullable<ReturnType<typeof useConsumerUnits>["data"]>[number];

const columns: ColumnDef<Row, unknown>[] = [
  {
    id: "id",
    accessorFn: (u) => `${u.identifier} ${u.holder_name}`,
    header: "Unidade",
    meta: { label: "Unidade", hideOnCard: true },
    cell: ({ row }) => (
      <Link href={`/unidades/detalhe/?id=${row.original.id}`} className="group block">
        <span className="tabular group-hover:text-primary block font-semibold group-hover:underline">
          {row.original.identifier}
        </span>
        <span className="text-muted-foreground block text-xs">{row.original.holder_name}</span>
      </Link>
    ),
  },
  {
    id: "supplier",
    accessorFn: (u) => (u.suppliers as { name: string } | null)?.name ?? "",
    header: "Fornecedor",
    meta: { label: "Fornecedor" },
    cell: ({ row }) => {
      const s = row.original.suppliers as { name: string; kind: "energy" | "water" } | null;
      return s ? (
        <span>
          {s.name} <Badge tone="neutral">{SUPPLIER_KIND_LABEL[s.kind]}</Badge>
        </span>
      ) : (
        "—"
      );
    },
  },
  {
    id: "property",
    accessorFn: (u) => u.current?.properties?.name ?? "",
    header: "Imóvel atual",
    meta: { label: "Imóvel atual" },
    cell: ({ row }) =>
      row.original.current?.properties?.name ?? <span className="text-muted-foreground">Sem vínculo</span>,
  },
  {
    id: "status",
    accessorKey: "status",
    header: "Situação",
    meta: { label: "Situação" },
    cell: ({ row }) => (
      <Badge tone={row.original.status === "active" ? "success" : "neutral"}>
        {row.original.status === "active" ? "Ativa" : "Inativa"}
      </Badge>
    ),
  },
];

function UnitsContent() {
  const { can } = useAuth();
  const list = useConsumerUnits();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <PageHeader
        title="Unidades consumidoras"
        description="Unidades de energia (Energisa) e água (Iguá), com o histórico de vínculo a cada imóvel."
        actions={
          can("consumer_units.manage") && (
            <Button onClick={() => setOpen(true)}>
              <Plus aria-hidden="true" /> Nova unidade
            </Button>
          )
        }
      />
      <Panel bodyClassName="p-0">
        {list.isLoading && <LoadingRows />}
        {list.isError && <ErrorState message={list.error.message} onRetry={() => list.refetch()} />}
        {list.data && (
          <DataTable
            columns={columns}
            data={list.data}
            getRowId={(u) => u.id}
            searchPlaceholder="Buscar por número, matrícula ou titular"
            cardTitle={(u) => (
              <Link
                href={`/unidades/detalhe/?id=${u.id}`}
                className="tabular text-primary font-semibold hover:underline"
              >
                {u.identifier}
              </Link>
            )}
            emptyState={<EmptyState icon={PlugZap} title="Nenhuma unidade consumidora no seu escopo" />}
          />
        )}
      </Panel>
      {open && <UnitDialog unit={null} open onOpenChange={setOpen} />}
    </>
  );
}

export default function UnitsPage() {
  return (
    <RequirePermission permission="consumer_units.view">
      <UnitsContent />
    </RequirePermission>
  );
}
