"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { EmptyState, ErrorState, FullPageLoading, InlineAlert } from "@/components/shared/states";
import { DetailList } from "@/components/shared/detail-list";
import { FormField } from "@/components/shared/form-field";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SUPPLIER_KIND_LABEL,
  useAssignUnit,
  useConsumerUnit,
  useEndAssignment,
} from "@/modules/consumer-units/api";
import { useProperties } from "@/modules/properties/api";
import { formatCompetence, useInvoices } from "@/modules/finance/api";
import { ChargeStatusBadge } from "@/modules/finance/components";
import { useDepartments } from "@/modules/departments/api";
import { DocumentsPanel } from "@/modules/documents/documents-panel";
import { useAuth } from "@/providers/auth-provider";
import { formatCalendarDate, formatCurrency } from "@/lib/format";
import { UnitDialog } from "../unit-dialog";

function AssignDialog({
  unitId,
  mode,
  open,
  onOpenChange,
}: {
  unitId: string;
  mode: "assign" | "end";
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const properties = useProperties();
  const assign = useAssignUnit();
  const end = useEndAssignment();
  const [propertyId, setPropertyId] = React.useState("");
  const [date, setDate] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string>();
  async function submit() {
    setError(undefined);
    if (mode === "assign" && !propertyId) return setError("Selecione o imóvel.");
    if (!date) return setError("Informe a data.");
    if (reason.trim().length < 10) return setError("Informe a justificativa (mínimo de 10 caracteres).");
    try {
      if (mode === "assign")
        await assign.mutateAsync({ unitId, propertyId, startDate: date, reason: reason.trim() });
      else await end.mutateAsync({ unitId, endDate: date, reason: reason.trim() });
      toast.success(mode === "assign" ? "Vínculo registrado." : "Vínculo encerrado.");
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          noValidate
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {mode === "assign" ? "Vincular ou transferir unidade" : "Encerrar vínculo"}
            </DialogTitle>
            <DialogDescription>
              {mode === "assign"
                ? "Se houver vínculo aberto, ele é encerrado no dia anterior à data informada. O histórico é preservado."
                : "A unidade deixa de estar vinculada a um imóvel a partir do dia seguinte."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {error && <InlineAlert tone="danger">{error}</InlineAlert>}
            {mode === "assign" && (
              <FormField id="as-prop" label="Imóvel" required>
                <NativeSelect value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                  <option value="">Selecione</option>
                  {properties.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            )}
            <FormField
              id="as-date"
              label={mode === "assign" ? "Data de vinculação" : "Último dia do vínculo"}
              required
            >
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </FormField>
            <FormField id="as-reason" label="Justificativa" required>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={assign.isPending || end.isPending}>
              Confirmar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UnitDetail() {
  const id = useSearchParams().get("id");
  const { can } = useAuth();
  const q = useConsumerUnit(id);
  const invoices = useInvoices({ unitId: id ?? undefined });
  const [dialog, setDialog] = React.useState<"edit" | "assign" | "end" | null>(null);

  const deps = useDepartments();
  if (q.isLoading) return <FullPageLoading />;
  if (q.isError) return <ErrorState message={q.error.message} />;
  const u = q.data?.unit;
  if (!u)
    return (
      <ErrorState title="Unidade não encontrada." message="Ela não existe ou está fora do seu escopo." />
    );
  const supplier = u.suppliers as { name: string; kind: "energy" | "water" } | null;
  const current = q.data!.assignments.find((a) => a.end_date === null);
  const departments = deps;
  const canManage = can("consumer_units.manage");

  return (
    <>
      <Button asChild variant="link" size="sm" className="mb-3">
        <Link href="/unidades/">
          <ArrowLeft aria-hidden="true" /> Unidades consumidoras
        </Link>
      </Button>
      <PageHeader
        title={`${supplier?.kind === "water" ? "Matrícula" : "UC"} ${u.identifier}`}
        description={`${supplier?.name ?? ""}, titular: ${u.holder_name}`}
        actions={
          <Badge tone={u.status === "active" ? "success" : "neutral"}>
            {u.status === "active" ? "Ativa" : "Inativa"}
          </Badge>
        }
      />
      <Panel bodyClassName="pt-1">
        <Tabs defaultValue="dados">
          <TabsList>
            <TabsTrigger value="dados">Dados e vínculos</TabsTrigger>
            <TabsTrigger value="faturas">Faturas</TabsTrigger>
            <TabsTrigger value="consumo">Consumo</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
          </TabsList>
          <TabsContent value="dados" className="space-y-6">
            <DetailList
              items={[
                {
                  label: "Fornecedor",
                  value: supplier
                    ? `${supplier.name} (${SUPPLIER_KIND_LABEL[supplier.kind].toLowerCase()})`
                    : "—",
                },
                {
                  label: "Imóvel atual",
                  value: current ? (
                    <Link
                      className="text-primary hover:underline"
                      href={`/imoveis/detalhe/?id=${current.property_id}`}
                    >
                      {current.properties?.name}
                    </Link>
                  ) : (
                    "Sem vínculo"
                  ),
                },
                {
                  label: "Secretaria",
                  value: current
                    ? (departments.data?.find((d) => d.id === current.properties?.department_id)?.name ??
                      "Acesso restrito")
                    : "—",
                },
                { label: "Medidor", value: u.meter_number ?? "—" },
                { label: "Complemento", value: u.complement ?? "—" },
                { label: "Endereço", value: u.address ?? "—" },
                { label: "Observações", value: u.notes ?? "—" },
              ]}
            />
            <div>
              <h3 className="mb-2 text-sm font-semibold">Histórico de vínculos</h3>
              {q.data!.assignments.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum vínculo registrado.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {q.data!.assignments.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-col gap-1 px-4 py-2.5 text-sm sm:flex-row sm:justify-between"
                    >
                      <Link href={`/imoveis/detalhe/?id=${a.property_id}`} className="hover:underline">
                        {a.properties?.name ?? "Imóvel de acesso restrito"}
                      </Link>
                      <span className="tabular text-muted-foreground">
                        {formatCalendarDate(a.start_date)} a{" "}
                        {a.end_date ? formatCalendarDate(a.end_date) : "atual"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {canManage && (
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => setDialog("edit")}>
                  <Pencil aria-hidden="true" /> Editar dados
                </Button>
                <Button variant="outline" onClick={() => setDialog("assign")}>
                  {current ? "Transferir para outro imóvel" : "Vincular a um imóvel"}
                </Button>
                {current && (
                  <Button variant="ghost" onClick={() => setDialog("end")}>
                    Encerrar vínculo
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
          <TabsContent value="faturas">
            {invoices.data?.length === 0 && <EmptyState title="Nenhuma fatura lançada" className="py-6" />}
            <ul className="divide-y rounded-md border empty:hidden">
              {invoices.data?.map((i) => (
                <li key={i.id}>
                  <Link
                    href={`/financeiro/faturas/detalhe/?id=${i.id}`}
                    className="hover:bg-surface flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="tabular text-sm font-medium">
                      Competência {formatCompetence(i.competence)}
                    </span>
                    <span className="flex items-center gap-3 text-sm">
                      <span className="tabular">{formatCurrency(i.amount)}</span>
                      <ChargeStatusBadge status={i.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="consumo">
            {q.data!.consumption.length === 0 && (
              <EmptyState
                title="Sem análise de consumo"
                description="A análise é feita a cada fatura lançada."
                className="py-6"
              />
            )}
            <ul className="divide-y rounded-md border empty:hidden">
              {q.data!.consumption.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="tabular font-medium">
                    {formatCompetence(c.competence)}: {Number(c.consumption).toLocaleString("pt-BR")}{" "}
                    {supplier?.kind === "water" ? "m³" : "kWh"}
                  </span>
                  <span className="flex items-center gap-2">
                    {c.status === "insufficient_history" && (
                      <Badge tone="neutral">Histórico insuficiente</Badge>
                    )}
                    {c.status === "normal" && <Badge tone="success">Dentro do esperado</Badge>}
                    {c.status === "alert" && (
                      <Badge tone="warning">
                        Aumento de {String(c.increase_percent ?? "").replace(".", ",")}% para análise
                      </Badge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-3 text-xs">
              Alerta quando o consumo supera em mais de 30% a média dos três meses anteriores. O alerta indica
              necessidade de análise, não irregularidade.
            </p>
          </TabsContent>
          <TabsContent value="documentos">
            <DocumentsPanel entityType="consumer_unit" entityId={u.id} canAttach={canManage} />
          </TabsContent>
        </Tabs>
      </Panel>
      {dialog === "edit" && <UnitDialog unit={u} open onOpenChange={(v) => !v && setDialog(null)} />}
      {(dialog === "assign" || dialog === "end") && (
        <AssignDialog unitId={u.id} mode={dialog} open onOpenChange={(v) => !v && setDialog(null)} />
      )}
    </>
  );
}
