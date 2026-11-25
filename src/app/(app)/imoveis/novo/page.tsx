"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { FormField } from "@/components/shared/form-field";
import { InlineAlert } from "@/components/shared/states";
import { DepartmentSelect, UserSelect } from "@/components/shared/pickers";
import { RequirePermission } from "@/components/auth/route-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AddressFields } from "@/modules/properties/address-fields";
import { useRequestPropertyCreate } from "@/modules/properties/api";
import { propertyCreateSchema, type PropertyCreateInput } from "@shared/schemas/properties.ts";

function NewPropertyForm() {
  const router = useRouter();
  const request = useRequestPropertyCreate();
  const [error, setError] = React.useState<string>();
  const form = useForm<PropertyCreateInput>({
    resolver: zodResolver(propertyCreateSchema),
    defaultValues: {
      name: "",
      street: "",
      address_number: "",
      complement: "",
      district: "",
      postal_code: "",
      city: "Lagarto",
      state: "SE",
      department_id: "",
      unit_department_id: "",
      purpose: "",
      internal_responsible_id: "",
      occupation_date: "",
      status: "active",
      notes: "",
      justification: "",
    },
  });
  const errors = form.formState.errors;
  const departmentId = form.watch("department_id");

  async function onSubmit(values: PropertyCreateInput) {
    setError(undefined);
    const v = propertyCreateSchema.parse(values);
    const { justification, ...data } = v;
    try {
      const r = await request.mutateAsync({ data, justification });
      toast.success(r.status === "approved" ? "Imóvel cadastrado." : "Solicitação enviada para aprovação.");
      router.push(`/aprovacoes/detalhe/?id=${r.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <Button asChild variant="link" size="sm" className="mb-3">
        <Link href="/imoveis/">
          <ArrowLeft aria-hidden="true" /> Imóveis
        </Link>
      </Button>
      <PageHeader
        title="Solicitar cadastro de imóvel"
        description="O imóvel passa a constar no sistema depois da aprovação de um administrador."
      />
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        <Panel title="Identificação">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="p-name" label="Nome ou identificação" required error={errors.name?.message}>
              <Input {...form.register("name")} placeholder="Ex.: Sede da Secretaria" />
            </FormField>
            <FormField id="p-purpose" label="Finalidade" required error={errors.purpose?.message}>
              <Input {...form.register("purpose")} placeholder="Ex.: Atendimento ao contribuinte" />
            </FormField>
          </div>
        </Panel>
        <Panel title="Endereço">
          <AddressFields register={form.register} errors={errors} setValue={form.setValue} idPrefix="p" />
        </Panel>
        <Panel title="Responsabilidade">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="p-dept"
              label="Secretaria responsável"
              required
              error={errors.department_id?.message}
              hint="Define quem tem acesso ao imóvel."
            >
              <DepartmentSelect
                {...form.register("department_id", {
                  onChange: () => form.setValue("unit_department_id", ""),
                })}
              />
            </FormField>
            <FormField
              id="p-unit"
              label="Unidade administrativa"
              error={errors.unit_department_id?.message}
              hint="Opcional. Dentro da estrutura da secretaria."
            >
              <DepartmentSelect
                rootId={departmentId || null}
                emptyLabel="Não informada"
                disabled={!departmentId}
                {...form.register("unit_department_id")}
              />
            </FormField>
            <FormField
              id="p-resp"
              label="Responsável interno"
              error={errors.internal_responsible_id?.message}
            >
              <UserSelect {...form.register("internal_responsible_id")} />
            </FormField>
            <FormField id="p-date" label="Data de ocupação">
              <Input type="date" {...form.register("occupation_date")} />
            </FormField>
            <FormField id="p-status" label="Situação" required>
              <NativeSelect {...form.register("status")}>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="vacated">Desocupado</option>
              </NativeSelect>
            </FormField>
          </div>
          <FormField id="p-notes" label="Observações" className="mt-4" error={errors.notes?.message}>
            <Textarea rows={3} {...form.register("notes")} />
          </FormField>
        </Panel>
        <Panel title="Justificativa da solicitação">
          <FormField
            id="p-just"
            label="Justificativa"
            required
            error={errors.justification?.message}
            hint="Será analisada pelo administrador e registrada na auditoria."
          >
            <Textarea rows={3} {...form.register("justification")} />
          </FormField>
          <p className="text-muted-foreground mt-3 text-xs">
            Fotografias e documentos podem ser anexados no detalhe do imóvel depois da aprovação, ou nesta
            solicitação.
          </p>
        </Panel>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={form.formState.isSubmitting}>
            Enviar para aprovação
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/imoveis/")}>
            Cancelar
          </Button>
        </div>
      </form>
    </>
  );
}

export default function NewPropertyPage() {
  return (
    <RequirePermission permission="properties.create">
      <NewPropertyForm />
    </RequirePermission>
  );
}
