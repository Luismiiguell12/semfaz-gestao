"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { InlineAlert } from "@/components/shared/states";
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
import { landlordSchema, type LandlordInput } from "@shared/schemas/properties.ts";
import { formatCpfCnpj, formatPhone, onlyDigits } from "@shared/schemas/br.ts";
import { findLandlordByDocument, useSaveLandlord, type FoundLandlord, type Landlord } from "./api";

/** Exibição logo após o cadastro, com a mesma regra do banco: CPF mascarado; CNPJ (dado público) completo. */
function maskDocument(type: "individual" | "company", doc: string): string {
  const d = onlyDigits(doc);
  return type === "individual" ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : formatCpfCnpj(d);
}

export function LandlordDialog({
  editing,
  open,
  onOpenChange,
  onSaved,
  onUseExisting,
}: {
  editing: Landlord | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Chamado com o locador gravado (id e dados exibíveis). */
  onSaved?: (l: FoundLandlord) => void;
  /** Quando informado, o aviso de CPF/CNPJ já cadastrado oferece usar o cadastro existente. */
  onUseExisting?: (l: FoundLandlord) => void;
}) {
  const save = useSaveLandlord();
  const [error, setError] = React.useState<string>();
  const [reason, setReason] = React.useState("");
  const [existing, setExisting] = React.useState<FoundLandlord | null>(null);
  const form = useForm<LandlordInput>({
    resolver: zodResolver(landlordSchema),
    defaultValues: editing
      ? {
          person_type: editing.person_type,
          name: editing.name,
          document: "",
          phone: "",
          email: editing.email ?? "",
          address: editing.address ?? "",
          notes: editing.notes ?? "",
        }
      : { person_type: "individual", name: "", document: "", phone: "", email: "", address: "", notes: "" },
  });
  const type = form.watch("person_type");
  const errors = form.formState.errors;

  async function onSubmit(values: LandlordInput) {
    setError(undefined);
    if (editing && reason.trim().length < 10) {
      setError("Informe a justificativa da alteração (mínimo de 10 caracteres).");
      return;
    }
    try {
      if (!editing) {
        // Evita duplicidade: o CPF/CNPJ já cadastrado é oferecido em vez de criar outro.
        const found = await findLandlordByDocument(values.document);
        if (found) {
          setExisting(found);
          return;
        }
      }
      const id = await save.mutateAsync({ id: editing?.id ?? null, values, reason: reason.trim() });
      toast.success(editing ? "Locador atualizado." : "Locador cadastrado.");
      onSaved?.({
        id,
        name: values.name.trim(),
        person_type: values.person_type,
        document_masked: maskDocument(values.person_type, values.document),
      });
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="contents">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar locador" : "Novo locador"}</DialogTitle>
            <DialogDescription>
              Dados bancários não são armazenados. CPF e telefone ficam mascarados por padrão.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            {error && (
              <InlineAlert tone="danger" className="sm:col-span-2">
                {error}
              </InlineAlert>
            )}
            {existing && (
              <InlineAlert tone="warning" className="sm:col-span-2" title="CPF/CNPJ já cadastrado">
                <p>
                  {existing.name} ({existing.document_masked}) já está cadastrado. Para não duplicar o
                  locador, use o cadastro existente.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {onUseExisting ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        onUseExisting(existing);
                        onOpenChange(false);
                      }}
                    >
                      Usar o cadastro existente
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/locadores/detalhe/?id=${existing.id}`}>Abrir a ficha do locador</Link>
                    </Button>
                  )}
                </div>
              </InlineAlert>
            )}
            {editing && (
              <InlineAlert tone="info" className="sm:col-span-2">
                Por proteção de dados, informe novamente o CPF/CNPJ e o telefone ao editar.
              </InlineAlert>
            )}
            <FormField id="l-type" label="Tipo de pessoa" required>
              <NativeSelect {...form.register("person_type")}>
                <option value="individual">Pessoa física</option>
                <option value="company">Pessoa jurídica</option>
              </NativeSelect>
            </FormField>
            <FormField
              id="l-doc"
              label={type === "individual" ? "CPF" : "CNPJ"}
              required
              error={errors.document?.message}
            >
              <Input
                {...form.register("document", {
                  onChange: (e) => {
                    setExisting(null);
                    form.setValue("document", formatCpfCnpj(e.target.value));
                  },
                })}
                inputMode="numeric"
                autoComplete="off"
              />
            </FormField>
            <FormField
              id="l-name"
              label={type === "individual" ? "Nome" : "Razão social"}
              required
              error={errors.name?.message}
              className="sm:col-span-2"
            >
              <Input {...form.register("name")} autoComplete="off" />
            </FormField>
            <FormField id="l-phone" label="Telefone" error={errors.phone?.message}>
              <Input
                {...form.register("phone", {
                  onChange: (e) => form.setValue("phone", formatPhone(e.target.value)),
                })}
                inputMode="tel"
                autoComplete="off"
              />
            </FormField>
            <FormField id="l-email" label="E-mail" error={errors.email?.message}>
              <Input type="email" {...form.register("email")} autoComplete="off" />
            </FormField>
            <FormField
              id="l-address"
              label="Endereço"
              className="sm:col-span-2"
              error={errors.address?.message}
            >
              <Input {...form.register("address")} autoComplete="off" />
            </FormField>
            <FormField
              id="l-notes"
              label="Observações"
              className="sm:col-span-2"
              error={errors.notes?.message}
            >
              <Textarea rows={2} {...form.register("notes")} />
            </FormField>
            {editing && (
              <FormField id="l-reason" label="Justificativa" required className="sm:col-span-2">
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              </FormField>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {editing ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
