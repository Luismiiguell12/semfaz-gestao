"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Wallet } from "lucide-react";
import { toast } from "sonner";
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
import { FormField } from "@/components/shared/form-field";
import { EmptyState, InlineAlert } from "@/components/shared/states";
import { CHARGE_STATUS_LABEL, useRequestPayment, type ChargeStatus, type Payment } from "./api";
import { parseBrlInput } from "@shared/schemas/br.ts";
import { formatCalendarDate, formatCurrency, formatDateTime } from "@/lib/format";

export function ChargeStatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "pending") as ChargeStatus;
  const tone = {
    pending: "info",
    partially_paid: "warning",
    paid: "success",
    overdue: "danger",
    cancelled: "neutral",
  } as const;
  return <Badge tone={tone[s]}>{CHARGE_STATUS_LABEL[s]}</Badge>;
}

function PaymentDialog({
  target,
  kind,
  reversalOf,
  maxAmount,
  open,
  onOpenChange,
}: {
  target: { invoice_id?: string; rent_charge_id?: string };
  kind: "payment" | "reversal";
  reversalOf?: Payment;
  maxAmount: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const req = useRequestPayment();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Maceio" });
  const [amount, setAmount] = React.useState(maxAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
  const [paidOn, setPaidOn] = React.useState(today);
  const [notes, setNotes] = React.useState("");
  const [just, setJust] = React.useState("");
  const [error, setError] = React.useState<string>();

  async function submit() {
    setError(undefined);
    const value = parseBrlInput(amount);
    if (!value || Number(value) <= 0) return setError("Informe um valor válido (ex.: 1.234,56).");
    if (!paidOn || paidOn > today) return setError("Informe a data do pagamento (não pode ser futura).");
    if (just.trim().length < 10) return setError("Informe a justificativa (mínimo de 10 caracteres).");
    try {
      const r = await req.mutateAsync({
        data: { ...target, kind, amount: value, paid_on: paidOn, notes, reversal_of: reversalOf?.id ?? "" },
        justification: just.trim(),
      });
      toast.success(
        kind === "payment" ? "Pagamento enviado para aprovação." : "Estorno enviado para aprovação.",
      );
      onOpenChange(false);
      router.push(`/aprovacoes/detalhe/?id=${r.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !req.isPending && onOpenChange(v)}>
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
            <DialogTitle>{kind === "payment" ? "Registrar pagamento" : "Registrar estorno"}</DialogTitle>
            <DialogDescription>
              {kind === "payment"
                ? "Registra um pagamento já realizado (integral, parcial ou complementar). Só vale depois da aprovação. O sistema não executa pagamentos."
                : `Estorna o pagamento de ${formatCurrency(reversalOf?.amount ?? 0)} de ${formatCalendarDate(reversalOf?.paid_on)}. O pagamento original é preservado.`}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {error && <InlineAlert tone="danger">{error}</InlineAlert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="pay-amount"
                label="Valor (R$)"
                required
                hint={`Máximo: ${formatCurrency(maxAmount)}`}
              >
                <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </FormField>
              <FormField
                id="pay-date"
                label={kind === "payment" ? "Data do pagamento" : "Data do estorno"}
                required
              >
                <Input type="date" max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
              </FormField>
            </div>
            <FormField id="pay-notes" label="Observações">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
            </FormField>
            <FormField
              id="pay-just"
              label="Justificativa"
              required
              hint="Anexe o comprovante na solicitação, depois de enviá-la."
            >
              <Textarea rows={2} value={just} onChange={(e) => setJust(e.target.value)} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={req.isPending}
            >
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

/** Movimentações (pagamentos, complementos, estornos) de uma fatura ou aluguel. */
export function PaymentsPanel({
  target,
  payments,
  balance,
  canManage,
  cancelled,
}: {
  target: { invoice_id?: string; rent_charge_id?: string };
  payments: Payment[];
  balance: number;
  canManage: boolean;
  cancelled: boolean;
}) {
  const [dialog, setDialog] = React.useState<{ kind: "payment" | "reversal"; payment?: Payment } | null>(
    null,
  );
  // Somente para a dica de valor máximo; a validação definitiva é feita no banco.
  // Aritmética em centavos inteiros (sem ponto flutuante).
  const cents = (v: number | string) => Math.round(Number(v) * 100);
  const reversedOf = (id: string) =>
    payments.filter((p) => p.reversal_of === id).reduce((acc, p) => acc + cents(p.amount), 0) / 100;
  const remainingOf = (p: Payment) => (cents(p.amount) - Math.round(reversedOf(p.id) * 100)) / 100;

  return (
    <div className="space-y-4">
      {payments.length === 0 ? (
        <EmptyState icon={Wallet} title="Nenhum pagamento registrado" className="py-6" />
      ) : (
        <ul className="divide-y rounded-md border">
          {payments.map((p) => {
            const remaining = remainingOf(p);
            return (
              <li
                key={p.id}
                className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  <span className="font-medium">
                    {p.kind === "payment" ? "Pagamento" : "Estorno"} de{" "}
                    <span className="tabular">{formatCurrency(p.amount)}</span>
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    Pago em {formatCalendarDate(p.paid_on)}, registrado em {formatDateTime(p.created_at)}
                    {p.notes ? `. ${p.notes}` : ""}
                  </span>
                </span>
                {canManage && !cancelled && p.kind === "payment" && remaining > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDialog({ kind: "reversal", payment: p })}
                  >
                    <RotateCcw aria-hidden="true" /> Estornar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canManage && !cancelled && balance > 0 && (
        <Button variant="outline" onClick={() => setDialog({ kind: "payment" })}>
          <Wallet aria-hidden="true" /> Registrar pagamento
        </Button>
      )}
      {dialog && (
        <PaymentDialog
          open
          onOpenChange={(v) => !v && setDialog(null)}
          target={target}
          kind={dialog.kind}
          reversalOf={dialog.payment}
          maxAmount={dialog.kind === "payment" ? balance : remainingOf(dialog.payment!)}
        />
      )}
    </div>
  );
}
