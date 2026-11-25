"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { EmptyState, ErrorState, FullPageLoading, InlineAlert } from "@/components/shared/states";
import { Figure } from "@/components/shared/detail-list";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form-field";
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
  useRent,
  useRequestRentCancel,
  useRequestRentCorrection,
} from "@/modules/finance/api";
import { ChargeStatusBadge, PaymentsPanel } from "@/modules/finance/components";
import { DocumentsPanel } from "@/modules/documents/documents-panel";
import { useContract } from "@/modules/contracts/api";
import { useDepartments } from "@/modules/departments/api";
import { useAuth } from "@/providers/auth-provider";
import { formatCalendarDate, formatCurrency } from "@/lib/format";
import { parseBrlInput } from "@shared/schemas/br.ts";
import { ScrollRegion } from "@/components/shared/scroll-region";

interface Memo {
  amount: string;
  days_in_month: number;
  days: number;
  full_month: boolean;
  periods: {
    from: string;
    to: string;
    days: number;
    monthly_value: string;
    daily_value: string;
    subtotal: string;
  }[];
}

export function RentDetail() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const { can } = useAuth();
  const q = useRent(id);
  const correct = useRequestRentCorrection();
  const cancel = useRequestRentCancel();
  const [dialog, setDialog] = React.useState<"correct" | "cancel" | null>(null);
  const [amount, setAmount] = React.useState("");
  const [just, setJust] = React.useState("");
  const [error, setError] = React.useState<string>();
  const contract = useContract(q.data?.rent?.contract_id ?? null);
  const departments = useDepartments();
  const department = departments.data?.find((d) => d.id === q.data?.rent?.department_id)?.name;

  if (q.isLoading) return <FullPageLoading />;
  if (q.isError) return <ErrorState message={q.error.message} />;
  const r = q.data?.rent;
  if (!r)
    return (
      <ErrorState title="Lançamento não encontrado." message="Ele não existe ou está fora do seu escopo." />
    );
  const memo = r.calc_memo as unknown as Memo;
  const canManage = can("invoices.manage");
  const cancelled = r.status === "cancelled";

  async function submitCorrection() {
    setError(undefined);
    const v = parseBrlInput(amount);
    if (!v) return setError("Informe um valor válido (ex.: 1.234,56).");
    if (just.trim().length < 10) return setError("Informe a justificativa (mínimo de 10 caracteres).");
    try {
      const req = await correct.mutateAsync({ id: r!.id!, amount: v, justification: just.trim() });
      toast.success("Correção enviada para aprovação.");
      router.push(`/aprovacoes/detalhe/?id=${req.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <Button asChild variant="link" size="sm" className="mb-3">
        <Link href="/financeiro/alugueis/">
          <ArrowLeft aria-hidden="true" /> Aluguéis
        </Link>
      </Button>
      <PageHeader
        title={`Aluguel ${formatCompetence(r.competence)}`}
        description={
          <>
            Contrato{" "}
            <Link className="text-primary hover:underline" href={`/contratos/detalhe/?id=${r.contract_id}`}>
              {r.contract_number}
            </Link>
            ,{" "}
            <Link className="text-primary hover:underline" href={`/imoveis/detalhe/?id=${r.property_id}`}>
              {r.property_name}
            </Link>
            {department ? `, ${department}` : ""}
            {contract.data?.landlords && contract.data.landlords.length > 0 && (
              <span className="block">
                Locador{contract.data.landlords.length > 1 ? "es" : ""}:{" "}
                {contract.data.landlords.map((l, i) => (
                  <React.Fragment key={l.id}>
                    {i > 0 && ", "}
                    {l.landlords ? (
                      <Link
                        className="text-primary hover:underline"
                        href={`/locadores/detalhe/?id=${l.landlord_id}`}
                      >
                        {l.landlords.name}
                      </Link>
                    ) : (
                      "acesso restrito"
                    )}
                    {l.share_percent !== null ? ` (${String(l.share_percent).replace(".", ",")}%)` : ""}
                  </React.Fragment>
                ))}
              </span>
            )}
          </>
        }
        actions={<ChargeStatusBadge status={r.status} />}
      />
      {cancelled && (
        <InlineAlert tone="warning" className="mb-4" title="Lançamento cancelado">
          {r.cancellation_reason}
        </InlineAlert>
      )}
      {r.correction_note && (
        <InlineAlert tone="info" className="mb-4" title="Valor corrigido por solicitação aprovada">
          Valor calculado originalmente: {formatCurrency(r.calculated_amount)}. Motivo: {r.correction_note}
        </InlineAlert>
      )}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Figure
          label="Valor"
          value={formatCurrency(r.amount)}
          hint={memo.full_month ? "Mês completo" : `Proporcional: ${memo.days} de ${memo.days_in_month} dias`}
        />
        <Figure label="Vencimento" value={formatCalendarDate(r.due_date)} />
        <Figure label="Pago (líquido de estornos)" value={formatCurrency(r.paid_total)} />
        <Figure label="Saldo em aberto" value={formatCurrency(r.balance)} />
      </div>
      <Panel bodyClassName="pt-1">
        <Tabs defaultValue="calculo">
          <TabsList>
            <TabsTrigger value="calculo">Memória de cálculo</TabsTrigger>
            <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
            <TabsTrigger value="documentos">Comprovantes</TabsTrigger>
          </TabsList>
          <TabsContent value="calculo" className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Regra: valor mensal ÷ dias do mês × dias de vigência no mês, contando o primeiro e o último dia.
              Com aditivo de valor no meio do mês, cada período usa o seu valor. O total é arredondado para
              centavos (meio para cima).
            </p>
            <ScrollRegion label="Memória de cálculo" className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface text-muted-foreground border-b text-left text-xs">
                    <th scope="col" className="px-4 py-2 font-semibold">
                      Período
                    </th>
                    <th scope="col" className="px-4 py-2 font-semibold">
                      Dias
                    </th>
                    <th scope="col" className="px-4 py-2 font-semibold">
                      Valor mensal
                    </th>
                    <th scope="col" className="px-4 py-2 font-semibold">
                      Valor diário
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {memo.periods.map((p) => (
                    <tr key={p.from} className="tabular border-b last:border-b-0">
                      <td className="px-4 py-2">
                        {formatCalendarDate(p.from)} a {formatCalendarDate(p.to)}
                      </td>
                      <td className="px-4 py-2">
                        {p.days} de {memo.days_in_month}
                      </td>
                      <td className="px-4 py-2">{formatCurrency(p.monthly_value)}</td>
                      <td className="px-4 py-2">
                        {Number(p.daily_value).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                          maximumFractionDigits: 6,
                        })}
                      </td>
                      <td className="px-4 py-2 text-right">{formatCurrency(p.subtotal)}</td>
                    </tr>
                  ))}
                  <tr className="tabular bg-surface font-semibold">
                    <td className="px-4 py-2" colSpan={4}>
                      Total (arredondado)
                    </td>
                    <td className="px-4 py-2 text-right">{formatCurrency(memo.amount)}</td>
                  </tr>
                </tbody>
              </table>
            </ScrollRegion>
            {canManage && !cancelled && (
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAmount("");
                    setJust("");
                    setError(undefined);
                    setDialog("correct");
                  }}
                >
                  Solicitar correção de valor
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
          <TabsContent value="pagamentos">
            <PaymentsPanel
              target={{ rent_charge_id: r.id! }}
              payments={q.data!.payments}
              balance={Number(r.balance)}
              canManage={canManage}
              cancelled={cancelled}
            />
          </TabsContent>
          <TabsContent value="documentos">
            {can("finance.documents.view") ? (
              <DocumentsPanel entityType="rent_charge" entityId={r.id!} canAttach={canManage} />
            ) : (
              <EmptyState
                title="Acesso restrito"
                description="Documentos financeiros exigem permissão específica."
                className="py-6"
              />
            )}
          </TabsContent>
        </Tabs>
      </Panel>
      <Dialog open={dialog === "correct"} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent size="sm">
          <form
            noValidate
            className="contents"
            onSubmit={(e) => {
              e.preventDefault();
              submitCorrection();
            }}
          >
            <DialogHeader>
              <DialogTitle>Solicitar correção de valor</DialogTitle>
              <DialogDescription>
                O valor calculado é preservado no histórico. A correção vale depois da aprovação.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              {error && <InlineAlert tone="danger">{error}</InlineAlert>}
              <FormField id="rc-amount" label="Novo valor (R$)" required>
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </FormField>
              <FormField id="rc-just" label="Justificativa" required>
                <Textarea rows={2} value={just} onChange={(e) => setJust(e.target.value)} />
              </FormField>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>
                Cancelar
              </Button>
              <Button type="submit" loading={correct.isPending}>
                Enviar para aprovação
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={dialog === "cancel"}
        onOpenChange={(v) => !v && setDialog(null)}
        title="Solicitar cancelamento do lançamento?"
        description="O lançamento é preservado no histórico e marcado como cancelado após a aprovação."
        confirmLabel="Enviar para aprovação"
        tone="destructive"
        requireReason
        onConfirm={async (reason) => {
          try {
            const req = await cancel.mutateAsync({ id: r.id!, justification: reason });
            toast.success("Cancelamento enviado para aprovação.");
            router.push(`/aprovacoes/detalhe/?id=${req.id}`);
          } catch (e) {
            toast.error((e as Error).message);
            throw e;
          }
        }}
      />
    </>
  );
}
