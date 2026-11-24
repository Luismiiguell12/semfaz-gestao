"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/states";
import { FormField } from "@/components/shared/form-field";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RequirePermission } from "@/components/auth/route-guard";
import { Badge } from "@/components/ui/badge";
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
import {
  DEPARTMENT_KIND_LABEL,
  toTree,
  useDeleteDepartment,
  useDepartments,
  useSaveDepartment,
  type Department,
  type DepartmentNode,
} from "@/modules/departments/api";
import { DocumentsPanel } from "@/modules/documents/documents-panel";
import { departmentSchema, type DepartmentInput } from "@shared/schemas/organization.ts";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

function DepartmentDialog({
  open,
  onOpenChange,
  editing,
  departments,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Department | null;
  departments: DepartmentNode[];
}) {
  const save = useSaveDepartment();
  const form = useForm<DepartmentInput>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { kind: "secretariat", name: "", acronym: "", parent_id: "", is_active: true },
  });
  const kind = form.watch("kind");

  React.useEffect(() => {
    if (open) {
      form.reset(
        editing
          ? {
              kind: editing.kind,
              name: editing.name,
              acronym: editing.acronym ?? "",
              parent_id: editing.parent_id ?? "",
              is_active: editing.is_active,
            }
          : { kind: "secretariat", name: "", acronym: "", parent_id: "", is_active: true },
      );
    }
  }, [open, editing, form]);

  // Pais válidos: diretoria → secretaria; unidade → secretaria ou diretoria.
  // Como o nível é estritamente decrescente, não há risco de ciclo (validado também no banco).
  const parentOptions = departments.filter((d) => {
    if (editing && d.id === editing.id) return false;
    if (kind === "directorate") return d.kind === "secretariat";
    if (kind === "unit") return d.kind === "secretariat" || d.kind === "directorate";
    return false;
  });

  async function onSubmit(values: DepartmentInput) {
    try {
      await save.mutateAsync({ id: editing?.id, values });
      toast.success(editing ? "Departamento atualizado." : "Departamento cadastrado.");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const errors = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="contents">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar departamento" : "Novo departamento"}</DialogTitle>
            <DialogDescription>Estrutura: secretaria, diretoria e unidade.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <FormField id="dep-kind" label="Nível" required error={errors.kind?.message}>
              <NativeSelect {...form.register("kind")}>
                <option value="secretariat">Secretaria</option>
                <option value="directorate">Diretoria</option>
                <option value="unit">Unidade</option>
              </NativeSelect>
            </FormField>
            {kind !== "secretariat" && (
              <FormField
                id="dep-parent"
                label="Departamento superior"
                required
                error={errors.parent_id?.message}
              >
                <NativeSelect {...form.register("parent_id")}>
                  <option value="">Selecione</option>
                  {parentOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {"  ".repeat(d.depth)}
                      {d.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            )}
            <FormField id="dep-name" label="Nome" required error={errors.name?.message}>
              <Input {...form.register("name")} maxLength={200} />
            </FormField>
            <FormField
              id="dep-acronym"
              label="Sigla"
              error={errors.acronym?.message}
              hint="Opcional. Letras maiúsculas e números."
            >
              <Input {...form.register("acronym")} maxLength={20} className="uppercase" />
            </FormField>
            <div className="flex items-center gap-2">
              <Checkbox
                id="dep-active"
                checked={form.watch("is_active")}
                onCheckedChange={(v) => form.setValue("is_active", v === true)}
              />
              <label htmlFor="dep-active" className="cursor-pointer text-sm">
                Ativo
              </label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {editing ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DepartmentsContent() {
  const { can } = useAuth();
  const list = useDepartments();
  const remove = useDeleteDepartment();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Department | null>(null);
  const [deleting, setDeleting] = React.useState<Department | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const tree = React.useMemo(() => toTree(list.data ?? []), [list.data]);
  const current = tree.find((d) => d.id === selected) ?? null;
  const canManage = can("departments.manage");

  return (
    <>
      <PageHeader
        title="Departamentos"
        description="Estrutura organizacional usada nos escopos de acesso dos usuários. Exclusões são lógicas e auditadas."
        actions={
          canManage && (
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus aria-hidden="true" /> Novo departamento
            </Button>
          )
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel bodyClassName="p-0" title="Estrutura">
          {list.isLoading && <LoadingRows />}
          {list.isError && <ErrorState message={list.error.message} onRetry={() => list.refetch()} />}
          {list.data && tree.length === 0 && (
            <EmptyState icon={FolderTree} title="Nenhum departamento cadastrado" />
          )}
          <ul role="tree" aria-label="Departamentos" className="divide-y">
            {tree.map((d) => (
              <li
                key={d.id}
                role="treeitem"
                aria-level={d.depth + 1}
                aria-selected={selected === d.id}
                className={cn(
                  "flex items-center gap-2 py-2.5 pr-3",
                  selected === d.id && "bg-primary-soft/60",
                )}
                style={{ paddingLeft: `${1 + d.depth * 1.5}rem` }}
              >
                <button
                  type="button"
                  className="focus-visible:outline-ring flex min-w-0 flex-1 cursor-pointer flex-col items-start rounded text-left focus-visible:outline-2"
                  onClick={() => setSelected(d.id)}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    {d.depth > 0 && <span className="bg-border h-px w-3" aria-hidden="true" />}
                    <span className="text-sm font-medium">{d.name}</span>
                    {d.acronym && <span className="text-muted-foreground text-xs">{d.acronym}</span>}
                    {!d.is_active && <Badge tone="warning">Inativo</Badge>}
                  </span>
                  <span className="text-muted-foreground text-xs">{DEPARTMENT_KIND_LABEL[d.kind]}</span>
                </button>
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar ${d.name}`}
                      onClick={() => {
                        setEditing(d);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Excluir ${d.name}`}
                      onClick={() => setDeleting(d)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title={current ? `Documentos: ${current.name}` : "Documentos"}
          description={current ? current.path : "Selecione um departamento para ver os documentos anexados."}
        >
          {current ? (
            <DocumentsPanel entityType="department" entityId={current.id} canAttach={canManage} />
          ) : (
            <EmptyState title="Nenhum departamento selecionado" className="py-6" />
          )}
        </Panel>
      </div>

      <DepartmentDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} departments={tree} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Excluir ${deleting?.name ?? ""}?`}
        description="O departamento deixa de aparecer nas listagens, mas permanece no histórico e na auditoria."
        confirmLabel="Excluir departamento"
        tone="destructive"
        requireReason
        onConfirm={async (reason) => {
          try {
            await remove.mutateAsync({ id: deleting!.id, reason });
            toast.success("Departamento excluído.");
            if (selected === deleting!.id) setSelected(null);
          } catch (e) {
            toast.error((e as Error).message);
            throw e;
          }
        }}
      />
    </>
  );
}

export default function DepartmentsPage() {
  return (
    <RequirePermission permission="departments.manage">
      <DepartmentsContent />
    </RequirePermission>
  );
}
