"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ShieldCheck, ShieldOff, UserPlus, Users } from "lucide-react";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdminUsers, type AdminUser } from "@/modules/users/api";
import { UserStatusBadge } from "@/modules/users/components";
import { formatDateTime } from "@/lib/format";
import { InviteUserDialog } from "./invite-dialog";

const columns: ColumnDef<AdminUser, unknown>[] = [
  {
    id: "name",
    accessorFn: (u) => `${u.full_name} ${u.username} ${u.email}`,
    header: "Nome",
    meta: { label: "Nome", hideOnCard: true },
    cell: ({ row }) => (
      <Link href={`/administracao/usuarios/detalhe/?id=${row.original.id}`} className="group block min-w-0">
        <span className="text-foreground group-hover:text-primary block font-semibold group-hover:underline">
          {row.original.full_name}
        </span>
        <span className="text-muted-foreground block text-xs">
          {row.original.username}, {row.original.email}
        </span>
      </Link>
    ),
  },
  {
    id: "department",
    accessorFn: (u) => u.department_name ?? "",
    header: "Lotação",
    meta: { label: "Lotação" },
    cell: ({ getValue }) => (getValue() as string) || "—",
  },
  {
    id: "roles",
    accessorFn: (u) => u.roles.map((r) => r.name).join(", "),
    header: "Perfis",
    meta: { label: "Perfis" },
    cell: ({ row }) => (
      <span className="flex flex-wrap gap-1">
        {row.original.roles.map((r) => (
          <Badge key={r.id} tone={r.code === "admin" ? "brand" : "neutral"}>
            {r.name}
          </Badge>
        ))}
      </span>
    ),
  },
  {
    id: "status",
    accessorKey: "status",
    header: "Situação",
    meta: { label: "Situação" },
    cell: ({ row }) => <UserStatusBadge status={row.original.status} />,
  },
  {
    id: "mfa",
    accessorFn: (u) => (u.mfa_enrolled ? 1 : 0),
    header: "MFA",
    meta: { label: "MFA" },
    cell: ({ row }) =>
      row.original.mfa_enrolled ? (
        <span className="text-success inline-flex items-center gap-1 text-sm">
          <ShieldCheck className="size-4" aria-hidden="true" /> Ativo
        </span>
      ) : (
        <span className="text-muted-foreground inline-flex items-center gap-1 text-sm">
          <ShieldOff className="size-4" aria-hidden="true" /> Não
        </span>
      ),
  },
  {
    id: "last",
    accessorFn: (u) => u.last_sign_in_at ?? "",
    header: "Último acesso",
    meta: { label: "Último acesso" },
    cell: ({ row }) =>
      row.original.confirmed_at ? (
        <span className="tabular text-sm">{formatDateTime(row.original.last_sign_in_at)}</span>
      ) : (
        <Badge tone="info">Convite pendente</Badge>
      ),
  },
];

function UsersContent() {
  const users = useAdminUsers();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  return (
    <>
      <PageHeader
        title="Usuários"
        description="Cadastro por convite. Situação, perfis e escopos são alterados com justificativa registrada na auditoria."
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus aria-hidden="true" /> Convidar usuário
          </Button>
        }
      />
      <Panel bodyClassName="p-0">
        {users.isLoading && <LoadingRows />}
        {users.isError && <ErrorState message={users.error.message} onRetry={() => users.refetch()} />}
        {users.data && (
          <DataTable
            columns={columns}
            data={users.data}
            getRowId={(u) => u.id}
            searchPlaceholder="Buscar por nome, usuário ou e-mail"
            cardTitle={(u) => (
              <Link
                href={`/administracao/usuarios/detalhe/?id=${u.id}`}
                className="text-primary font-semibold hover:underline"
              >
                {u.full_name}
              </Link>
            )}
            emptyState={
              <EmptyState
                icon={Users}
                title="Nenhum usuário encontrado"
                description="Ajuste a busca ou convide um novo usuário."
              />
            }
          />
        )}
      </Panel>
      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}

export default function UsersPage() {
  return (
    <RequirePermission permission="users.manage">
      <UsersContent />
    </RequirePermission>
  );
}
