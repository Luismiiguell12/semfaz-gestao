"use client";

import Link from "next/link";
import { KeyRound, Lock, Plus } from "lucide-react";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions, useRoles } from "@/modules/roles/api";

function RolesContent() {
  const roles = useRoles();
  const permissions = usePermissions();
  const total = permissions.data?.length ?? 0;
  return (
    <>
      <PageHeader
        title="Perfis de acesso"
        description="Conjuntos de permissões atribuídos aos usuários. O perfil Administrador possui todas as permissões e não pode ser editado."
        actions={
          <Button asChild>
            <Link href="/administracao/perfis/detalhe/?id=novo">
              <Plus aria-hidden="true" /> Novo perfil
            </Link>
          </Button>
        }
      />
      <Panel bodyClassName="p-0">
        {roles.isLoading && <LoadingRows />}
        {roles.isError && <ErrorState message={roles.error.message} onRetry={() => roles.refetch()} />}
        {roles.data && roles.data.length === 0 && <EmptyState icon={KeyRound} title="Nenhum perfil cadastrado" />}
        <ul className="divide-y">
          {roles.data?.map((r) => {
            const count = r.code === "admin" ? total : r.role_permissions.length;
            return (
              <li key={r.id}>
                <Link
                  href={`/administracao/perfis/detalhe/?id=${r.id}`}
                  className="flex flex-col gap-2 px-5 py-4 hover:bg-surface focus-visible:outline-2 focus-visible:outline-ring sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {r.name}
                      {r.is_system && <Badge tone="neutral">Padrão</Badge>}
                      {r.code === "admin" && (
                        <Badge tone="brand">
                          <Lock aria-hidden="true" /> Todas as permissões
                        </Badge>
                      )}
                    </p>
                    {r.description && <p className="mt-0.5 text-sm text-muted-foreground">{r.description}</p>}
                  </div>
                  <p className="tabular text-sm text-muted-foreground">
                    {count} de {total} permissões
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}

export default function RolesPage() {
  return (
    <RequirePermission permission="roles.manage">
      <RolesContent />
    </RequirePermission>
  );
}
