"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Home, Plus } from "lucide-react";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/states";
import { PropertyStatusBadge } from "@/components/shared/status-badges";
import { RequirePermission } from "@/components/auth/route-guard";
import { Button } from "@/components/ui/button";
import { useProperties, type Property } from "@/modules/properties/api";
import { useDepartments } from "@/modules/departments/api";
import { useAuth } from "@/providers/auth-provider";

function PropertiesContent() {
  const { can } = useAuth();
  const list = useProperties();
  const departments = useDepartments();
  const deptName = (id: string | null) => departments.data?.find((d) => d.id === id)?.name ?? "—";

  const columns: ColumnDef<Property, unknown>[] = [
    {
      id: "name",
      accessorFn: (p) => `${p.name} ${p.street} ${p.district} ${p.city}`,
      header: "Imóvel",
      meta: { label: "Imóvel", hideOnCard: true },
      cell: ({ row }) => (
        <Link href={`/imoveis/detalhe/?id=${row.original.id}`} className="group block min-w-0">
          <span className="group-hover:text-primary block font-semibold group-hover:underline">
            {row.original.name}
          </span>
          <span className="text-muted-foreground block text-xs">
            {row.original.street}, {row.original.address_number}, {row.original.district}, {row.original.city}
            /{row.original.state}
          </span>
        </Link>
      ),
    },
    {
      id: "department",
      accessorFn: (p) => deptName(p.department_id),
      header: "Secretaria",
      meta: { label: "Secretaria" },
    },
    { id: "purpose", accessorKey: "purpose", header: "Finalidade", meta: { label: "Finalidade" } },
    {
      id: "status",
      accessorKey: "status",
      header: "Situação",
      meta: { label: "Situação" },
      cell: ({ row }) => <PropertyStatusBadge status={row.original.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Imóveis"
        description="Imóveis ocupados pela Prefeitura no seu escopo de acesso. Cadastros e alterações de endereço ou secretaria passam pela Central de Aprovações."
        actions={
          can("properties.create") && (
            <Button asChild>
              <Link href="/imoveis/novo/">
                <Plus aria-hidden="true" /> Solicitar cadastro
              </Link>
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
            getRowId={(p) => p.id}
            searchPlaceholder="Buscar por nome, endereço ou bairro"
            cardTitle={(p) => (
              <Link
                href={`/imoveis/detalhe/?id=${p.id}`}
                className="text-primary font-semibold hover:underline"
              >
                {p.name}
              </Link>
            )}
            emptyState={
              <EmptyState
                icon={Home}
                title="Nenhum imóvel no seu escopo"
                description="Imóveis aparecem aqui depois que o cadastro é aprovado. Solicitações em andamento ficam na Central de Aprovações."
              />
            }
          />
        )}
      </Panel>
    </>
  );
}

export default function PropertiesPage() {
  return (
    <RequirePermission permission="properties.view">
      <PropertiesContent />
    </RequirePermission>
  );
}
