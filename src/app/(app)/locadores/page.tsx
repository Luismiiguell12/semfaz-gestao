"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchLandlordSensitive, useLandlords, type Landlord } from "@/modules/landlords/api";
import { LandlordDialog } from "@/modules/landlords/landlord-dialog";
import { formatCpfCnpj, formatPhone } from "@shared/schemas/br.ts";
import { useAuth } from "@/providers/auth-provider";

function SensitiveButton({ landlord }: { landlord: Landlord }) {
  const [data, setData] = React.useState<{ document: string; phone: string | null } | null>(null);
  const [loading, setLoading] = React.useState(false);
  if (data) {
    return (
      <span className="text-sm">
        {formatCpfCnpj(data.document)}
        {data.phone ? `, ${formatPhone(data.phone)}` : ""}
      </span>
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        try {
          setData(await fetchLandlordSensitive(landlord.id));
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setLoading(false);
        }
      }}
    >
      <Eye aria-hidden="true" /> Ver completo
      <span className="sr-only"> o documento de {landlord.name}</span>
    </Button>
  );
}

function LandlordsContent() {
  const { can } = useAuth();
  const list = useLandlords();
  const [dialog, setDialog] = React.useState<{ editing: Landlord | null } | null>(null);
  const canManage = can("landlords.manage");
  const canSensitive = can("landlords.view_sensitive");

  const columns: ColumnDef<Landlord, unknown>[] = [
    {
      id: "name",
      accessorFn: (l) => `${l.name} ${l.document_masked}`,
      header: "Locador",
      meta: { label: "Locador", hideOnCard: true },
      cell: ({ row }) => (
        <span>
          <Link
            href={`/locadores/detalhe/?id=${row.original.id}`}
            className="hover:text-primary block font-semibold hover:underline"
          >
            {row.original.name}
          </Link>
          <Badge tone="neutral">
            {row.original.person_type === "individual" ? "Pessoa física" : "Pessoa jurídica"}
          </Badge>
        </span>
      ),
    },
    {
      id: "document",
      accessorKey: "document_masked",
      header: "CPF/CNPJ",
      meta: { label: "CPF/CNPJ" },
      cell: ({ getValue }) => <span className="tabular">{getValue() as string}</span>,
    },
    {
      id: "phone",
      accessorFn: (l) => l.phone_masked ?? "",
      header: "Telefone",
      meta: { label: "Telefone" },
      cell: ({ getValue }) => (getValue() as string) || "—",
    },
    {
      id: "email",
      accessorFn: (l) => l.email ?? "",
      header: "E-mail",
      meta: { label: "E-mail" },
      cell: ({ getValue }) => (getValue() as string) || "—",
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { label: "Ações" },
      cell: ({ row }) => (
        <span className="flex flex-wrap justify-end gap-1">
          {canSensitive && <SensitiveButton landlord={row.original} />}
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDialog({ editing: row.original })}
              aria-label={`Editar ${row.original.name}`}
            >
              <Pencil aria-hidden="true" /> Editar
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Locadores"
        description="Pessoas e empresas que alugam imóveis à Prefeitura. CPF e telefone aparecem mascarados; a consulta completa é restrita e fica registrada."
        actions={
          canManage && (
            <Button onClick={() => setDialog({ editing: null })}>
              <Plus aria-hidden="true" /> Novo locador
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
            getRowId={(l) => l.id}
            searchPlaceholder="Buscar por nome"
            cardTitle={(l) => (
              <Link
                href={`/locadores/detalhe/?id=${l.id}`}
                className="text-primary font-semibold hover:underline"
              >
                {l.name}
              </Link>
            )}
            emptyState={<EmptyState icon={UserRound} title="Nenhum locador cadastrado" />}
          />
        )}
      </Panel>
      {dialog && (
        <LandlordDialog
          key={dialog.editing?.id ?? "new"}
          editing={dialog.editing}
          open
          onOpenChange={(v) => !v && setDialog(null)}
        />
      )}
    </>
  );
}

export default function LandlordsPage() {
  return (
    <RequirePermission permission="landlords.view">
      <LandlordsContent />
    </RequirePermission>
  );
}
