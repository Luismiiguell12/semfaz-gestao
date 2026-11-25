"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/form-field";
import { InlineAlert, LoadingRows } from "@/components/shared/states";
import { useUserDirectory } from "@/modules/users/api";
import { useAuth } from "@/providers/auth-provider";
import { EVENT_KIND_LABEL, useCancelEvent, useSaveEvent, useTaskEvent, type TaskEventKind } from "./api";
import { UserMultiSelect } from "./components";
import { fromMaceio, maceioParts, todayMaceio } from "./dates";

interface Form {
  kind: TaskEventKind;
  title: string;
  description: string;
  location: string;
  date: string;
  start: string;
  end: string;
  all_day: boolean;
  attendees: string[];
}

/**
 * Reunião, compromisso, prazo ou lembrete. Sem `eventId`: cadastro (opcionalmente
 * vinculado a uma demanda). Com `eventId`: visualização e, para quem pode, edição
 * e cancelamento.
 */
export function EventDialog({
  eventId,
  taskId,
  defaultDate,
  open,
  onOpenChange,
}: {
  eventId: string | null;
  taskId?: string | null;
  defaultDate?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { access } = useAuth();
  const q = useTaskEvent(eventId);
  const directory = useUserDirectory();
  const save = useSaveEvent();
  const cancel = useCancelEvent();
  const [form, setForm] = React.useState<Form | null>(
    eventId
      ? null
      : {
          kind: "meeting",
          title: "",
          description: "",
          location: "",
          date: defaultDate ?? todayMaceio(),
          start: "09:00",
          end: "10:00",
          all_day: false,
          attendees: [],
        },
  );
  const [editing, setEditing] = React.useState(!eventId);
  const [cancelReason, setCancelReason] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string>();

  const ev = q.data?.event;
  const canEdit = Boolean(ev && !ev.cancelled_at && ev.created_by === access?.profile?.id);

  function startEdit() {
    if (!ev) return;
    const s = maceioParts(ev.starts_at);
    const e = ev.ends_at ? maceioParts(ev.ends_at) : null;
    setForm({
      kind: ev.kind,
      title: ev.title,
      description: ev.description ?? "",
      location: ev.location ?? "",
      date: s.date,
      start: s.time,
      end: e?.time ?? "",
      all_day: ev.all_day,
      attendees: q.data?.attendees ?? [],
    });
    setEditing(true);
  }

  async function submit() {
    if (!form) return;
    setError(undefined);
    if (form.title.trim().length < 3) return setError("Informe o título (mínimo de 3 caracteres).");
    if (!form.date) return setError("Informe a data.");
    if (!form.all_day && !form.start) return setError("Informe o horário de início.");
    if (!form.all_day && form.end && form.end < form.start)
      return setError("O término deve ser posterior ao início.");
    try {
      await save.mutateAsync({
        id: eventId,
        data: {
          kind: form.kind,
          title: form.title.trim(),
          description: form.description,
          location: form.location,
          starts_at: fromMaceio(form.date, form.all_day ? "00:00" : form.start),
          ends_at: form.all_day ? null : form.end ? fromMaceio(form.date, form.end) : null,
          all_day: form.all_day,
          task_id: eventId ? (ev?.task_id ?? null) : (taskId ?? null),
          attendees: form.attendees,
        },
      });
      toast.success(eventId ? "Evento atualizado." : "Evento cadastrado.");
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function doCancel() {
    if (!eventId || cancelReason === null) return;
    if (cancelReason.trim().length < 10)
      return setError("Informe o motivo do cancelamento (mínimo de 10 caracteres).");
    try {
      await cancel.mutateAsync({ id: eventId, reason: cancelReason.trim() });
      toast.success("Evento cancelado.");
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const title = !eventId ? "Novo evento" : editing ? "Editar evento" : (ev?.title ?? "Evento");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Reuniões, compromissos, prazos e lembretes. Horários de Maceió.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {error && <InlineAlert tone="danger">{error}</InlineAlert>}
          {eventId && q.isLoading && <LoadingRows rows={2} />}
          {eventId && !editing && ev && (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-xs">Tipo</dt>
                <dd>{EVENT_KIND_LABEL[ev.kind]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Quando</dt>
                <dd>
                  {(() => {
                    const s = maceioParts(ev.starts_at);
                    const [y, m, d] = s.date.split("-");
                    return `${d}/${m}/${y}${ev.all_day ? " (dia todo)" : ` às ${s.time}${ev.ends_at ? ` até ${maceioParts(ev.ends_at).time}` : ""}`}`;
                  })()}
                </dd>
              </div>
              {ev.location && (
                <div>
                  <dt className="text-muted-foreground text-xs">Local</dt>
                  <dd>{ev.location}</dd>
                </div>
              )}
              {ev.task_id && (
                <div>
                  <dt className="text-muted-foreground text-xs">Demanda</dt>
                  <dd>
                    <Link
                      href={`/demandas/detalhe/?id=${ev.task_id}`}
                      className="text-primary hover:underline"
                    >
                      Abrir a demanda
                    </Link>
                  </dd>
                </div>
              )}
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground text-xs">Participantes</dt>
                <dd>
                  {(q.data?.attendees ?? [])
                    .map((u) => directory.data?.get(u)?.full_name ?? "—")
                    .join(", ") || "—"}
                </dd>
              </div>
              {ev.description && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground text-xs">Descrição</dt>
                  <dd className="whitespace-pre-wrap">{ev.description}</dd>
                </div>
              )}
              {ev.cancelled_at && (
                <InlineAlert tone="warning" className="sm:col-span-2" title="Evento cancelado">
                  {ev.cancellation_reason}
                </InlineAlert>
              )}
              {cancelReason !== null && (
                <FormField id="ev-cancel" label="Motivo do cancelamento" required className="sm:col-span-2">
                  <Textarea rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                </FormField>
              )}
            </dl>
          )}
          {editing && form && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="ev-kind" label="Tipo" required>
                <NativeSelect
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value as TaskEventKind })}
                >
                  {(Object.keys(EVENT_KIND_LABEL) as TaskEventKind[]).map((k) => (
                    <option key={k} value={k}>
                      {EVENT_KIND_LABEL[k]}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="ev-title" label="Título" required>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  maxLength={200}
                />
              </FormField>
              <FormField id="ev-date" label="Data" required>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </FormField>
              <label className="flex h-10 cursor-pointer items-center gap-2 self-end text-sm">
                <Checkbox
                  checked={form.all_day}
                  onCheckedChange={(v) => setForm({ ...form, all_day: v === true })}
                />{" "}
                Dia todo
              </label>
              {!form.all_day && (
                <>
                  <FormField id="ev-start" label="Início" required>
                    <Input
                      type="time"
                      value={form.start}
                      onChange={(e) => setForm({ ...form, start: e.target.value })}
                    />
                  </FormField>
                  <FormField id="ev-end" label="Término">
                    <Input
                      type="time"
                      value={form.end}
                      onChange={(e) => setForm({ ...form, end: e.target.value })}
                    />
                  </FormField>
                </>
              )}
              <FormField id="ev-loc" label="Local" className="sm:col-span-2">
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  maxLength={200}
                />
              </FormField>
              <FormField id="ev-desc" label="Descrição" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </FormField>
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-sm font-medium">Participantes</p>
                <UserMultiSelect
                  id="ev-att"
                  value={form.attendees}
                  onChange={(a) => setForm({ ...form, attendees: a })}
                  exclude={access?.profile?.id ? [access.profile.id] : []}
                />
              </div>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {editing ? (
            <Button onClick={submit} loading={save.isPending}>
              {eventId ? "Salvar alterações" : "Cadastrar evento"}
            </Button>
          ) : (
            canEdit && (
              <>
                {cancelReason === null ? (
                  <Button variant="outline" onClick={() => setCancelReason("")}>
                    Cancelar evento
                  </Button>
                ) : (
                  <Button variant="destructive" onClick={doCancel} loading={cancel.isPending}>
                    Confirmar cancelamento
                  </Button>
                )}
                <Button onClick={startEdit}>Editar</Button>
              </>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
