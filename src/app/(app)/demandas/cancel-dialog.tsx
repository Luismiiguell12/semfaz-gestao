"use client";

import * as React from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/form-field";
import { InlineAlert } from "@/components/shared/states";
import { useSetTaskStatus } from "@/modules/tasks/api";

/** Cancelamento de demanda: exige motivo (registrado no histórico). */
export function CancelTaskDialog({
  taskId,
  title,
  open,
  onOpenChange,
}: {
  taskId: string;
  title: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const setStatus = useSetTaskStatus();
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string>();
  async function submit() {
    setError(undefined);
    if (note.trim().length < 10)
      return setError("Informe o motivo do cancelamento (mínimo de 10 caracteres).");
    try {
      await setStatus.mutateAsync({ id: taskId, status: "cancelled", note: note.trim() });
      toast.success("Demanda cancelada.");
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar demanda</DialogTitle>
          <DialogDescription>
            &quot;{title}&quot;. A demanda continua no sistema, com a situação Cancelada.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {error && <InlineAlert tone="danger">{error}</InlineAlert>}
          <FormField id="cancel-note" label="Motivo" required>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button variant="destructive" onClick={submit} loading={setStatus.isPending}>
            Cancelar demanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
