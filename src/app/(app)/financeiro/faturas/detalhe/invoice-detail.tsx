"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { EmptyState, ErrorState, FullPageLoading, InlineAlert } from "@/components/shared/states";
import { DetailList, Figure } from "@/components/shared/detail-list";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form-field";
import { ApprovalStatusBadge } from "@/components/shared/status-badges";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatCompetence,
  useInvoice,
  useRequestInvoiceCancel,
  useRequestInvoiceCorrection,
  type InvoiceOverview,
} from "@/modules/finance/api";
import { ChargeStatusBadge, PaymentsPanel } from "@/modules/finance/components";
import { useEntityApprovals } from "@/modules/approvals/api";
import { DocumentsPanel } from "@/modules/documents/documents-panel";
import { useAuth } from "@/providers/auth-provider";
import { formatCalendarDate, formatCurrency, formatDateTime } from "@/lib/format";
import { parseBrlInput } from "@shared/schemas/br.ts";

function CorrectionDialog({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: InvoiceOverview;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const req = useRequestInvoiceCorrection();
  const fmt = (n: number | string | null) =>
    n === null
      ? ""
      : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const [v, setV] = React.useState({
    invoice_number: invoice.invoice_number ?? "",
    consumption: fmt(invoice.consumption),
    amount: fmt(invoice.amount),
    issue_date: invoice.issue_date ?? "",
    due_date: invoice.due_date ?? "",
    justification: "",
  });
  const [error, setError] = React.useState<string>();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV({ ...v, [k]: e.target.value });
  async function submit() {
    setError(undefined);
    const consumption = v.consumption.trim().replace(/\./g, "").replace(",", ".");
    const amount = parseBrlInput(v.amount);
    if (!/^\d+(\.\d{1,3})?$/.test(consumption)) return setError("Consumo inválido.");
    if (!amount) return setError("Valor inválido (ex.: 1.234,56).");
    if (!v.due_date) return setError("Informe o vencimento.");
    if (v.justification.trim().length < 10)
      return setError("Informe a justificativa (mínimo de 10 caracteres).");
    try {
      const r = await req.mutateAsync({
        id: invoice.id!,
        data: {
          invoice_number: v.invoice_number,
          consumption,
          amount,
          issue_date: v.issue_date,
          due_date: v.due_date,
        },
        justification: v.justification.trim(),
      });
      toast.success("Correção enviada para aprovação.");
      router.push(`/aprovacoes/detalhe/?id=${r.id}`);
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
            <DialogTitle>Solicitar correção da fatura</DialogTitle>
            <DialogDescription>
              Consumo, valor, número e datas. A correção só vale depois da aprovação.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            {error && (
              <InlineAlert tone="danger" className="sm:col-span-2">
                {error}
              </InlineAlert>
            )}
            <FormField id="c-num" label="Número da fatura">
              <Input value={v.invoice_number} onChange={set("invoice_number")} />
            </FormField>
            <FormField id="c-cons" label={`Consumo (${invoice.measure_unit})`} required>
              <Input inputMode="decimal" value={v.consumption} onChange={set("consumption")} />
            </FormField>
            <FormField id="c-amount" label="Valor (R$)" required>
              <Input inputMode="decimal" value={v.amount} onChange={set("amount")} />
            </FormField>
            <FormField id="c-issue" label="Emissão">
              <Input type="date" value={v.issue_date} onChange={set("issue_date")} />
            </FormField>
            <FormField id="c-due" label="Vencimento" required>
              <Input type="date" value={v.due_date} onChange={set("due_date")} />
            </FormField>
            <FormField id="c-just" label="Justificativa" required className="sm:col-span-2">
              <Textarea rows={2} value={v.justification} onChange={set("justification")} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={req.isPending}>
              Enviar para aprovação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InvoiceDetail() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const { can } = useAuth();
  const q = useInvoice(id);
  const history = useEntityApprovals(id ?? undefined);
  const cancel = useRequestInvoiceCancel();
  const [dialog, setDialog] = React.useState<"correct" | "cancel" | null>(null);

  if (q.isLoading) return <FullPageLoading />;
  if (q.isError) return <ErrorState message={q.error.message} />;
  const i = q.data?.invoice;
  if (!i)
    return <ErrorState title="Fatura não encontrada." message="Ela não existe ou está fora do seu escopo." />;
  const canManage = can("invoices.manage");
  const cancelled = i.status === "cancelled";
  const c = q.data!.consumption;

  return (
    <>
      <Button asChild variant="link" size="sm" className="mb-3">
        <Link href="/financeiro/faturas/">
          <ArrowLeft aria-hidden="true" /> Faturas
        </Link>
      </Button>
      <PageHeader
        title={`Fatura ${i.supplier_name} ${i.unit_identifier}`}
        description={
          <>
            Competência {formatCompetence(i.competence)}, imóvel{" "}
            <Link className="text-primary hover:underline" href={`/imoveis/detalhe/?id=${i.property_id}`}>
              {i.property_name}
            </Link>
          </>
        }
        actions={<ChargeStatusBadge status={i.status} />}
      />
      {i.is_justified_duplicate && (
        <InlineAlert tone="info" className="mb-4">
          Fatura duplicada lançada com justificativa aprovada.
        </InlineAlert>
      )}
      {cancelled && (
        <InlineAlert tone="warning" className="mb-4" title="Fatura cancelada">
          {i.cancellation_reason}
        </InlineAlert>
      )}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Figure
          label="Valor"
          value={formatCurrency(i.amount)}
          hint={`Vencimento ${formatCalendarDate(i.due_date)}`}
        />
        <Figure
          label="Pago (líquido de estornos)"
          value={formatCurrency(i.paid_total)}
          hint={
            i.last_paid_on ? `Último pagamento em ${formatCalendarDate(i.last_paid_on)}` : "Sem pagamento"
          }
        />
        <Figure label="Saldo em aberto" value={formatCurrency(i.balance)} />
        <Figure
          label="Consumo"
          value={`${Number(i.consumption).toLocaleString("pt-BR")} ${i.measure_unit}`}
          hint={
            c?.status === "alert"
              ? `${String(c.increase_percent).replace(".", ",")}% acima da média`
              : c?.status === "insufficient_history"
                ? "Histórico insuficiente para comparar"
                : "Dentro do esperado"
          }
        />
      </div>
      {c?.status === "alert" && (
        <InlineAlert tone="warning" className="mb-4" title="Consumo acima do esperado">
          Média dos três meses anteriores: {Number(c.previous_average).toLocaleString("pt-BR")}{" "}
          {i.measure_unit}. O alerta indica necessidade de análise, não irregularidade.
        </InlineAlert>
      )}
      <Panel bodyClassName="pt-1">
        <Tabs defaultValue="pagamentos">
          <TabsList>
            <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="documentos">Fatura e comprovantes</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="pagamentos">
            <PaymentsPanel
              target={{ invoice_id: i.id! }}
              payments={q.data!.payments}
              balance={Number(i.balance)}
              canManage={canManage}
              cancelled={cancelled}
            />
          </TabsContent>
          <TabsContent value="dados" className="space-y-6">
            <DetailList
              items={[
                { label: "Número", value: i.invoice_number ?? "—" },
                { label: "Fornecedor", value: i.supplier_name },
                {
                  label: "Unidade",
                  value: (
                    <Link
                      className="text-primary hover:underline"
                      href={`/unidades/detalhe/?id=${i.unit_id}`}
                    >
                      {i.unit_identifier}
                    </Link>
                  ),
                },
                { label: "Emissão", value: formatCalendarDate(i.issue_date) },
                { label: "Vencimento", value: formatCalendarDate(i.due_date) },
                { label: "Lançada em", value: formatDateTime(i.created_at) },
              ]}
            />
            {canManage && !cancelled && (
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => setDialog("correct")}>
                  Solicitar correção
                </Button>
                <Button
                  variant="outline"
                  className="border-danger/40 text-danger hover:bg-danger-soft"
                  onClick={() => setDialog("cancel")}
                >
                  Solicitar cancelamento
                </Button>
              </div>
            )}
          </TabsContent>
          <TabsContent value="documentos">
            {can("finance.documents.view") ? (
              <DocumentsPanel entityType="invoice" entityId={i.id!} canAttach={canManage} />
            ) : (
              <EmptyState
                title="Acesso restrito"
                description="Documentos financeiros exigem permissão específica."
                className="py-6"
              />
            )}
          </TabsContent>
          <TabsContent value="historico">
            {history.data?.length === 0 && (
              <EmptyState title="Sem solicitações registradas" className="py-6" />
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
            {q.data!.alerts.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-semibold">Alertas</h3>
                <ul className="space-y-1 text-sm">
                  {q.data!.alerts.map((a) => (
                    <li key={a.id}>
                      <Badge tone="danger">Vencida</Badge> {a.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Panel>
      {dialog === "correct" && (
        <CorrectionDialog invoice={i} open onOpenChange={(v) => !v && setDialog(null)} />
      )}
      <ConfirmDialog
        open={dialog === "cancel"}
        onOpenChange={(v) => !v && setDialog(null)}
        title="Solicitar cancelamento da fatura?"
        description="A fatura só é cancelada depois da aprovação. Faturas com pagamento registrado exigem o estorno antes."
        confirmLabel="Enviar para aprovação"
        tone="destructive"
        requireReason
        onConfirm={async (reason) => {
          try {
            const r = await cancel.mutateAsync({ id: i.id!, justification: reason });
            toast.success("Cancelamento enviado para aprovação.");
            router.push(`/aprovacoes/detalhe/?id=${r.id}`);
          } catch (e) {
            toast.error((e as Error).message);
            throw e;
          }
        }}
      />
    </>
  );
}
