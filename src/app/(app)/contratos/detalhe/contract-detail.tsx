"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BellRing, Plus } from "lucide-react";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { EmptyState, ErrorState, FullPageLoading } from "@/components/shared/states";
import { DetailList, Figure } from "@/components/shared/detail-list";
import { ApprovalStatusBadge, ValidityBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ADMIN_STATUS_LABEL,
  AMENDMENT_KIND_LABEL,
  useContract,
  useContractLists,
} from "@/modules/contracts/api";
import { useEntityApprovals } from "@/modules/approvals/api";
import { useUserDirectory } from "@/modules/users/api";
import { DocumentsPanel } from "@/modules/documents/documents-panel";
import { useAuth } from "@/providers/auth-provider";
import { formatCompetence, useRents } from "@/modules/finance/api";
import { ChargeStatusBadge } from "@/modules/finance/components";
import { formatCalendarDate, formatCurrency, formatDateTime } from "@/lib/format";
import {
  AmendmentDialog,
  ContractDetailsDialog,
  TermChangeDialog,
  ValueChangeDialog,
} from "./contract-dialogs";

function ContractRentsTab({ contractId }: { contractId: string }) {
  const q = useRents({ contractId });
  const { can } = useAuth();
  if (!can("invoices.view")) return <EmptyState title="Acesso restrito" className="py-6" />;
  return (
    <div>
      {q.data && q.data.length === 0 && (
        <EmptyState
          title="Nenhum aluguel gerado"
          description="Os lançamentos são gerados automaticamente enquanto o contrato estiver vigente."
          className="py-6"
        />
      )}
      <ul className="divide-y rounded-md border empty:hidden">
        {q.data?.map((r) => (
          <li key={r.id}>
            <Link
              href={`/financeiro/alugueis/detalhe/?id=${r.id}`}
              className="hover:bg-surface flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="tabular text-sm font-medium">
                Competência {formatCompetence(r.competence)}
              </span>
              <span className="flex items-center gap-3 text-sm">
                <span className="tabular">{formatCurrency(r.amount)}</span>
                <ChargeStatusBadge status={r.status} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ContractDetail() {
  const id = useSearchParams().get("id");
  const { can } = useAuth();
  const q = useContract(id);
  const lists = useContractLists();
  const history = useEntityApprovals(id ?? undefined);
  const directory = useUserDirectory();
  const [dialog, setDialog] = React.useState<"details" | "value" | "term" | "amendment" | null>(null);

  if (q.isLoading) return <FullPageLoading />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const c = q.data?.contract;
  if (!c)
    return (
      <ErrorState
        title="Contrato não encontrado."
        message="Ele não existe ou está fora do seu escopo de acesso."
      />
    );

  const person = (uid: string | null) => (uid ? (directory.data?.get(uid)?.full_name ?? "Usuário") : "—");
  const listName = (arr: { id: string; name: string }[] | undefined, lid: string | null) =>
    arr?.find((x) => x.id === lid)?.name ?? "—";
  const canManage = can("contracts.manage");
  const pendingAmendments = (history.data ?? []).filter(
    (r) => r.operation_code === "amendment.create" && r.status === "pending",
  );

  return (
    <>
      <Button asChild variant="link" size="sm" className="mb-3">
        <Link href="/contratos/">
          <ArrowLeft aria-hidden="true" /> Contratos
        </Link>
      </Button>
      <PageHeader
        title={`Contrato ${c.contract_number}`}
        description={
          <>
            Imóvel:{" "}
            <Link
              href={`/imoveis/detalhe/?id=${c.property_id}`}
              className="text-primary font-medium hover:underline"
            >
              {c.property_name}
            </Link>
          </>
        }
        actions={<ValidityBadge status={c.validity_status} />}
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Figure
          label="Vigência efetiva"
          value={formatCalendarDate(c.effective_end_date)}
          hint={`Início em ${formatCalendarDate(c.start_date)}`}
        />
        <Figure
          label="Dias para o vencimento"
          value={c.days_to_end !== null && c.days_to_end >= 0 ? c.days_to_end : "Vencido"}
          hint={
            c.effective_end_date !== c.end_date
              ? "Considera aditivos de prazo"
              : "Conforme o contrato original"
          }
        />
        <Figure
          label="Valor mensal vigente"
          value={formatCurrency(c.effective_monthly_value)}
          hint={`Original: ${formatCurrency(c.monthly_value)}`}
        />
        <Figure
          label="Próxima data-base"
          value={formatCalendarDate(c.next_adjustment_date)}
          hint="O sistema alerta; não calcula reajustes"
        />
      </div>
      <Panel bodyClassName="pt-1">
        <Tabs defaultValue="resumo">
          <TabsList>
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="aditivos">Aditivos ({q.data?.amendments.length ?? 0})</TabsTrigger>
            <TabsTrigger value="alugueis">Aluguéis</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="alertas">Alertas</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="resumo" className="space-y-6">
            <DetailList
              items={[
                { label: "Processo administrativo", value: c.process_number ?? "—" },
                { label: "Modalidade", value: listName(lists.data?.modalities, c.modality_id) },
                {
                  label: "Situação administrativa",
                  value: c.admin_status ? ADMIN_STATUS_LABEL[c.admin_status] : "—",
                },
                { label: "Objeto", value: c.object },
                { label: "Assinatura", value: formatCalendarDate(c.signed_on) },
                {
                  label: "Vigência original",
                  value: `${formatCalendarDate(c.start_date)} a ${formatCalendarDate(c.end_date)}`,
                },
                { label: "Valor global", value: formatCurrency(c.global_value) },
                { label: "Índice de reajuste", value: listName(lists.data?.indexes, c.adjustment_index_id) },
                { label: "Data-base", value: formatCalendarDate(c.base_date) },
                { label: "Gestor do contrato", value: person(c.manager_id) },
                { label: "Fiscal do contrato", value: person(c.inspector_id) },
                { label: "Observações", value: c.notes ?? "—" },
              ]}
            />
            <div>
              <h3 className="mb-2 text-sm font-semibold">Locadores</h3>
              <ul className="divide-y rounded-md border">
                {q.data?.landlords.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span>
                      {l.landlords?.name}{" "}
                      <span className="text-muted-foreground text-xs">{l.landlords?.document_masked}</span>
                    </span>
                    <span className="tabular">
                      {l.share_percent !== null ? `${String(l.share_percent).replace(".", ",")}%` : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {canManage && (
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => setDialog("details")}>
                  Editar dados
                </Button>
                <Button variant="outline" onClick={() => setDialog("value")}>
                  Solicitar alteração de valor
                </Button>
                <Button variant="outline" onClick={() => setDialog("term")}>
                  Solicitar alteração de vigência
                </Button>
              </div>
            )}
          </TabsContent>
          <TabsContent value="aditivos" className="space-y-4">
            {q.data?.amendments.length === 0 && (
              <EmptyState title="Nenhum aditivo aprovado" className="py-6" />
            )}
            <ul className="divide-y rounded-md border empty:hidden">
              {q.data?.amendments.map((a) => (
                <li key={a.id} className="px-4 py-3 text-sm">
                  <p className="font-medium">
                    Aditivo {a.amendment_number} ({AMENDMENT_KIND_LABEL[a.kind]}), assinado em{" "}
                    {formatCalendarDate(a.signed_on)}
                  </p>
                  <p className="text-muted-foreground mt-0.5">{a.description}</p>
                  <p className="tabular text-muted-foreground mt-1 text-xs">
                    {a.new_end_date && `Nova vigência até ${formatCalendarDate(a.new_end_date)}. `}
                    {a.new_monthly_value !== null &&
                      `Novo valor mensal ${formatCurrency(a.new_monthly_value)} a partir de ${formatCalendarDate(a.value_effective_from)}.`}
                  </p>
                </li>
              ))}
            </ul>
            {pendingAmendments.length > 0 && (
              <p className="text-muted-foreground text-sm">
                {pendingAmendments.length === 1
                  ? "1 aditivo aguardando aprovação"
                  : `${pendingAmendments.length} aditivos aguardando aprovação`}
                :{" "}
                {pendingAmendments.map((r, i) => (
                  <React.Fragment key={r.id}>
                    {i > 0 && ", "}
                    <Link href={`/aprovacoes/detalhe/?id=${r.id}`} className="text-primary underline">
                      ver solicitação
                    </Link>
                  </React.Fragment>
                ))}
              </p>
            )}
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => setDialog("amendment")}>
                <Plus aria-hidden="true" /> Solicitar aditivo
              </Button>
            )}
          </TabsContent>
          <TabsContent value="alugueis">
            <ContractRentsTab contractId={c.id!} />
          </TabsContent>
          <TabsContent value="documentos">
            {can("contracts.documents.view") ? (
              <DocumentsPanel entityType="contract" entityId={c.id!} canAttach={canManage} />
            ) : (
              <EmptyState
                title="Acesso restrito"
                description="Documentos contratuais exigem permissão específica."
                className="py-6"
              />
            )}
          </TabsContent>
          <TabsContent value="alertas">
            {q.data?.alerts.length === 0 && (
              <EmptyState
                icon={BellRing}
                title="Nenhum alerta gerado"
                description="Alertas de vencimento (90, 60 e 30 dias) e de data-base são gerados diariamente."
                className="py-6"
              />
            )}
            <ul className="divide-y rounded-md border empty:hidden">
              {q.data?.alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:justify-between"
                >
                  <span>{a.title}</span>
                  <span className="tabular text-muted-foreground text-xs">
                    {formatDateTime(a.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="historico">
            {history.data?.length === 0 && (
              <EmptyState title="Sem solicitações registradas" className="py-6" />
            )}
            <ul className="divide-y rounded-md border empty:hidden">
              {history.data?.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/aprovacoes/detalhe/?id=${r.id}`}
                    className="hover:bg-surface flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="text-sm font-medium">{r.approval_operations?.description}</span>
                    <span className="text-muted-foreground flex items-center gap-3 text-sm">
                      <span className="tabular">{formatDateTime(r.requested_at)}</span>
                      <ApprovalStatusBadge status={r.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </Panel>
      {dialog === "details" && (
        <ContractDetailsDialog contract={c} open onOpenChange={(v) => !v && setDialog(null)} />
      )}
      {dialog === "value" && (
        <ValueChangeDialog contract={c} open onOpenChange={(v) => !v && setDialog(null)} />
      )}
      {dialog === "term" && (
        <TermChangeDialog contract={c} open onOpenChange={(v) => !v && setDialog(null)} />
      )}
      {dialog === "amendment" && (
        <AmendmentDialog contract={c} open onOpenChange={(v) => !v && setDialog(null)} />
      )}
    </>
  );
}
