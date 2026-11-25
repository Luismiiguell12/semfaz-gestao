"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/shared/form-field";
import { InlineAlert } from "@/components/shared/states";
import { DepartmentSelect, UserSelect, useActiveColleagues } from "@/components/shared/pickers";
import { useAuth } from "@/providers/auth-provider";
import {
  COMPLEXITY_LABEL,
  PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  URGENCY_LABEL,
  useSaveTask,
  useTaskCategories,
  type TaskComplexity,
  type TaskInput,
  type TaskOverview,
  type TaskPriority,
  type TaskStatus,
  type TaskUrgency,
} from "./api";

export function TaskStatusBadge({ status }: { status: TaskStatus | null }) {
  const s = status ?? "todo";
  const tone = {
    todo: "neutral",
    in_progress: "info",
    waiting: "warning",
    review: "brand",
    done: "success",
    cancelled: "neutral",
  } as const;
  return <Badge tone={tone[s]}>{TASK_STATUS_LABEL[s]}</Badge>;
}

export function OverdueBadge() {
  return (
    <Badge tone="danger">
      <AlertTriangle className="size-3" aria-hidden="true" /> Atrasada
    </Badge>
  );
}

const LEVEL_TONE = {
  low: "neutral",
  medium: "neutral",
  normal: "neutral",
  high: "warning",
  critical: "danger",
  urgent: "danger",
} as const;

export function UrgencyBadge({ value }: { value: TaskUrgency | null }) {
  if (!value) return null;
  return <Badge tone={LEVEL_TONE[value]}>Urgência {URGENCY_LABEL[value].toLowerCase()}</Badge>;
}
export function PriorityBadge({ value }: { value: TaskPriority | null }) {
  if (!value) return null;
  return <Badge tone={LEVEL_TONE[value]}>Prioridade {PRIORITY_LABEL[value].toLowerCase()}</Badge>;
}

/** Seleção de várias pessoas com busca (participantes de demandas e eventos). */
export function UserMultiSelect({
  id,
  value,
  onChange,
  exclude = [],
}: {
  id: string;
  value: string[];
  onChange: (v: string[]) => void;
  exclude?: string[];
}) {
  const users = useActiveColleagues();
  const [term, setTerm] = React.useState("");
  const list = (users.data ?? []).filter(
    (u) =>
      !exclude.includes(u.id!) &&
      (!term.trim() ||
        (u.full_name ?? "").toLocaleLowerCase("pt-BR").includes(term.trim().toLocaleLowerCase("pt-BR"))),
  );
  return (
    <div className="rounded-md border">
      <div className="border-b p-2">
        <Input
          id={id}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar pessoa"
          aria-label="Buscar participante"
          autoComplete="off"
        />
      </div>
      <ul className="max-h-44 overflow-y-auto p-1" aria-label="Pessoas">
        {list.map((u) => {
          const checked = value.includes(u.id!);
          return (
            <li key={u.id}>
              <label className="hover:bg-surface flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm">
                <Checkbox
                  checked={checked}
                  onCheckedChange={() =>
                    onChange(checked ? value.filter((x) => x !== u.id) : [...value, u.id!])
                  }
                />
                <span>
                  {u.full_name}
                  {u.job_title ? <span className="text-muted-foreground"> ({u.job_title})</span> : null}
                </span>
              </label>
            </li>
          );
        })}
        {list.length === 0 && (
          <li className="text-muted-foreground px-2 py-2 text-sm">Ninguém encontrado.</li>
        )}
      </ul>
      {value.length > 0 && (
        <p className="text-muted-foreground border-t px-3 py-1.5 text-xs">{value.length} selecionado(s)</p>
      )}
    </div>
  );
}

const EMPTY: TaskInput = {
  title: "",
  description: "",
  department_id: "",
  category_id: "",
  responsible_id: "",
  participants: [],
  requester_user_id: "",
  requester_name: "",
  start_date: "",
  due_date: "",
  due_time: "",
  urgency: "medium",
  priority: "normal",
  complexity: "medium",
};

/** Cadastro e edição de demanda. */
export function TaskDialog({
  task,
  participants,
  open,
  onOpenChange,
  onSaved,
}: {
  task: TaskOverview | null;
  participants?: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: (id: string) => void;
}) {
  const { access } = useAuth();
  const categories = useTaskCategories();
  const save = useSaveTask();
  const [v, setV] = React.useState<TaskInput>(() =>
    task
      ? {
          title: task.title ?? "",
          description: task.description ?? "",
          department_id: task.department_id ?? "",
          category_id: task.category_id ?? "",
          responsible_id: task.responsible_id ?? "",
          participants: participants ?? [],
          requester_user_id: task.requester_user_id ?? "",
          requester_name: task.requester_name ?? "",
          start_date: task.start_date ?? "",
          due_date: task.due_date ?? "",
          due_time: task.due_time?.slice(0, 5) ?? "",
          urgency: task.urgency ?? "medium",
          priority: task.priority ?? "normal",
          complexity: task.complexity ?? "medium",
        }
      : {
          ...EMPTY,
          department_id: access?.profile?.department_id ?? "",
          responsible_id: access?.profile?.id ?? "",
        },
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string>();
  const set =
    <K extends keyof TaskInput>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setV({ ...v, [k]: e.target.value as TaskInput[K] });

  async function submit() {
    setError(undefined);
    const errs: Record<string, string> = {};
    if (v.title.trim().length < 3) errs.title = "Informe o título (mínimo de 3 caracteres).";
    if (!v.department_id) errs.department_id = "Selecione a secretaria.";
    if (!v.category_id) errs.category_id = "Selecione a categoria.";
    if (!v.responsible_id) errs.responsible_id = "Selecione o responsável principal.";
    if (v.start_date && v.due_date && v.due_date < v.start_date)
      errs.due_date = "O prazo não pode ser anterior ao início.";
    if (v.due_time && !v.due_date) errs.due_time = "Informe o prazo (data) para usar o horário.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const id = await save.mutateAsync({
        id: task?.id ?? null,
        data: { ...v, participants: v.participants.filter((p) => p !== v.responsible_id) },
      });
      toast.success(task ? "Demanda atualizada." : "Demanda criada.");
      onOpenChange(false);
      onSaved?.(id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form
          noValidate
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{task ? "Editar demanda" : "Nova demanda"}</DialogTitle>
            <DialogDescription>
              O criador é registrado automaticamente. Toda alteração fica na auditoria.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            {error && (
              <InlineAlert tone="danger" className="sm:col-span-2">
                {error}
              </InlineAlert>
            )}
            <FormField id="t-title" label="Título" required error={errors.title} className="sm:col-span-2">
              <Input value={v.title} onChange={set("title")} maxLength={200} />
            </FormField>
            <FormField id="t-desc" label="Descrição" className="sm:col-span-2">
              <Textarea rows={3} value={v.description} onChange={set("description")} maxLength={10000} />
            </FormField>
            <FormField
              id="t-dept"
              label="Secretaria"
              required
              error={errors.department_id}
              hint="Define quem acompanha a demanda."
            >
              <DepartmentSelect value={v.department_id} onChange={set("department_id")} />
            </FormField>
            <FormField id="t-cat" label="Categoria" required error={errors.category_id}>
              <NativeSelect value={v.category_id} onChange={set("category_id")}>
                <option value="">Selecione</option>
                {categories.data
                  ?.filter((c) => c.is_active || c.id === v.category_id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </NativeSelect>
            </FormField>
            <FormField id="t-resp" label="Responsável principal" required error={errors.responsible_id}>
              <UserSelect emptyLabel="Selecione" value={v.responsible_id} onChange={set("responsible_id")} />
            </FormField>
            <FormField
              id="t-req"
              label="Solicitante"
              hint="Pessoa do sistema ou, abaixo, o nome de quem pediu."
            >
              <UserSelect
                emptyLabel="Não informado"
                value={v.requester_user_id}
                onChange={set("requester_user_id")}
              />
            </FormField>
            <FormField id="t-req-name" label="Solicitante externo (nome)" className="sm:col-span-2">
              <Input
                value={v.requester_name}
                onChange={set("requester_name")}
                placeholder="Ex.: Secretaria de Saúde"
                maxLength={200}
              />
            </FormField>
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-sm font-medium">Participantes</p>
              <UserMultiSelect
                id="t-part"
                value={v.participants}
                onChange={(p) => setV({ ...v, participants: p })}
                exclude={v.responsible_id ? [v.responsible_id] : []}
              />
            </div>
            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
              <FormField id="t-start" label="Início">
                <Input type="date" value={v.start_date} onChange={set("start_date")} />
              </FormField>
              <FormField id="t-due" label="Prazo" error={errors.due_date}>
                <Input type="date" value={v.due_date} onChange={set("due_date")} />
              </FormField>
              <FormField id="t-time" label="Horário" error={errors.due_time}>
                <Input type="time" value={v.due_time} onChange={set("due_time")} />
              </FormField>
            </div>
            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
              <FormField id="t-urg" label="Urgência" required>
                <NativeSelect value={v.urgency} onChange={set("urgency")}>
                  {(Object.keys(URGENCY_LABEL) as TaskUrgency[]).map((k) => (
                    <option key={k} value={k}>
                      {URGENCY_LABEL[k]}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="t-pri" label="Prioridade" required>
                <NativeSelect value={v.priority} onChange={set("priority")}>
                  {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((k) => (
                    <option key={k} value={k}>
                      {PRIORITY_LABEL[k]}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="t-cpx" label="Complexidade" required>
                <NativeSelect value={v.complexity} onChange={set("complexity")}>
                  {(Object.keys(COMPLEXITY_LABEL) as TaskComplexity[]).map((k) => (
                    <option key={k} value={k}>
                      {COMPLEXITY_LABEL[k]}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              {task ? "Salvar alterações" : "Criar demanda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Data de prazo com horário, no formato brasileiro. */
export function formatDue(date: string | null, time: string | null): string {
  if (!date) return "Sem prazo";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}${time ? ` às ${time.slice(0, 5)}` : ""}`;
}
