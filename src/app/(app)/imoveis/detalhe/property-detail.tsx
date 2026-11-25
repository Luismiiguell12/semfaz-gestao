"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { EmptyState, ErrorState, FullPageLoading, LoadingRows } from "@/components/shared/states";
import { DetailList } from "@/components/shared/detail-list";
import { ApprovalStatusBadge, PropertyStatusBadge, ValidityBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormField } from "@/components/shared/form-field";
import {
  useProperty,
  usePropertyLandlords,
  useSetPropertyLandlords,
  type Property,
} from "@/modules/properties/api";
import { usePropertyContracts } from "@/modules/contracts/api";
import { useEntityApprovals } from "@/modules/approvals/api";
import { useLandlords } from "@/modules/landlords/api";
import { useDepartments } from "@/modules/departments/api";
import { useUserDirectory } from "@/modules/users/api";
import { DocumentsPanel } from "@/modules/documents/documents-panel";
import { landlordSharesSchema } from "@shared/schemas/properties.ts";
import { useAuth } from "@/providers/auth-provider";
import { formatCalendarDate, formatCurrency, formatDateTime } from "@/lib/format";
import { AddressChangeDialog, DepartmentChangeDialog, DetailsDialog } from "./property-dialogs";

function LandlordsTab({ property, canEdit }: { property: Property; canEdit: boolean }) {
  const links = usePropertyLandlords(property.id);
  const all = useLandlords();
  const save = useSetPropertyLandlords(property.id);
  const [editing, setEditing] = React.useState(false);
  const [items, setItems] = React.useState<{ landlord_id: string; share: string }[]>([]);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string>();

  function startEdit() {
    setItems(
      (links.data ?? []).map((l) => ({
        landlord_id: l.landlord_id,
        share: l.share_percent === null ? "" : String(l.share_percent).replace(".", ","),
      })),
    );
    setReason("");
    setError(undefined);
    setEditing(true);
  }

  async function submit() {
    const parsed = landlordSharesSchema.safeParse(
      items.map((i) => ({
        landlord_id: i.landlord_id,
        share_percent: i.share.trim() ? Number(i.share.replace(",", ".")) : undefined,
      })),
    );
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    if (reason.trim().length < 10) return setError("Informe uma justificativa com pelo menos 10 caracteres.");
    try {
      await save.mutateAsync({ items: parsed.data, reason: reason.trim() });
      toast.success("Locadores do imóvel atualizados.");
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (links.isLoading) return <LoadingRows rows={2} />;
  if (!editing) {
    return (
      <div>
        {links.data && links.data.length === 0 ? (
          <EmptyState title="Nenhum locador vinculado" className="py-6" />
        ) : (
          <ul className="divide-y rounded-md border">
            {links.data?.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{l.landlords?.name}</span>
                  <span className="text-muted-foreground block text-xs">{l.landlords?.document_masked}</span>
                </span>
                <span className="tabular">
                  {l.share_percent !== null ? `${String(l.share_percent).replace(".", ",")}%` : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <Button variant="outline" size="sm" className="mt-4" onClick={startEdit}>
            <Pencil aria-hidden="true" /> Editar locadores
          </Button>
        )}
      </div>
    );
  }
  const used = new Set(items.map((i) => i.landlord_id));
  return (
    <div className="space-y-4">
      {error && (
        <p className="text-danger text-sm font-medium" role="alert">
          {error}
        </p>
      )}
      {items.map((it, idx) => (
        <div key={idx} className="grid items-end gap-3 sm:grid-cols-[1fr_9rem_auto]">
          <FormField id={`ll-${idx}`} label={`Locador ${idx + 1}`}>
            <NativeSelect
              value={it.landlord_id}
              onChange={(e) =>
                setItems(items.map((x, i) => (i === idx ? { ...x, landlord_id: e.target.value } : x)))
              }
            >
              <option value="">Selecione</option>
              {all.data
                ?.filter((l) => l.id === it.landlord_id || !used.has(l.id))
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.document_masked})
                  </option>
                ))}
            </NativeSelect>
          </FormField>
          <FormField id={`ll-share-${idx}`} label="Percentual (%)">
            <Input
              inputMode="decimal"
              value={it.share}
              onChange={(e) =>
                setItems(items.map((x, i) => (i === idx ? { ...x, share: e.target.value } : x)))
              }
            />
          </FormField>
          <Button type="button" variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
            Remover
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setItems([...items, { landlord_id: "", share: "" }])}
      >
        <Plus aria-hidden="true" /> Adicionar locador
      </Button>
      <p className="text-muted-foreground text-xs">
        Com mais de um locador, informe o percentual de cada um (soma 100%). Não encontrou o locador?
        Cadastre-o em{" "}
        <Link href="/locadores/" className="underline">
          Locadores
        </Link>
        .
      </p>
      <FormField id="ll-reason" label="Justificativa" required>
        <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </FormField>
      <div className="flex gap-2">
        <Button onClick={submit} loading={save.isPending}>
          Salvar locadores
        </Button>
        <Button variant="outline" onClick={() => setEditing(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

export function PropertyDetail() {
  const id = useSearchParams().get("id");
  const { can } = useAuth();
  const property = useProperty(id);
  const contracts = usePropertyContracts(id);
  const history = useEntityApprovals(id ?? undefined);
  const departments = useDepartments();
  const directory = useUserDirectory();
  const [dialog, setDialog] = React.useState<"address" | "department" | "details" | null>(null);

  if (property.isLoading) return <FullPageLoading />;
  if (property.isError) return <ErrorState message={property.error.message} />;
  const p = property.data;
  if (!p)
    return (
      <ErrorState
        title="Imóvel não encontrado."
        message="Ele não existe ou está fora do seu escopo de acesso."
      />
    );

  const deptName = (did: string | null) => departments.data?.find((d) => d.id === did)?.name ?? "—";
  const canUpdate = can("properties.update");

  return (
    <>
      <Button asChild variant="link" size="sm" className="mb-3">
        <Link href="/imoveis/">
          <ArrowLeft aria-hidden="true" /> Imóveis
        </Link>
      </Button>
      <PageHeader
        title={p.name}
        description={`${p.street}, ${p.address_number}${p.complement ? `, ${p.complement}` : ""}, ${p.district}, ${p.city}/${p.state}, CEP ${p.postal_code}`}
        actions={<PropertyStatusBadge status={p.status} />}
      />
      <Panel bodyClassName="pt-1">
        <Tabs defaultValue="dados">
          <TabsList>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="locadores">Locadores</TabsTrigger>
            <TabsTrigger value="contratos">Contratos</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="dados" className="space-y-6">
            <DetailList
              items={[
                { label: "Finalidade", value: p.purpose },
                { label: "Secretaria responsável", value: deptName(p.department_id) },
                { label: "Unidade administrativa", value: deptName(p.unit_department_id) },
                {
                  label: "Responsável interno",
                  value: p.internal_responsible_id
                    ? directory.data?.get(p.internal_responsible_id)?.full_name
                    : "—",
                },
                { label: "Data de ocupação", value: formatCalendarDate(p.occupation_date) },
                { label: "Situação", value: <PropertyStatusBadge status={p.status} /> },
                { label: "Observações", value: p.notes ?? "—" },
                { label: "Cadastrado em", value: formatDateTime(p.created_at) },
              ]}
            />
            {canUpdate && (
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => setDialog("details")}>
                  <Pencil aria-hidden="true" /> Editar dados
                </Button>
                <Button variant="outline" onClick={() => setDialog("address")}>
                  Solicitar alteração de endereço
                </Button>
                <Button variant="outline" onClick={() => setDialog("department")}>
                  Solicitar alteração de secretaria
                </Button>
              </div>
            )}
          </TabsContent>
          <TabsContent value="locadores">
            <LandlordsTab property={p} canEdit={canUpdate && can("landlords.view")} />
          </TabsContent>
          <TabsContent value="contratos">
            {contracts.isLoading && <LoadingRows rows={2} />}
            {contracts.data && contracts.data.length === 0 && (
              <EmptyState title="Nenhum contrato para este imóvel" className="py-6" />
            )}
            <ul className="divide-y rounded-md border empty:hidden">
              {contracts.data?.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/contratos/detalhe/?id=${c.id}`}
                    className="hover:bg-surface flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium">Contrato {c.contract_number}</span>
                    <span className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
                      <span className="tabular">
                        {formatCalendarDate(c.start_date)} a {formatCalendarDate(c.effective_end_date)}
                      </span>
                      <span className="tabular">{formatCurrency(c.effective_monthly_value)}/mês</span>
                      <ValidityBadge status={c.validity_status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {can("contracts.manage") && (
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href={`/contratos/novo/?imovel=${p.id}`}>
                  <Plus aria-hidden="true" /> Solicitar novo contrato
                </Link>
              </Button>
            )}
          </TabsContent>
          <TabsContent value="documentos">
            <DocumentsPanel entityType="property" entityId={p.id} canAttach={canUpdate} />
          </TabsContent>
          <TabsContent value="historico">
            {history.data && history.data.length === 0 && (
              <EmptyState title="Sem solicitações registradas para este imóvel" className="py-6" />
            )}
            <ul className="divide-y rounded-md border empty:hidden">
              {history.data?.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/aprovacoes/detalhe/?id=${r.id}`}
                    className="hover:bg-surface flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="text-sm font-medium">{r.approval_operations?.description}</span>
                    <span className="text-muted-foreground flex items-center gap-3 text-sm">
                      <span className="tabular">{formatDateTime(r.requested_at)}</span>
                      <ApprovalStatusBadge status={r.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-3 text-xs">
              O histórico completo de alterações fica na Auditoria (acesso restrito).
            </p>
          </TabsContent>
        </Tabs>
      </Panel>
      {dialog === "address" && (
        <AddressChangeDialog property={p} open onOpenChange={(v) => !v && setDialog(null)} />
      )}
      {dialog === "department" && (
        <DepartmentChangeDialog property={p} open onOpenChange={(v) => !v && setDialog(null)} />
      )}
      {dialog === "details" && (
        <DetailsDialog property={p} open onOpenChange={(v) => !v && setDialog(null)} />
      )}
    </>
  );
}
