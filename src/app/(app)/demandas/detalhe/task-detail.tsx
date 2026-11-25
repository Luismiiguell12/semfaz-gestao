"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarPlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { EmptyState, ErrorState, FullPageLoading, InlineAlert } from "@/components/shared/states";
import { DetailList } from "@/components/shared/detail-list";
import { FormField } from "@/components/shared/form-field";
import { ApprovalStatusBadge } from "@/components/shared/status-badges";
import { Badge } from "@/components/ui/badge";
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
import { NativeSelect } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DocumentsPanel } from "@/modules/documents/documents-panel";
import { useUserDirectory } from "@/modules/users/api";
import { useAuth } from "@/providers/auth-provider";
import {
  COMPLEXITY_LABEL,
  EVENT_KIND_LABEL,
  PRIORITY_LABEL,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  URGENCY_LABEL,
  useAddComment,
  useRequestTaskDeletion,
  useSetTaskStatus,
  useTask,
  type TaskStatus,
} from "@/modules/tasks/api";
import { OverdueBadge, TaskDialog, TaskStatusBadge, formatDue } from "@/modules/tasks/components";
import { EventDialog } from "@/modules/tasks/event-dialog";
import { maceioParts } from "@/modules/tasks/dates";
import { formatCalendarDate, formatDateTime } from "@/lib/format";
import { CancelTaskDialog } from "../cancel-dialog";

function DeletionDialog({
  taskId,
  exceptional,
  open,
  onOpenChange,
}: {
  taskId: string;
  exceptional: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const request = useRequestTaskDeletion();
  const [just, setJust] = React.useState("");
  const [error, setError] = React.useState<string>();
  async function submit() {
    setError(undefined);
    if (just.trim().length < 10) return setError("Informe a justificativa (mínimo de 10 caracteres).");
    try {
      await request.mutateAsync({ id: taskId, justification: just.trim(), exceptional });
      toast.success("Solicitação de exclusão enviada para aprovação.");
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{exceptional ? "Exclusão excepcional" : "Solicitar exclusão"}</DialogTitle>
          <DialogDescription>
            A exclusão depende da decisão de um administrador diferente do solicitante. É sempre lógica: a
            demanda deixa de aparecer nas listas, mas permanece no banco e na auditoria.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {error && <InlineAlert tone="danger">{error}</InlineAlert>}
          <FormField id="del-just" label="Justificativa" required>
            <Textarea rows={3} value={just} onChange={(e) => setJust(e.target.value)} />
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button variant="destructive" onClick={submit} loading={request.isPending}>
            Enviar para aprovação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TaskDetail() {
  const id = useSearchParams().get("id");
  const q = useTask(id);
  const { can, access } = useAuth();
  const directory = useUserDirectory();
  const setStatus = useSetTaskStatus();
  const comment = useAddComment(id ?? "");
  const [dialog, setDialog] = React.useState<"edit" | "delete" | "exceptional" | "cancel" | "event" | null>(
    null,
  );
  const [eventId, setEventId] = React.useState<string | null>(null);
  const [nextStatus, setNextStatus] = React.useState<TaskStatus | "">("");
  const [note, setNote] = React.useState("");
  const [body, setBody] = React.useState("");

  if (q.isLoading) return <FullPageLoading />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const t = q.data?.task;
  if (!t)
    return (
      <ErrorState
        title="Demanda não encontrada."
        message="Ela não existe, foi excluída ou você não participa dela."
      />
    );

  const me = access?.profile?.id;
  const name = (uid: string | null) => (uid ? (directory.data?.get(uid)?.full_name ?? "—") : "—");
  const members = q.data!.assignees;
  const isMember = t.created_by === me || members.some((a) => a.user_id === me);
  const canEdit = t.created_by === me || t.responsible_id === me || can("tasks.view_all");
  const canWork = canEdit || isMember;
  const closed = t.status === "done" || t.status === "cancelled";
  const pendingDeletion = q.data!.deletions.find((d) => d.status === "pending");
  const statusOptions = TASK_STATUSES.filter(
    (s) =>
      s !== t.status &&
      (s !== "done" || can("tasks.complete")) &&
      (canEdit || (!closed && s !== "cancelled")),
  );

  function applyStatus() {
    if (!nextStatus) return;
    if (nextStatus === "cancelled") {
      setDialog("cancel");
      return;
    }
    setStatus.mutate(
      { id: t!.id!, status: nextStatus, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(`Situação alterada para ${TASK_STATUS_LABEL[nextStatus]}.`);
          setNextStatus("");
          setNote("");
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  async function sendComment() {
    if (!body.trim()) return;
    try {
      await comment.mutateAsync(body.trim());
      setBody("");
      toast.success("Comentário registrado.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <Button asChild variant="link" size="sm" className="mb-3">
        <Link href="/demandas/">
          <ArrowLeft aria-hidden="true" /> Demandas
        </Link>
      </Button>
      <PageHeader
        title={t.title ?? "Demanda"}
        description={`${t.category_name} · ${t.department_name ?? ""} · criada por ${name(t.created_by)} em ${formatDateTime(t.created_at)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {t.is_overdue && <OverdueBadge />}
            <TaskStatusBadge status={t.status} />
          </div>
        }
      />
      {pendingDeletion && (
        <InlineAlert tone="warning" className="mb-4" title="Exclusão solicitada">
          Aguardando decisão de um administrador.{" "}
          <Link href={`/aprovacoes/detalhe/?id=${pendingDeletion.id}`} className="font-semibold underline">
            Abrir a solicitação
          </Link>
        </InlineAlert>
      )}

      {canWork && (
        <Panel className="mb-6" title="Situação">
          <div className="flex flex-wrap items-end gap-3">
            <FormField id="st-next" label="Mover para">
              <NativeSelect
                className="w-52"
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as TaskStatus)}
              >
                <option value="">Selecione</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABEL[s]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            {nextStatus && nextStatus !== "cancelled" && (
              <FormField
                id="st-note"
                label={nextStatus === "done" ? "Registro de conclusão" : "Observação"}
                className="min-w-60 flex-1"
              >
                <textarea
                  rows={1}
                  className="border-input bg-background min-h-10 w-full rounded-md border px-3 py-2 text-sm"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </FormField>
            )}
            <Button onClick={applyStatus} disabled={!nextStatus} loading={setStatus.isPending}>
              Aplicar
            </Button>
          </div>
          {t.status === "done" && (
            <p className="text-muted-foreground mt-3 text-sm">
              Concluída por {name(t.completed_by)} em {formatDateTime(t.completed_at)}
              {t.completion_note ? `: ${t.completion_note}` : "."}
            </p>
          )}
        </Panel>
      )}

      <Panel bodyClassName="pt-1">
        <Tabs defaultValue="dados">
          <TabsList>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="comentarios">Comentários ({q.data!.comments.length})</TabsTrigger>
            <TabsTrigger value="anexos">Anexos</TabsTrigger>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="dados" className="space-y-6">
            <DetailList
              items={[
                { label: "Responsável principal", value: name(t.responsible_id) },
                {
                  label: "Participantes",
                  value:
                    members
                      .filter((a) => a.role === "participant")
                      .map((a) => name(a.user_id))
                      .join(", ") || "—",
                },
                {
                  label: "Solicitante",
                  value:
                    [t.requester_user_id ? name(t.requester_user_id) : null, t.requester_name]
                      .filter(Boolean)
                      .join(" · ") || "—",
                },
                { label: "Início", value: t.start_date ? formatCalendarDate(t.start_date) : "—" },
                { label: "Prazo", value: formatDue(t.due_date, t.due_time) },
                { label: "Urgência", value: t.urgency ? URGENCY_LABEL[t.urgency] : "—" },
                { label: "Prioridade", value: t.priority ? PRIORITY_LABEL[t.priority] : "—" },
                { label: "Complexidade", value: t.complexity ? COMPLEXITY_LABEL[t.complexity] : "—" },
                { label: "Secretaria", value: t.department_name ?? "—" },
              ]}
            />
            {t.description && (
              <div>
                <h3 className="mb-1 text-sm font-semibold">Descrição</h3>
                <p className="text-sm whitespace-pre-wrap">{t.description}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {canEdit && (
                <Button variant="outline" onClick={() => setDialog("edit")}>
                  <Pencil aria-hidden="true" /> Editar
                </Button>
              )}
              {t.created_by === me && can("tasks.delete_own") && !pendingDeletion && (
                <Button variant="outline" onClick={() => setDialog("delete")}>
                  <Trash2 aria-hidden="true" /> Solicitar exclusão
                </Button>
              )}
              {can("tasks.delete_any") && t.created_by !== me && !pendingDeletion && (
                <Button variant="outline" onClick={() => setDialog("exceptional")}>
                  <Trash2 aria-hidden="true" /> Exclusão excepcional
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="comentarios" className="space-y-4">
            {q.data!.comments.length === 0 ? (
              <EmptyState title="Nenhum comentário" className="py-6" />
            ) : (
              <ol className="space-y-3">
                {q.data!.comments.map((c) => (
                  <li key={c.id} className="bg-surface rounded-md border px-4 py-3">
                    <p className="text-muted-foreground text-xs">
                      <strong className="text-foreground">{name(c.author_id)}</strong> ·{" "}
                      {formatDateTime(c.created_at)}
                    </p>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
                  </li>
                ))}
              </ol>
            )}
            <FormField
              id="cm-body"
              label="Novo comentário"
              hint="Comentários não podem ser editados nem apagados depois de enviados."
            >
              <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} />
            </FormField>
            <Button onClick={sendComment} disabled={!body.trim()} loading={comment.isPending}>
              Comentar
            </Button>
          </TabsContent>

          <TabsContent value="anexos">
            <DocumentsPanel entityType="task" entityId={t.id!} canAttach={canWork} />
          </TabsContent>

          <TabsContent value="agenda" className="space-y-4">
            {q.data!.events.length === 0 ? (
              <EmptyState title="Nenhum evento vinculado" className="py-6" />
            ) : (
              <ul className="divide-y rounded-md border">
                {q.data!.events.map((e) => {
                  const s = maceioParts(e.starts_at);
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setEventId(e.id);
                          setDialog("event");
                        }}
                        className="hover:bg-surface flex w-full flex-col gap-1 px-4 py-3 text-left text-sm sm:flex-row sm:justify-between"
                      >
                        <span className="font-medium">
                          {EVENT_KIND_LABEL[e.kind]}: {e.title}
                        </span>
                        <span className="tabular text-muted-foreground">
                          {formatCalendarDate(s.date)}
                          {e.all_day ? "" : ` às ${s.time}`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {canWork && (
              <Button
                variant="outline"
                onClick={() => {
                  setEventId(null);
                  setDialog("event");
                }}
              >
                <CalendarPlus aria-hidden="true" /> Novo evento desta demanda
              </Button>
            )}
          </TabsContent>

          <TabsContent value="historico" className="space-y-6">
            <ol className="space-y-2">
              {q.data!.history.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-col gap-0.5 rounded-md border px-4 py-2.5 text-sm sm:flex-row sm:justify-between"
                >
                  <span>
                    {h.from_status ? `${TASK_STATUS_LABEL[h.from_status]} → ` : "Criada como "}
                    <strong>{TASK_STATUS_LABEL[h.to_status]}</strong>
                    {h.note ? <span className="text-muted-foreground"> · {h.note}</span> : null}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {name(h.changed_by)} · {formatDateTime(h.changed_at)}
                  </span>
                </li>
              ))}
            </ol>
            {q.data!.deletions.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Solicitações de exclusão</h3>
                <ul className="divide-y rounded-md border">
                  {q.data!.deletions.map((d) => (
                    <li
                      key={d.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                    >
                      <Link href={`/aprovacoes/detalhe/?id=${d.id}`} className="hover:underline">
                        {d.is_exceptional ? "Exclusão excepcional" : "Exclusão"} solicitada por{" "}
                        {name(d.requested_by)} em {formatDateTime(d.requested_at)}
                      </Link>
                      {d.status && <ApprovalStatusBadge status={d.status} />}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              Alterações de dados, participantes e anexos também ficam registradas na auditoria.
            </p>
          </TabsContent>
        </Tabs>
      </Panel>

      {dialog === "edit" && (
        <TaskDialog
          task={t}
          participants={members.filter((a) => a.role === "participant").map((a) => a.user_id)}
          open
          onOpenChange={(v) => !v && setDialog(null)}
        />
      )}
      {(dialog === "delete" || dialog === "exceptional") && (
        <DeletionDialog
          taskId={t.id!}
          exceptional={dialog === "exceptional"}
          open
          onOpenChange={(v) => !v && setDialog(null)}
        />
      )}
      {dialog === "cancel" && (
        <CancelTaskDialog
          taskId={t.id!}
          title={t.title ?? ""}
          open
          onOpenChange={(v) => !v && setDialog(null)}
        />
      )}
      {dialog === "event" && (
        <EventDialog
          eventId={eventId}
          taskId={t.id}
          defaultDate={t.due_date ?? undefined}
          open
          onOpenChange={(v) => !v && setDialog(null)}
        />
      )}
      {!canWork && (
        <p className="mt-4">
          <Badge tone="neutral">Somente leitura</Badge>
        </p>
      )}
    </>
  );
}
