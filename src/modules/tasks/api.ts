"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { toAppError } from "@/lib/errors";
import type { Database } from "@/types/database";
import type { ApprovalRequest } from "@/modules/approvals/api";

export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type TaskUrgency = Database["public"]["Enums"]["task_urgency"];
export type TaskPriority = Database["public"]["Enums"]["task_priority"];
export type TaskComplexity = Database["public"]["Enums"]["task_complexity"];
export type TaskEventKind = Database["public"]["Enums"]["task_event_kind"];
export type TaskOverview = Database["public"]["Views"]["tasks_overview"]["Row"];
export type TaskCategory = Database["public"]["Tables"]["task_categories"]["Row"];
export type TaskEvent = Database["public"]["Tables"]["task_events"]["Row"];

export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "waiting", "review", "done", "cancelled"];
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "A fazer",
  in_progress: "Em andamento",
  waiting: "Aguardando terceiros",
  review: "Em revisão",
  done: "Concluída",
  cancelled: "Cancelada",
};
export const URGENCY_LABEL: Record<TaskUrgency, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};
export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};
export const COMPLEXITY_LABEL: Record<TaskComplexity, string> = {
  simple: "Simples",
  medium: "Média",
  complex: "Complexa",
  very_complex: "Muito complexa",
};
export const EVENT_KIND_LABEL: Record<TaskEventKind, string> = {
  meeting: "Reunião",
  appointment: "Compromisso",
  deadline: "Prazo",
  reminder: "Lembrete",
};

const keys = {
  all: ["tasks"] as const,
  list: ["tasks", "list"] as const,
  one: (id: string) => ["tasks", "detail", id] as const,
  categories: ["tasks", "categories"] as const,
  calendar: (from: string, to: string) => ["tasks", "calendar", from, to] as const,
  event: (id: string) => ["tasks", "event", id] as const,
  stats: ["dashboard", "tasks"] as const,
};

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: keys.all }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
      qc.invalidateQueries({ queryKey: ["approvals"] }),
      qc.invalidateQueries({ queryKey: ["notifications"] }),
    ]);
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(fn as never, args as never);
  if (error) throw toAppError(error);
  return data as T;
}

export function useTaskCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: async () => {
      const { data, error } = await getSupabase().from("task_categories").select("*").order("name");
      if (error) throw toAppError(error);
      return data;
    },
  });
}

/** Demandas visíveis (RLS) com os participantes, para lista e kanban. */
export function useTasks() {
  return useQuery({
    queryKey: keys.list,
    queryFn: async () => {
      const s = getSupabase();
      const [tasks, assignees] = await Promise.all([
        s
          .from("tasks_overview")
          .select("*")
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(2000),
        s.from("task_assignees").select("task_id, user_id, role"),
      ]);
      if (tasks.error) throw toAppError(tasks.error);
      if (assignees.error) throw toAppError(assignees.error);
      const byTask = new Map<string, string[]>();
      for (const a of assignees.data) byTask.set(a.task_id, [...(byTask.get(a.task_id) ?? []), a.user_id]);
      return tasks.data.map((t) => ({ ...t, member_ids: byTask.get(t.id!) ?? [] }));
    },
  });
}
export type TaskListItem = NonNullable<ReturnType<typeof useTasks>["data"]>[number];

export function useTask(id: string | null) {
  return useQuery({
    queryKey: keys.one(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const s = getSupabase();
      const [t, assignees, comments, history, deletions, events] = await Promise.all([
        s.from("tasks_overview").select("*").eq("id", id!).maybeSingle(),
        s.from("task_assignees").select("user_id, role").eq("task_id", id!),
        s.from("task_comments").select("*").eq("task_id", id!).order("created_at"),
        s.from("task_status_history").select("*").eq("task_id", id!).order("changed_at"),
        s
          .from("task_deletion_requests")
          .select("*")
          .eq("task_id", id!)
          .order("requested_at", { ascending: false }),
        s.from("task_events").select("*").eq("task_id", id!).is("cancelled_at", null).order("starts_at"),
      ]);
      for (const r of [t, assignees, comments, history, deletions, events])
        if (r.error) throw toAppError(r.error);
      return {
        task: t.data,
        assignees: assignees.data ?? [],
        comments: comments.data ?? [],
        history: history.data ?? [],
        deletions: deletions.data ?? [],
        events: events.data ?? [],
      };
    },
  });
}

export interface TaskInput {
  title: string;
  description: string;
  department_id: string;
  category_id: string;
  responsible_id: string;
  participants: string[];
  requester_user_id: string;
  requester_name: string;
  start_date: string;
  due_date: string;
  due_time: string;
  urgency: TaskUrgency;
  priority: TaskPriority;
  complexity: TaskComplexity;
}

export function useSaveTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string | null; data: TaskInput; reason?: string }) =>
      rpc<string>("save_task", { p_task_id: v.id, p_data: v.data, p_reason: v.reason ?? "" }),
    onSuccess: invalidate,
  });
}

export function useSetTaskStatus() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; status: TaskStatus; note?: string }) =>
      rpc<void>("set_task_status", { p_task_id: v.id, p_status: v.status, p_note: v.note ?? "" }),
    // Kanban: move o cartão imediatamente e desfaz se o banco recusar.
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: keys.list });
      const prev = qc.getQueryData<TaskListItem[]>(keys.list);
      qc.setQueryData<TaskListItem[]>(keys.list, (old) =>
        old?.map((t) => (t.id === v.id ? { ...t, status: v.status } : t)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.list, ctx.prev);
    },
    onSettled: invalidate,
  });
}

export function useAddComment(taskId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: string) => rpc<string>("add_task_comment", { p_task_id: taskId, p_body: body }),
    onSuccess: invalidate,
  });
}

export function useRequestTaskDeletion() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; justification: string; exceptional: boolean }) =>
      rpc<ApprovalRequest>(v.exceptional ? "request_task_exceptional_deletion" : "request_task_deletion", {
        p_task_id: v.id,
        p_justification: v.justification,
      }),
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------- Calendário
export interface CalendarItem {
  item_type: "event" | "task";
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  event_kind: TaskEventKind | null;
  task_id: string | null;
  task_status: TaskStatus | null;
  is_overdue: boolean;
  responsible_name: string | null;
}

export function useCalendarItems(from: string, to: string) {
  return useQuery({
    queryKey: keys.calendar(from, to),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("calendar_items", { p_from: from, p_to: to });
      if (error) throw toAppError(error);
      return (data ?? []) as unknown as CalendarItem[];
    },
  });
}

export function useTaskEvent(id: string | null) {
  return useQuery({
    queryKey: keys.event(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const s = getSupabase();
      const [e, attendees] = await Promise.all([
        s.from("task_events").select("*").eq("id", id!).maybeSingle(),
        s.from("task_event_attendees").select("user_id").eq("event_id", id!),
      ]);
      if (e.error) throw toAppError(e.error);
      if (attendees.error) throw toAppError(attendees.error);
      return { event: e.data, attendees: (attendees.data ?? []).map((a) => a.user_id) };
    },
  });
}

export interface EventInput {
  kind: TaskEventKind;
  title: string;
  description: string;
  location: string;
  starts_at: string; // ISO
  ends_at: string | null;
  all_day: boolean;
  task_id: string | null;
  attendees: string[];
}

export function useSaveEvent() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string | null; data: EventInput }) =>
      rpc<string>("save_task_event", { p_event_id: v.id, p_data: v.data }),
    onSuccess: invalidate,
  });
}

export function useCancelEvent() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; reason: string }) =>
      rpc<void>("cancel_task_event", { p_event_id: v.id, p_reason: v.reason }),
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------- Painel
export interface TaskStats {
  open: number;
  in_progress: number;
  done: number;
  overdue: number;
  mine_open: number;
  by_status: Partial<Record<TaskStatus, number>>;
  upcoming: CalendarItem[];
  can_create: boolean;
}

export function useTaskStats() {
  return useQuery({
    queryKey: keys.stats,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("dashboard_task_stats");
      if (error) throw toAppError(error);
      return data as unknown as TaskStats;
    },
  });
}

// ---------------------------------------------------------------- Categorias
export function useAddCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { name: string; organizationId: string }) => {
      const { error } = await getSupabase()
        .from("task_categories")
        .insert({ name: v.name.trim(), organization_id: v.organizationId });
      if (error) {
        if (error.code === "23505") throw toAppError({ message: "Já existe uma categoria com este nome." });
        throw toAppError(error);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
  });
}

export function useToggleCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; active: boolean }) => {
      const { data, error } = await getSupabase()
        .from("task_categories")
        .update({ is_active: v.active })
        .eq("id", v.id)
        .select("id");
      if (error) throw toAppError(error);
      if (!data?.length) throw toAppError({ message: "Sem permissão para alterar categorias." });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
  });
}
