"use client";

import * as React from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { CalendarClock, GripVertical, MessageSquare } from "lucide-react";
import { NativeSelect } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  useSetTaskStatus,
  type TaskListItem,
  type TaskStatus,
} from "@/modules/tasks/api";
import { OverdueBadge, PriorityBadge, formatDue } from "@/modules/tasks/components";
import { CancelTaskDialog } from "./cancel-dialog";

function Card({ task, onMove }: { task: TaskListItem; onMove: (s: TaskStatus) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id! });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-surface-raised rounded-md border p-3 text-sm shadow-xs",
        isDragging && "ring-primary relative z-10 opacity-90 ring-2",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground -ml-1 cursor-grab touch-none rounded p-0.5 focus-visible:outline-2"
          aria-label={`Arrastar "${task.title}". Use espaço para pegar, setas para mover e espaço para soltar.`}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <Link
            href={`/demandas/detalhe/?id=${task.id}`}
            className="font-semibold break-words hover:underline"
          >
            {task.title}
          </Link>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {task.category_name} · {task.responsible_name ?? "—"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {task.is_overdue && <OverdueBadge />}
            {(task.priority === "high" || task.priority === "urgent") && (
              <PriorityBadge value={task.priority} />
            )}
          </div>
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" aria-hidden="true" />{" "}
              {formatDue(task.due_date, task.due_time)}
            </span>
            {Boolean(task.comments_count) && (
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="size-3.5" aria-hidden="true" /> {task.comments_count}
              </span>
            )}
          </div>
          {/* Alternativa ao arrastar (celular e leitores de tela). */}
          <label className="sr-only" htmlFor={`mv-${task.id}`}>
            Mover {task.title} para
          </label>
          <NativeSelect
            id={`mv-${task.id}`}
            className="mt-2 h-8 text-xs"
            value={task.status ?? "todo"}
            onChange={(e) => onMove(e.target.value as TaskStatus)}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABEL[s]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
    </li>
  );
}

function Column({
  status,
  tasks,
  onMove,
}: {
  status: TaskStatus;
  tasks: TaskListItem[];
  onMove: (t: TaskListItem, s: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${TASK_STATUS_LABEL[status]}: ${tasks.length} demanda(s)`}
      className={cn(
        "bg-surface flex w-72 shrink-0 flex-col rounded-lg border",
        isOver && "border-primary bg-primary-soft",
      )}
    >
      <header className="flex items-center justify-between border-b px-3 py-2">
        <h2 className="text-sm font-semibold">{TASK_STATUS_LABEL[status]}</h2>
        <span className="tabular text-muted-foreground text-xs">{tasks.length}</span>
      </header>
      <ul className="flex min-h-24 flex-col gap-2 p-2">
        {tasks.map((t) => (
          <Card key={t.id} task={t} onMove={(s) => onMove(t, s)} />
        ))}
        {tasks.length === 0 && (
          <li className="text-muted-foreground px-2 py-4 text-center text-xs">Nenhuma demanda</li>
        )}
      </ul>
    </section>
  );
}

export function Kanban({ tasks }: { tasks: TaskListItem[] }) {
  const { can } = useAuth();
  const setStatus = useSetTaskStatus();
  const [cancelling, setCancelling] = React.useState<TaskListItem | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function move(task: TaskListItem, status: TaskStatus) {
    if (task.status === status) return;
    if (status === "done" && !can("tasks.complete")) {
      toast.error("Você não tem permissão para concluir demandas.");
      return;
    }
    if (status === "cancelled") {
      setCancelling(task);
      return;
    }
    setStatus.mutate(
      { id: task.id!, status },
      {
        onSuccess: () => toast.success(`"${task.title}" movida para ${TASK_STATUS_LABEL[status]}.`),
        onError: (e) => toast.error(e.message),
      },
    );
  }

  function onDragEnd(e: DragEndEvent) {
    const task = tasks.find((t) => t.id === e.active.id);
    if (!task || !e.over) return;
    move(task, e.over.id as TaskStatus);
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) =>
              `Demanda selecionada: ${tasks.find((t) => t.id === active.id)?.title ?? ""}.`,
            onDragOver: ({ over }) =>
              over ? `Sobre a coluna ${TASK_STATUS_LABEL[over.id as TaskStatus]}.` : "Fora das colunas.",
            onDragEnd: ({ over }) =>
              over ? `Solta em ${TASK_STATUS_LABEL[over.id as TaskStatus]}.` : "Movimento cancelado.",
            onDragCancel: () => "Movimento cancelado.",
          },
        }}
      >
        <div
          className="relative -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
          role="region"
          aria-label="Quadro de demandas"
        >
          <div className="flex items-start gap-3">
            {TASK_STATUSES.map((s) => (
              <Column key={s} status={s} tasks={tasks.filter((t) => t.status === s)} onMove={move} />
            ))}
          </div>
        </div>
      </DndContext>
      {cancelling && (
        <CancelTaskDialog
          taskId={cancelling.id!}
          title={cancelling.title ?? ""}
          open
          onOpenChange={(v) => !v && setCancelling(null)}
        />
      )}
    </>
  );
}
