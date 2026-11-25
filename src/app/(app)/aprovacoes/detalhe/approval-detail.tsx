"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { ErrorState, FullPageLoading, InlineAlert } from "@/components/shared/states";
import { DetailList } from "@/components/shared/detail-list";
import { ApprovalStatusBadge } from "@/components/shared/status-badges";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useApprovalRequest, useCancelApproval, useDecideApproval } from "@/modules/approvals/api";
import { ProposalTable } from "@/modules/approvals/references";
import { DocumentsPanel } from "@/modules/documents/documents-panel";
import { useUserDirectory } from "@/modules/users/api";
import { useAuth } from "@/providers/auth-provider";
import { formatDateTime } from "@/lib/format";

const RESULT_LINK: Record<string, string> = {
  property: "/imoveis/detalhe/?id=",
  contract: "/contratos/detalhe/?id=",
};

function DecisionDialog({
  open,
  onOpenChange,
  decision,
  requestId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  decision: "approved" | "rejected";
  requestId: string;
}) {
  const decide = useDecideApproval();
  const [comment, setComment] = React.useState("");
  const [error, setError] = React.useState<string>();
  const reject = decision === "rejected";

  async function submit() {
    if (reject && comment.trim().length < 10) {
      setError("Informe o motivo da rejeição (mínimo de 10 caracteres).");
      return;
    }
    try {
      const r = await decide.mutateAsync({ id: requestId, decision, comment: comment.trim() });
      if (r.status === "failed")
        toast.error("A solicitação não pôde ser efetivada. Veja o motivo registrado.");
      else toast.success(reject ? "Solicitação rejeitada." : "Solicitação aprovada e efetivada.");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !decide.isPending && onOpenChange(v)}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{reject ? "Rejeitar solicitação" : "Aprovar solicitação"}</DialogTitle>
          <DialogDescription>
            {reject
              ? "Os dados originais são preservados. O solicitante será notificado com o motivo."
              : "A alteração será efetivada agora. Se o registro tiver mudado desde a solicitação, a efetivação é bloqueada."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <FormField
            id="decision-comment"
            label={reject ? "Motivo da rejeição" : "Comentário (opcional)"}
            required={reject}
            error={error}
          >
            <Textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
              autoFocus
            />
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={decide.isPending}>
            Cancelar
          </Button>
          <Button variant={reject ? "destructive" : "default"} onClick={submit} loading={decide.isPending}>
            {reject ? "Rejeitar" : "Aprovar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApprovalDetail() {
  const id = useSearchParams().get("id");
  const { access, can } = useAuth();
  const query = useApprovalRequest(id);
  const directory = useUserDirectory();
  const cancel = useCancelApproval();
  const [decision, setDecision] = React.useState<"approved" | "rejected" | null>(null);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  if (query.isLoading) return <FullPageLoading />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  const r = query.data?.request;
  if (!r)
    return (
      <ErrorState
        title="Solicitação não encontrada."
        message="Ela não existe ou você não tem acesso a ela."
      />
    );

  const isMine = r.requested_by === access?.profile?.id;
  const canDecide = r.status === "pending" && can("approvals.review") && !isMine;
  const name = (uid: string | null) => (uid ? (directory.data?.get(uid)?.full_name ?? "Usuário") : "—");
  const resultLink = r.result_entity_id && r.status === "approved" ? RESULT_LINK[r.entity_type] : undefined;

  return (
    <>
      <Button asChild variant="link" size="sm" className="mb-3">
        <Link href="/aprovacoes/">
          <ArrowLeft aria-hidden="true" /> Aprovações
        </Link>
      </Button>
      <PageHeader
        title={r.approval_operations?.description ?? "Solicitação"}
        description={`Solicitada por ${name(r.requested_by)} em ${formatDateTime(r.requested_at)}`}
        actions={<ApprovalStatusBadge status={r.status} />}
      />

      {r.status === "failed" && r.failure_reason && (
        <InlineAlert tone="danger" className="mb-4" title="Solicitação não efetivada">
          {r.failure_reason}
        </InlineAlert>
      )}
      {r.status === "pending" && isMine && (
        <InlineAlert tone="info" className="mb-4">
          Aguardando a decisão de um administrador. Você não pode decidir a própria solicitação, mas pode
          cancelá-la enquanto estiver pendente.
        </InlineAlert>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <Panel
            title={r.current_snapshot ? "Alteração proposta" : "Dados do novo registro"}
            description={r.current_snapshot ? "Campos alterados aparecem destacados." : undefined}
          >
            <ProposalTable
              snapshot={r.current_snapshot as Record<string, unknown> | null}
              proposed={r.proposed_data as Record<string, unknown>}
            />
          </Panel>
          <Panel title="Documentos da solicitação">
            <DocumentsPanel
              entityType="approval_request"
              entityId={r.id}
              canAttach={isMine && r.status === "pending"}
            />
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Justificativa">
            <p className="text-sm whitespace-pre-wrap">{r.justification}</p>
          </Panel>
          <Panel title="Decisão">
            <DetailList
              className="sm:grid-cols-1 xl:grid-cols-1"
              items={[
                { label: "Situação", value: <ApprovalStatusBadge status={r.status} /> },
                { label: "Decidida por", value: name(r.decided_by) },
                { label: "Data da decisão", value: formatDateTime(r.decided_at) },
                { label: "Comentário", value: r.decision_comment ?? "—" },
              ]}
            />
            {resultLink && (
              <Button asChild variant="outline" className="mt-4">
                <Link href={`${resultLink}${r.result_entity_id}`}>Abrir registro</Link>
              </Button>
            )}
            {(canDecide || (isMine && r.status === "pending")) && (
              <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
                {canDecide && (
                  <>
                    <Button onClick={() => setDecision("approved")}>
                      <Check aria-hidden="true" /> Aprovar
                    </Button>
                    <Button
                      variant="outline"
                      className="border-danger/40 text-danger hover:bg-danger-soft"
                      onClick={() => setDecision("rejected")}
                    >
                      <X aria-hidden="true" /> Rejeitar
                    </Button>
                  </>
                )}
                {isMine && r.status === "pending" && (
                  <Button variant="ghost" onClick={() => setCancelOpen(true)}>
                    Cancelar solicitação
                  </Button>
                )}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {decision && (
        <DecisionDialog
          open
          onOpenChange={(v) => !v && setDecision(null)}
          decision={decision}
          requestId={r.id}
        />
      )}
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancelar esta solicitação?"
        description="A solicitação deixa de aguardar decisão. Nada é alterado no registro."
        confirmLabel="Cancelar solicitação"
        tone="destructive"
        requireReason
        reasonLabel="Motivo do cancelamento"
        onConfirm={async (reason) => {
          try {
            await cancel.mutateAsync({ id: r.id, reason });
            toast.success("Solicitação cancelada.");
          } catch (e) {
            toast.error((e as Error).message);
            throw e;
          }
        }}
      />
    </>
  );
}
