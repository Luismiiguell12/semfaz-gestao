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
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/form-field";
import { InlineAlert } from "@/components/shared/states";
import { useProperties } from "@/modules/properties/api";
import { SUPPLIER_KIND_LABEL, useSaveUnit, useSuppliers, type ConsumerUnit } from "@/modules/utilities/api";

export function UnitDialog({
  unit,
  open,
  onOpenChange,
}: {
  unit: ConsumerUnit | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const suppliers = useSuppliers();
  const save = useSaveUnit();
  const properties = useProperties();
  const [link, setLink] = React.useState({
    property_id: "",
    start_date: new Date().toLocaleDateString("en-CA", { timeZone: "America/Maceio" }),
  });
  const [v, setV] = React.useState({
    supplier_id: unit?.supplier_id ?? "",
    identifier: unit?.identifier ?? "",
    complement: unit?.complement ?? "",
    holder_name: unit?.holder_name ?? "",
    meter_number: unit?.meter_number ?? "",
    address: unit?.address ?? "",
    status: unit?.status ?? "active",
    notes: unit?.notes ?? "",
  });
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string>();
  const kind = suppliers.data?.find((s) => s.id === v.supplier_id)?.kind;
  const set =
    (k: keyof typeof v) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setV({ ...v, [k]: e.target.value });

  async function submit() {
    setError(undefined);
    if (!v.supplier_id) return setError("Selecione o fornecedor.");
    if (!/^[0-9A-Za-z./-]{1,40}$/.test(v.identifier.trim()))
      return setError(
        kind === "water"
          ? "Informe a matrícula (letras, números, ponto, barra ou hífen)."
          : "Informe o número da UC (letras, números, ponto, barra ou hífen).",
      );
    if (v.holder_name.trim().length < 2) return setError("Informe o titular.");
    if (!unit && !link.property_id) return setError("Selecione o imóvel onde a unidade está instalada.");
    if (!unit && !link.start_date) return setError("Informe a data de vinculação ao imóvel.");
    if (unit && reason.trim().length < 10)
      return setError("Informe a justificativa da alteração (mínimo de 10 caracteres).");
    try {
      await save.mutateAsync({
        id: unit?.id ?? null,
        data: unit ? v : { ...v, ...link },
        reason: reason.trim(),
      });
      toast.success(unit ? "Unidade atualizada." : "Unidade cadastrada.");
      onOpenChange(false);
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
            <DialogTitle>{unit ? "Editar unidade consumidora" : "Nova unidade consumidora"}</DialogTitle>
            <DialogDescription>
              Dados lançados manualmente a partir das faturas da Energisa e da Iguá.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            {error && (
              <InlineAlert tone="danger" className="sm:col-span-2">
                {error}
              </InlineAlert>
            )}
            {suppliers.data && suppliers.data.filter((s) => s.is_active).length === 0 && (
              <InlineAlert tone="warning" className="sm:col-span-2">
                Nenhum fornecedor ativo. Um administrador pode cadastrar em Administração &gt; Regras e
                listas.
              </InlineAlert>
            )}
            <FormField id="u-sup" label="Fornecedor" required>
              <NativeSelect value={v.supplier_id} onChange={set("supplier_id")} disabled={Boolean(unit)}>
                <option value="">Selecione</option>
                {suppliers.data
                  ?.filter((s) => s.is_active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({SUPPLIER_KIND_LABEL[s.kind].toLowerCase()})
                    </option>
                  ))}
              </NativeSelect>
            </FormField>
            <FormField id="u-id" label={kind === "water" ? "Matrícula" : "Número da UC"} required>
              <Input value={v.identifier} onChange={set("identifier")} autoComplete="off" />
            </FormField>
            <FormField id="u-holder" label="Titular" required className="sm:col-span-2">
              <Input value={v.holder_name} onChange={set("holder_name")} />
            </FormField>
            {kind !== "water" && (
              <FormField id="u-meter" label="Medidor">
                <Input value={v.meter_number} onChange={set("meter_number")} />
              </FormField>
            )}
            {kind === "water" && (
              <>
                <FormField id="u-compl" label="Complemento">
                  <Input value={v.complement} onChange={set("complement")} />
                </FormField>
                <FormField id="u-addr" label="Endereço" className="sm:col-span-2">
                  <Input value={v.address} onChange={set("address")} />
                </FormField>
              </>
            )}
            {!unit && (
              <>
                <FormField id="u-prop" label="Imóvel" required>
                  <NativeSelect
                    value={link.property_id}
                    onChange={(e) => setLink({ ...link, property_id: e.target.value })}
                  >
                    <option value="">Selecione</option>
                    {properties.data
                      ?.filter((p) => !p.deleted_at)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </NativeSelect>
                </FormField>
                <FormField id="u-start" label="Data de vinculação" required>
                  <Input
                    type="date"
                    value={link.start_date}
                    onChange={(e) => setLink({ ...link, start_date: e.target.value })}
                  />
                </FormField>
              </>
            )}
            <FormField id="u-status" label="Situação" required>
              <NativeSelect value={v.status} onChange={set("status")}>
                <option value="active">Ativa</option>
                <option value="inactive">Inativa</option>
              </NativeSelect>
            </FormField>
            <FormField id="u-notes" label="Observações" className="sm:col-span-2">
              <Textarea rows={2} value={v.notes} onChange={set("notes")} />
            </FormField>
            {unit && (
              <FormField id="u-reason" label="Justificativa" required className="sm:col-span-2">
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              </FormField>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              {unit ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
