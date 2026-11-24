"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/form-field";

/**
 * Modal de confirmação. Com `requireReason`, exige justificativa (mínimo de
 * 10 caracteres, a mesma regra validada no banco), que é registrada na auditoria.
 */
type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  tone?: "default" | "destructive";
  requireReason?: boolean;
  reasonLabel?: string;
  onConfirm: (reason: string) => Promise<void> | void;
};

export function ConfirmDialog(props: ConfirmDialogProps) {
  const [pending, setPending] = React.useState(false);
  return (
    <Dialog open={props.open} onOpenChange={(v) => !pending && props.onOpenChange(v)}>
      <DialogContent size="sm">
        {/* O corpo é desmontado ao fechar, o que limpa justificativa e erros. */}
        {props.open && <ConfirmDialogBody {...props} pending={pending} setPending={setPending} />}
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDialogBody({
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "default",
  requireReason = false,
  reasonLabel = "Justificativa",
  onConfirm,
  pending,
  setPending,
}: ConfirmDialogProps & { pending: boolean; setPending: (v: boolean) => void }) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string>();

  async function handleConfirm() {
    if (requireReason && reason.trim().length < 10) {
      setError("A justificativa deve ter pelo menos 10 caracteres.");
      return;
    }
    setPending(true);
    try {
      await onConfirm(reason.trim());
      onOpenChange(false);
    } catch {
      // A mensagem de erro é exibida por quem chamou (toast); o modal continua aberto.
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      {requireReason && (
        <DialogBody>
          <FormField id="confirm-reason" label={reasonLabel} required error={error} hint="Registrada na auditoria. Mínimo de 10 caracteres.">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} rows={3} autoFocus />
          </FormField>
        </DialogBody>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
          Cancelar
        </Button>
        <Button variant={tone === "destructive" ? "destructive" : "default"} onClick={handleConfirm} loading={pending}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}
