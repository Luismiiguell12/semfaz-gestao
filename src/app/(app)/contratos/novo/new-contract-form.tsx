"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { FormField } from "@/components/shared/form-field";
import { InlineAlert } from "@/components/shared/states";
import { UserSelect } from "@/components/shared/pickers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProperties } from "@/modules/properties/api";
import { useLandlords } from "@/modules/landlords/api";
import { useContractLists, useRequestContractCreate } from "@/modules/contracts/api";
import { contractCreateSchema } from "@shared/schemas/contracts.ts";

// O formulário guarda tudo como texto; a validação completa usa o schema
// compartilhado (o mesmo das regras do banco) no envio, campo a campo.
const formSchema = z.object({
  property_id: z.string(),
  contract_number: z.string(),
  process_number: z.string(),
  modality_id: z.string(),
  object: z.string(),
  signed_on: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  global_value: z.string(),
  monthly_value: z.string(),
  adjustment_index_id: z.string(),
  base_date: z.string(),
  inspector_id: z.string(),
  manager_id: z.string(),
  notes: z.string(),
  justification: z.string(),
  landlords: z.array(z.object({ landlord_id: z.string(), share: z.string() })).min(1),
});
type FormValues = z.infer<typeof formSchema>;

export function NewContractForm() {
  const router = useRouter();
  const presetProperty = useSearchParams().get("imovel") ?? "";
  const properties = useProperties();
  const landlords = useLandlords();
  const lists = useContractLists();
  const request = useRequestContractCreate();
  const [error, setError] = React.useState<string>();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      property_id: presetProperty,
      contract_number: "",
      process_number: "",
      modality_id: "",
      object: "",
      signed_on: "",
      start_date: "",
      end_date: "",
      global_value: "",
      monthly_value: "",
      adjustment_index_id: "",
      base_date: "",
      inspector_id: "",
      manager_id: "",
      notes: "",
      justification: "",
      landlords: [{ landlord_id: "", share: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "landlords" });
  const errors = form.formState.errors;

  async function onSubmit(values: FormValues) {
    setError(undefined);
    const parsed = contractCreateSchema.safeParse({
      ...values,
      landlords: values.landlords.map((l) => ({
        landlord_id: l.landlord_id,
        share_percent: l.share.trim() ? Number(l.share.replace(",", ".")) : undefined,
      })),
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && field !== "landlords") {
          form.setError(field as keyof FormValues, { message: issue.message });
        }
      }
      const landlordIssue = parsed.error.issues.find((i) => i.path[0] === "landlords");
      setError(landlordIssue?.message ?? "Revise os campos destacados.");
      return;
    }
    const { justification, ...data } = parsed.data;
    try {
      const r = await request.mutateAsync({ data, justification });
      toast.success(r.status === "approved" ? "Contrato cadastrado." : "Solicitação enviada para aprovação.");
      router.push(`/aprovacoes/detalhe/?id=${r.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <Button asChild variant="link" size="sm" className="mb-3">
        <Link href="/contratos/">
          <ArrowLeft aria-hidden="true" /> Contratos
        </Link>
      </Button>
      <PageHeader
        title="Solicitar cadastro de contrato"
        description="O contrato passa a valer no sistema depois da aprovação de um administrador."
      />
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        <Panel title="Identificação">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="c-prop"
              label="Imóvel"
              required
              error={errors.property_id?.message}
              className="sm:col-span-2"
            >
              <NativeSelect {...form.register("property_id")}>
                <option value="">Selecione</option>
                {properties.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              id="c-number"
              label="Número do contrato"
              required
              error={errors.contract_number?.message}
            >
              <Input {...form.register("contract_number")} />
            </FormField>
            <FormField id="c-process" label="Processo administrativo" error={errors.process_number?.message}>
              <Input {...form.register("process_number")} />
            </FormField>
            <FormField id="c-modality" label="Modalidade">
              <NativeSelect {...form.register("modality_id")}>
                <option value="">Não informada</option>
                {lists.data?.modalities
                  .filter((m) => m.is_active)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </NativeSelect>
            </FormField>
            <FormField id="c-signed" label="Data de assinatura" required error={errors.signed_on?.message}>
              <Input type="date" {...form.register("signed_on")} />
            </FormField>
            <FormField
              id="c-object"
              label="Objeto"
              required
              error={errors.object?.message}
              className="sm:col-span-2"
            >
              <Textarea rows={2} {...form.register("object")} />
            </FormField>
          </div>
        </Panel>
        <Panel
          title="Vigência e valores"
          description="Valores em reais, com vírgula para os centavos (ex.: 1.234,56)."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField id="c-start" label="Início da vigência" required error={errors.start_date?.message}>
              <Input type="date" {...form.register("start_date")} />
            </FormField>
            <FormField id="c-end" label="Fim da vigência" required error={errors.end_date?.message}>
              <Input type="date" {...form.register("end_date")} />
            </FormField>
            <FormField
              id="c-monthly"
              label="Valor mensal (R$)"
              required
              error={errors.monthly_value?.message}
            >
              <Input inputMode="decimal" placeholder="0,00" {...form.register("monthly_value")} />
            </FormField>
            <FormField id="c-global" label="Valor global (R$)" required error={errors.global_value?.message}>
              <Input inputMode="decimal" placeholder="0,00" {...form.register("global_value")} />
            </FormField>
            <FormField id="c-index" label="Índice de reajuste">
              <NativeSelect {...form.register("adjustment_index_id")}>
                <option value="">Não informado</option>
                {lists.data?.indexes
                  .filter((i) => i.is_active)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
              </NativeSelect>
            </FormField>
            <FormField
              id="c-base"
              label="Data-base"
              hint="Aniversário anual para reajuste (o sistema apenas alerta)."
            >
              <Input type="date" {...form.register("base_date")} />
            </FormField>
          </div>
        </Panel>
        <Panel
          title="Locadores"
          description="Com mais de um locador, informe o percentual de cada um (soma 100%)."
        >
          <div className="space-y-3">
            {fields.map((f, idx) => (
              <div key={f.id} className="grid items-end gap-3 sm:grid-cols-[1fr_9rem_auto]">
                <FormField
                  id={`c-ll-${idx}`}
                  label={`Locador ${idx + 1}`}
                  error={errors.landlords?.[idx]?.landlord_id?.message}
                >
                  <NativeSelect {...form.register(`landlords.${idx}.landlord_id`)}>
                    <option value="">Selecione</option>
                    {landlords.data?.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.document_masked})
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField id={`c-ll-share-${idx}`} label="Percentual (%)">
                  <Input inputMode="decimal" {...form.register(`landlords.${idx}.share`)} />
                </FormField>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={fields.length === 1}
                  onClick={() => remove(idx)}
                >
                  Remover
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ landlord_id: "", share: "" })}
            >
              <Plus aria-hidden="true" /> Adicionar locador
            </Button>
          </div>
        </Panel>
        <Panel title="Gestão do contrato">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="c-manager" label="Gestor do contrato">
              <UserSelect {...form.register("manager_id")} />
            </FormField>
            <FormField id="c-inspector" label="Fiscal do contrato">
              <UserSelect {...form.register("inspector_id")} />
            </FormField>
            <FormField id="c-notes" label="Observações" className="sm:col-span-2">
              <Textarea rows={2} {...form.register("notes")} />
            </FormField>
          </div>
        </Panel>
        <Panel title="Justificativa da solicitação">
          <FormField
            id="c-just"
            label="Justificativa"
            required
            error={errors.justification?.message}
            hint="O arquivo digital do contrato pode ser anexado na solicitação ou no detalhe do contrato."
          >
            <Textarea rows={3} {...form.register("justification")} />
          </FormField>
        </Panel>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={form.formState.isSubmitting}>
            Enviar para aprovação
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/contratos/")}>
            Cancelar
          </Button>
        </div>
      </form>
    </>
  );
}
