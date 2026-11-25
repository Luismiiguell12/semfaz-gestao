"use client";

import * as React from "react";
import Link from "next/link";
import { Stamp } from "lucide-react";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { EmptyState, ErrorState, InlineAlert, LoadingRows } from "@/components/shared/states";
import { ApprovalStatusBadge } from "@/components/shared/status-badges";
import { FilterTab, FilterTabs, FilterTabsList } from "@/components/ui/filter-tabs";
import { useApprovalRequests } from "@/modules/approvals/api";
import { useUserDirectory } from "@/modules/users/api";
import { useFoundationStats } from "@/modules/dashboard/api";
import { useAuth } from "@/providers/auth-provider";
import { formatDateTime } from "@/lib/format";

type Filter = "to_review" | "mine" | "all";

export default function ApprovalsPage() {
  const { access, can } = useAuth();
  const canReview = can("approvals.review");
  const [filter, setFilter] = React.useState<Filter>(canReview ? "to_review" : "mine");
  const list = useApprovalRequests(filter, access?.profile?.id);
  const directory = useUserDirectory();
  const stats = useFoundationStats();

  return (
    <>
      <PageHeader
        title="Aprovações"
        description="Operações importantes só são efetivadas depois da decisão de um administrador diferente de quem solicitou."
      />
      {canReview && stats.data?.users && stats.data.users.active_admins < 2 && (
        <InlineAlert tone="warning" className="mb-4" title="Apenas um administrador ativo">
          Solicitações feitas pelo próprio administrador ficarão pendentes até que outro administrador seja
          cadastrado.
        </InlineAlert>
      )}
      <Panel bodyClassName="p-0">
        <FilterTabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="px-4 pt-2">
          <FilterTabsList className="border-b-0" aria-label="Filtrar solicitações">
            {canReview && <FilterTab value="to_review">Aguardando minha decisão</FilterTab>}
            <FilterTab value="mine">Minhas solicitações</FilterTab>
            {canReview && <FilterTab value="all">Todas</FilterTab>}
          </FilterTabsList>
        </FilterTabs>
        <div className="border-t">
          {list.isLoading && <LoadingRows />}
          {list.isError && <ErrorState message={list.error.message} onRetry={() => list.refetch()} />}
          {list.data && list.data.length === 0 && (
            <EmptyState
              icon={Stamp}
              title={
                filter === "to_review" ? "Nenhuma solicitação aguardando sua decisão" : "Nenhuma solicitação"
              }
              description="Cadastros de imóveis e contratos, aditivos e alterações sensíveis aparecem aqui."
            />
          )}
          <ul className="divide-y">
            {list.data?.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/aprovacoes/detalhe/?id=${r.id}`}
                  className="hover:bg-surface focus-visible:outline-ring flex flex-col gap-2 px-5 py-4 focus-visible:outline-2 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{r.approval_operations?.description ?? r.operation_code}</p>
                    <p className="text-muted-foreground mt-0.5 line-clamp-1 text-sm">{r.justification}</p>
                  </div>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:justify-end">
                    <span>{directory.data?.get(r.requested_by)?.full_name ?? "Solicitante"}</span>
                    <span className="tabular">{formatDateTime(r.requested_at)}</span>
                    <ApprovalStatusBadge status={r.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Panel>
    </>
  );
}
