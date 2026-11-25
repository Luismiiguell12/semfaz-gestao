"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardList, Plus, Tags } from "lucide-react";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState, ErrorState, FullPageLoading, LoadingRows } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/select";
import { FilterTab, FilterTabs, FilterTabsList } from "@/components/ui/filter-tabs";
import { useAuth } from "@/providers/auth-provider";
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  URGENCY_LABEL,
  useTaskCategories,
  useTasks,
  type TaskListItem,
  type TaskStatus,
} from "@/modules/tasks/api";
import {
  OverdueBadge,
  PriorityBadge,
  TaskDialog,
  TaskStatusBadge,
  formatDue,
} from "@/modules/tasks/components";
import { Kanban } from "./kanban";

const columns: ColumnDef<TaskListItem, unknown>[] = [
  {
    id: "title",
    accessorFn: (t) => `${t.title} ${t.category_name} ${t.responsible_name ?? ""}`,
    header: "Demanda",
    meta: { label: "Demanda", hideOnCard: true },
    cell: ({ row }) => (
      <Link href={`/demandas/detalhe/?id=${row.original.id}`} className="group block">
        <span className="group-hover:text-primary block font-semibold group-hover:underline">
          {row.original.title}
        </span>
        <span className="text-muted-foreground block text-xs">{row.original.category_name}</span>
      </Link>
    ),
  },
  { id: "resp", accessorKey: "responsible_name", header: "Responsável", meta: { label: "Responsável" } },
  {
    id: "due",
    accessorFn: (t) => t.due_date ?? "9999",
    header: "Prazo",
    meta: { label: "Prazo" },
    cell: ({ row }) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="tabular">{formatDue(row.original.due_date, row.original.due_time)}</span>
        {row.original.is_overdue && <OverdueBadge />}
      </span>
    ),
  },
  {
    id: "urgency",
    accessorKey: "urgency",
    header: "Urgência",
    meta: { label: "Urgência" },
    cell: ({ row }) => (row.original.urgency ? URGENCY_LABEL[row.original.urgency] : "—"),
  },
  {
    id: "priority",
    accessorKey: "priority",
    header: "Prioridade",
    meta: { label: "Prioridade" },
    cell: ({ row }) => <PriorityBadge value={row.original.priority} />,
  },
  {
    id: "status",
    accessorKey: "status",
    header: "Situação",
    meta: { label: "Situação" },
    cell: ({ row }) => <TaskStatusBadge status={row.original.status} />,
  },
];

type View = "lista" | "kanban";

function TasksContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const { can, access } = useAuth();
  const me = access?.profile?.id;
  const list = useTasks();
  const categories = useTaskCategories();
  const view: View = sp.get("visao") === "kanban" ? "kanban" : "lista";
  const [mine, setMine] = React.useState(false);
  const [overdue, setOverdue] = React.useState(sp.get("atrasadas") === "1");
  const [category, setCategory] = React.useState("");
  const [responsible, setResponsible] = React.useState("");
  const [status, setStatus] = React.useState<"" | "open" | TaskStatus>(view === "lista" ? "open" : "");
  const [creating, setCreating] = React.useState(false);

  const responsibles = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const t of list.data ?? []) if (t.responsible_id) m.set(t.responsible_id, t.responsible_name ?? "—");
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [list.data]);

  const data = (list.data ?? []).filter((t) => {
    if (mine && !(t.created_by === me || t.member_ids.includes(me ?? ""))) return false;
    if (overdue && !t.is_overdue) return false;
    if (category && t.category_id !== category) return false;
    if (responsible && t.responsible_id !== responsible) return false;
    if (view === "lista" && status === "open" && (t.status === "done" || t.status === "cancelled"))
      return false;
    if (view === "lista" && status && status !== "open" && t.status !== status) return false;
    return true;
  });

  const setView = (v: string) => {
    const p = new URLSearchParams(sp.toString());
    p.set("visao", v);
    router.replace(`/demandas/?${p.toString()}`);
  };

  return (
    <>
      <PageHeader
        title="Demandas"
        description="Atraso é calculado pelo prazo (horário de Maceió) e não muda a situação automaticamente."
        actions={
          <>
            {can("tasks.categories.manage") && (
              <Button asChild variant="outline">
                <Link href="/demandas/categorias/">
                  <Tags aria-hidden="true" /> Categorias
                </Link>
              </Button>
            )}
            {can("tasks.create") && (
              <Button onClick={() => setCreating(true)}>
                <Plus aria-hidden="true" /> Nova demanda
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 space-y-3">
        <FilterTabs value={view} onValueChange={setView}>
          <FilterTabsList aria-label="Visualização das demandas">
            <FilterTab value="lista">Lista</FilterTab>
            <FilterTab value="kanban">Kanban</FilterTab>
          </FilterTabsList>
        </FilterTabs>
        <div className="grid grid-cols-1 items-end gap-3 sm:flex sm:flex-wrap">
          {view === "lista" && (
            <label className="text-sm">
              <span className="text-muted-foreground mb-1 block text-xs font-medium">Situação</span>
              <NativeSelect
                className="w-full sm:w-44"
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                <option value="open">Em aberto</option>
                <option value="">Todas</option>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABEL[s]}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}
          <label className="text-sm">
            <span className="text-muted-foreground mb-1 block text-xs font-medium">Categoria</span>
            <NativeSelect
              className="w-full sm:w-48"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Todas</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground mb-1 block text-xs font-medium">Responsável</span>
            <NativeSelect
              className="w-full sm:w-48"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
            >
              <option value="">Todos</option>
              {responsibles.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex h-10 cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={mine} onCheckedChange={(v) => setMine(v === true)} /> Somente as minhas
          </label>
          <label className="flex h-10 cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={overdue} onCheckedChange={(v) => setOverdue(v === true)} /> Atrasadas
          </label>
        </div>
      </div>

      {list.isLoading && <LoadingRows />}
      {list.isError && <ErrorState message={list.error.message} onRetry={() => list.refetch()} />}
      {list.data && view === "kanban" && <Kanban tasks={data} />}
      {list.data && view === "lista" && (
        <Panel bodyClassName="p-0">
          <DataTable
            columns={columns}
            data={data}
            getRowId={(t) => t.id!}
            searchPlaceholder="Buscar por título, categoria ou responsável"
            cardTitle={(t) => (
              <Link
                href={`/demandas/detalhe/?id=${t.id}`}
                className="text-primary font-semibold hover:underline"
              >
                {t.title}
              </Link>
            )}
            emptyState={
              <EmptyState
                icon={ClipboardList}
                title="Nenhuma demanda encontrada"
                description="Você vê as demandas das quais participa e, se tiver permissão, as do seu escopo."
              />
            }
          />
        </Panel>
      )}
      {creating && (
        <TaskDialog
          task={null}
          open
          onOpenChange={setCreating}
          onSaved={(id) => router.push(`/demandas/detalhe/?id=${id}`)}
        />
      )}
    </>
  );
}

export default function TasksPage() {
  return (
    <React.Suspense fallback={<FullPageLoading />}>
      <TasksContent />
    </React.Suspense>
  );
}
