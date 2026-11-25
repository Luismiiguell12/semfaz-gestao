"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/states";
import { FormField } from "@/components/shared/form-field";
import { RequirePermission } from "@/components/auth/route-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import {
  AUDIT_MODULE_LABEL,
  AUDIT_PAGE_SIZE,
  OPERATION_LABEL,
  useAuditLogs,
  type AuditFilters,
  type AuditLog,
} from "@/modules/audit/api";
import { useUserDirectory } from "@/modules/users/api";
import { formatDateTime, formatInteger } from "@/lib/format";
import { ScrollRegion } from "@/components/shared/scroll-region";

const HIDDEN_FIELDS = new Set(["updated_at", "updated_by", "created_at", "created_by"]);

function Diff({ log }: { log: AuditLog }) {
  const oldData = (log.old_data ?? {}) as Record<string, unknown>;
  const newData = (log.new_data ?? {}) as Record<string, unknown>;
  const fields = (
    log.changed_fields?.length ? log.changed_fields : Object.keys({ ...oldData, ...newData })
  ).filter((f) => !HIDDEN_FIELDS.has(f));
  const show = (v: unknown) =>
    v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return (
    <div className="bg-surface space-y-3 px-5 py-4 text-sm">
      {log.justification && (
        <p>
          <span className="font-semibold">Justificativa: </span>
          {log.justification}
        </p>
      )}
      {Boolean(log.ip_address || log.user_agent) && (
        <p className="text-muted-foreground text-xs">
          Origem: {log.ip_address ? String(log.ip_address) : "IP não disponível"}
          {log.user_agent ? `, ${log.user_agent}` : ""}
        </p>
      )}
      {fields.length > 0 && (
        <ScrollRegion label="Campos alterados" className="bg-background rounded-md border">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th scope="col" className="px-3 py-2 font-semibold">
                  Campo
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Antes
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Depois
                </th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f} className="border-b align-top last:border-b-0">
                  <td className="px-3 py-2 font-mono">{f}</td>
                  <td className="text-muted-foreground max-w-xs px-3 py-2 break-all">
                    {log.old_data ? show(oldData[f]) : "—"}
                  </td>
                  <td className="max-w-xs px-3 py-2 break-all">{log.new_data ? show(newData[f]) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      )}
    </div>
  );
}

function AuditContent() {
  const [filters, setFilters] = React.useState<AuditFilters>({ page: 0 });
  const [draft, setDraft] = React.useState<AuditFilters>({ page: 0 });
  const [open, setOpen] = React.useState<string | null>(null);
  const logs = useAuditLogs(filters);
  const directory = useUserDirectory();
  const users = [...(directory.data?.values() ?? [])].sort((a, b) =>
    (a.full_name ?? "").localeCompare(b.full_name ?? "", "pt-BR"),
  );
  const totalPages = Math.max(1, Math.ceil((logs.data?.total ?? 0) / AUDIT_PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Auditoria"
        description="Registro permanente de alterações, exclusões, logins e mudanças de permissões. Nenhum registro pode ser alterado ou apagado."
      />
      <Panel className="mb-4" title="Filtros">
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            setFilters({ ...draft, page: 0 });
          }}
        >
          <FormField id="f-from" label="De">
            <Input
              type="date"
              value={draft.from ?? ""}
              onChange={(e) => setDraft({ ...draft, from: e.target.value || undefined })}
            />
          </FormField>
          <FormField id="f-to" label="Até">
            <Input
              type="date"
              value={draft.to ?? ""}
              onChange={(e) => setDraft({ ...draft, to: e.target.value || undefined })}
            />
          </FormField>
          <FormField id="f-module" label="Módulo">
            <NativeSelect
              value={draft.module ?? ""}
              onChange={(e) => setDraft({ ...draft, module: e.target.value || undefined })}
            >
              <option value="">Todos</option>
              {Object.entries(AUDIT_MODULE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="f-op" label="Operação">
            <NativeSelect
              value={draft.operation ?? ""}
              onChange={(e) => setDraft({ ...draft, operation: e.target.value || undefined })}
            >
              <option value="">Todas</option>
              {Object.entries(OPERATION_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="f-actor" label="Usuário">
            <NativeSelect
              value={draft.actorId ?? ""}
              onChange={(e) => setDraft({ ...draft, actorId: e.target.value || undefined })}
            >
              <option value="">Todos</option>
              {users.map((u) => (
                <option key={u.id!} value={u.id!}>
                  {u.full_name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
            <Button type="submit">Aplicar filtros</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraft({ page: 0 });
                setFilters({ page: 0 });
              }}
            >
              Limpar
            </Button>
          </div>
        </form>
      </Panel>
      <Panel
        bodyClassName="p-0"
        title="Registros"
        description={
          logs.data ? `${formatInteger(logs.data.total)} registros. Horários de Maceió (UTC−3).` : undefined
        }
      >
        {logs.isLoading && <LoadingRows />}
        {logs.isError && <ErrorState message={logs.error.message} onRetry={() => logs.refetch()} />}
        {logs.data && logs.data.rows.length === 0 && (
          <EmptyState icon={History} title="Nenhum registro para os filtros informados" />
        )}
        <ul className="divide-y">
          {logs.data?.rows.map((log) => {
            const expanded = open === log.id;
            const actor = log.actor_id
              ? (directory.data?.get(log.actor_id)?.full_name ?? "Usuário")
              : "Sistema";
            return (
              <li key={log.id}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : log.id)}
                  className="hover:bg-surface focus-visible:outline-ring flex w-full cursor-pointer items-start gap-3 px-5 py-3 text-left focus-visible:outline-2"
                >
                  {expanded ? (
                    <ChevronDown className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  )}
                  <span className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[10rem_9rem_minmax(0,1fr)_minmax(0,12rem)] sm:gap-4">
                    <span className="tabular text-sm">{formatDateTime(log.occurred_at)}</span>
                    <span>
                      <Badge
                        tone={
                          log.operation.includes("DELETE")
                            ? "danger"
                            : log.operation === "INSERT"
                              ? "success"
                              : log.operation === "UPDATE"
                                ? "info"
                                : "neutral"
                        }
                      >
                        {OPERATION_LABEL[log.operation] ?? log.operation}
                      </Badge>
                    </span>
                    <span className="truncate text-sm">
                      {AUDIT_MODULE_LABEL[log.module] ?? log.module}
                      {log.table_name && <span className="text-muted-foreground">, {log.table_name}</span>}
                    </span>
                    <span className="text-muted-foreground truncate text-sm">{actor}</span>
                  </span>
                </button>
                {expanded && <Diff log={log} />}
              </li>
            );
          })}
        </ul>
        {logs.data && logs.data.total > AUDIT_PAGE_SIZE && (
          <div className="flex items-center justify-between border-t px-5 py-3 text-sm">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page === 0}
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
            >
              Anterior
            </Button>
            <span className="tabular text-muted-foreground">
              Página {filters.page + 1} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page + 1 >= totalPages}
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            >
              Próxima
            </Button>
          </div>
        )}
      </Panel>
    </>
  );
}

export default function AuditPage() {
  return (
    <RequirePermission permission="audit.view">
      <AuditContent />
    </RequirePermission>
  );
}
