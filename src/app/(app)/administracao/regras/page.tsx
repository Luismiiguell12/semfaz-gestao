"use client";

import * as React from "react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { ErrorState, InlineAlert, LoadingRows } from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { useAddListItem, useAddSupplier, useRulesAndLists, useUpdateSetting } from "@/modules/settings/api";
import { SUPPLIER_KIND_LABEL } from "@/modules/utilities/api";
import { useAuth } from "@/providers/auth-provider";

const ALERT_LABEL: Record<string, string> = {
  contract_expiring: "Vencimento próximo",
  contract_expired: "Contrato vencido",
  contract_adjustment: "Data-base (reajuste)",
  invoice_overdue: "Fatura vencida",
};

function SupplierEditor({
  items,
}: {
  items: { id: string; name: string; kind: "energy" | "water"; is_active: boolean }[];
}) {
  const { access } = useAuth();
  const add = useAddSupplier();
  const update = useUpdateSetting();
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState<"" | "energy" | "water">("");
  return (
    <Panel
      title="Fornecedores de água e energia"
      description="Aparecem no cadastro de unidades consumidoras. Fornecedores desativados não podem receber novas unidades."
    >
      <ul className="mb-4 divide-y rounded-md border">
        {items.length === 0 && (
          <li className="text-muted-foreground px-4 py-2.5 text-sm">Nenhum fornecedor cadastrado.</li>
        )}
        {items.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className={i.is_active ? "" : "text-muted-foreground line-through"}>
              {i.name}{" "}
              <span className="text-muted-foreground">({SUPPLIER_KIND_LABEL[i.kind].toLowerCase()})</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                update.mutate(
                  { table: "suppliers", id: i.id, values: { is_active: !i.is_active } },
                  { onError: (e) => toast.error(e.message) },
                )
              }
            >
              {i.is_active ? "Desativar" : "Reativar"}
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length < 2) return toast.error("Informe um nome com pelo menos 2 caracteres.");
          if (!kind) return toast.error("Selecione o tipo do fornecedor (água ou energia).");
          add.mutate(
            { name, kind, organizationId: access!.profile!.organization_id },
            {
              onSuccess: () => {
                setName("");
                setKind("");
                toast.success("Fornecedor adicionado.");
              },
              onError: (err) => toast.error(err.message),
            },
          );
        }}
      >
        <label htmlFor="supplier-new" className="sr-only">
          Nome do fornecedor
        </label>
        <Input
          id="supplier-new"
          className="min-w-40 flex-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do fornecedor"
          maxLength={120}
        />
        <label htmlFor="supplier-kind" className="sr-only">
          Tipo do fornecedor
        </label>
        <div className="w-36">
          <NativeSelect
            id="supplier-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as "" | "energy" | "water")}
          >
            <option value="">Tipo</option>
            <option value="energy">{SUPPLIER_KIND_LABEL.energy}</option>
            <option value="water">{SUPPLIER_KIND_LABEL.water}</option>
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline" loading={add.isPending}>
          Adicionar
        </Button>
      </form>
    </Panel>
  );
}

function ListEditor({
  title,
  table,
  items,
}: {
  title: string;
  table: "contract_modalities" | "adjustment_indexes";
  items: { id: string; name: string; is_active: boolean }[];
}) {
  const { access } = useAuth();
  const add = useAddListItem();
  const update = useUpdateSetting();
  const [name, setName] = React.useState("");
  const inputId = `${table}-new`;
  return (
    <Panel title={title}>
      <ul className="mb-4 divide-y rounded-md border">
        {items.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className={i.is_active ? "" : "text-muted-foreground line-through"}>{i.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                update.mutate(
                  { table, id: i.id, values: { is_active: !i.is_active } },
                  { onError: (e) => toast.error(e.message) },
                )
              }
            >
              {i.is_active ? "Desativar" : "Reativar"}
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length < 2) return toast.error("Informe um nome com pelo menos 2 caracteres.");
          add.mutate(
            { table, name, organizationId: access!.profile!.organization_id },
            {
              onSuccess: () => {
                setName("");
                toast.success("Item adicionado.");
              },
              onError: (err) => toast.error(err.message),
            },
          );
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Novo item
        </label>
        <Input
          id={inputId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Novo item"
          maxLength={120}
        />
        <Button type="submit" variant="outline" loading={add.isPending}>
          Adicionar
        </Button>
      </form>
      <p className="text-muted-foreground mt-2 text-xs">
        Itens não são apagados; desative os que não devem mais ser usados.
      </p>
    </Panel>
  );
}

function RulesContent() {
  const q = useRulesAndLists();
  const update = useUpdateSetting();
  const [days, setDays] = React.useState<Record<string, string>>({});
  if (q.isLoading) return <LoadingRows />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const d = q.data!;
  return (
    <>
      <PageHeader
        title="Regras e listas"
        description="Configurações da organização. Todas as alterações ficam registradas na auditoria."
      />
      <InlineAlert tone="info" className="mb-6">
        As listas de modalidades e índices trazem apenas exemplos genéricos. As listas oficiais dependem de
        definição da SEMFAZ.
      </InlineAlert>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel
          title="Operações que exigem aprovação"
          description="Desmarcar faz a operação ser efetivada na hora, sem decisão de administrador."
        >
          <ul className="space-y-3">
            {d.approval.map((r) => (
              <li key={r.id} className="flex items-start gap-2.5">
                <Checkbox
                  id={`ar-${r.id}`}
                  className="mt-0.5"
                  checked={r.requires_approval}
                  onCheckedChange={(v) =>
                    update.mutate(
                      { table: "approval_rules", id: r.id, values: { requires_approval: v === true } },
                      {
                        onSuccess: () => toast.success("Regra atualizada."),
                        onError: (e) => toast.error(e.message),
                      },
                    )
                  }
                />
                <label htmlFor={`ar-${r.id}`} className="cursor-pointer text-sm">
                  {(r.approval_operations as { description: string } | null)?.description ?? r.operation_code}
                </label>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Alertas" description="Gerados todos os dias às 6h (horário de Maceió).">
          <ul className="divide-y">
            {d.alert.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <Checkbox
                  id={`al-${r.id}`}
                  checked={r.is_active}
                  onCheckedChange={(v) =>
                    update.mutate(
                      { table: "alert_rules", id: r.id, values: { is_active: v === true } },
                      { onError: (e) => toast.error(e.message) },
                    )
                  }
                />
                <label htmlFor={`al-${r.id}`} className="min-w-40 flex-1 cursor-pointer text-sm">
                  {ALERT_LABEL[r.code]}
                </label>
                {r.days_before > 0 && (
                  <span className="flex items-center gap-2">
                    <label htmlFor={`ald-${r.id}`} className="sr-only">
                      Dias de antecedência
                    </label>
                    <Input
                      id={`ald-${r.id}`}
                      className="w-20"
                      inputMode="numeric"
                      value={days[r.id] ?? String(r.days_before)}
                      onChange={(e) => setDays({ ...days, [r.id]: e.target.value.replace(/\D/g, "") })}
                      onBlur={() => {
                        const n = Number(days[r.id] ?? r.days_before);
                        if (n === r.days_before) return;
                        if (n < 1 || n > 365) return toast.error("Informe entre 1 e 365 dias.");
                        update.mutate(
                          { table: "alert_rules", id: r.id, values: { days_before: n } },
                          {
                            onSuccess: () => toast.success("Prazo atualizado."),
                            onError: (e) => toast.error(e.message),
                          },
                        );
                      }}
                    />
                    <span className="text-muted-foreground text-sm">dias antes</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
        <ListEditor title="Modalidades de contrato" table="contract_modalities" items={d.modalities} />
        <ListEditor title="Índices de reajuste" table="adjustment_indexes" items={d.indexes} />
        <SupplierEditor items={d.suppliers} />
      </div>
    </>
  );
}

export default function RulesPage() {
  return (
    <RequirePermission permission="settings.manage">
      <RulesContent />
    </RequirePermission>
  );
}
