"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilePlus2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import { ApprovalStatusBadge } from "@/components/shared/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCreateDraft, useDiscardDraft, useDrafts } from "@/modules/registration/api";
import { useAuth } from "@/providers/auth-provider";
import { formatDateTime } from "@/lib/format";

const FLOW = ["Contrato", "Locador(es)", "Imóvel", "Unidades consumidoras (Energisa e Iguá)"];

function DraftsContent() {
  const router = useRouter();
  const { access } = useAuth();
  const drafts = useDrafts();
  const create = useCreateDraft();
  const discard = useDiscardDraft();

  async function start() {
    try {
      const id = await create.mutateAsync({
        organizationId: access!.profile!.organization_id,
        userId: access!.profile!.id,
      });
      router.push(`/cadastro-guiado/editar/?id=${id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Novo cadastro a partir de contrato"
        description="Acompanha o fluxo da SEMFAZ: o contrato chega, cadastra-se o locador, o imóvel e as unidades consumidoras. Tudo segue numa única solicitação de aprovação."
        actions={
          <Button onClick={start} loading={create.isPending}>
            <FilePlus2 aria-hidden="true" /> Iniciar novo cadastro
          </Button>
        }
      />
      <ol className="mb-6 grid gap-2 sm:grid-cols-4" aria-label="Ordem do cadastro">
        {FLOW.map((f, i) => (
          <li
            key={f}
            className="bg-surface-raised flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
              {i + 1}
            </span>
            {f}
          </li>
        ))}
      </ol>
      <Panel
        title="Meus cadastros"
        description="Rascunhos e cadastros enviados. Somente você vê os seus rascunhos."
        bodyClassName="p-0"
      >
        {drafts.isLoading && <LoadingRows />}
        {drafts.isError && <ErrorState message={drafts.error.message} onRetry={() => drafts.refetch()} />}
        {drafts.data && drafts.data.length === 0 && (
          <EmptyState
            icon={FilePlus2}
            title="Nenhum cadastro iniciado"
            description="Comece pelo contrato recebido. Você pode parar a qualquer momento e continuar depois."
          />
        )}
        {drafts.data && drafts.data.length > 0 && (
          <ul className="divide-y">
            {drafts.data.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/cadastro-guiado/editar/?id=${d.id}`}
                    className="font-semibold hover:underline"
                  >
                    {d.title ?? "Cadastro sem identificação"}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    Atualizado em {formatDateTime(d.updated_at)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {d.status === "draft" ? (
                    <Badge tone="neutral">Rascunho · etapa {d.current_step} de 5</Badge>
                  ) : (
                    <ApprovalStatusBadge status={(d.approval_requests?.status ?? "pending") as never} />
                  )}
                  {d.status === "draft" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        discard.mutate(d.id, {
                          onSuccess: () => toast.success("Rascunho descartado."),
                          onError: (e) => toast.error(e.message),
                        })
                      }
                      aria-label={`Descartar ${d.title ?? "rascunho"}`}
                    >
                      <Trash2 aria-hidden="true" /> Descartar
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

export default function RegistrationPage() {
  return (
    <RequirePermission permission="contracts.manage">
      <DraftsContent />
    </RequirePermission>
  );
}
