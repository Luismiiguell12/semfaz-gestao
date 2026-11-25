"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { DepartmentSelect, UserSelect } from "@/components/shared/pickers";
import { AddressFields } from "@/modules/properties/address-fields";
import {
  useRequestAddressChange,
  useRequestDepartmentChange,
  useUpdatePropertyDetails,
  type Property,
} from "@/modules/properties/api";
import { addressSchema, propertyDetailsSchema } from "@shared/schemas/properties.ts";
import { reasonSchema } from "@shared/schemas/common.ts";

const addressRequestSchema = addressSchema.extend({ justification: reasonSchema });
type AddressRequest = z.input<typeof addressRequestSchema>;

export function AddressChangeDialog({
  property,
  open,
  onOpenChange,
}: {
  property: Property;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const request = useRequestAddressChange();
  const [error, setError] = React.useState<string>();
  const form = useForm<AddressRequest>({
    resolver: zodResolver(addressRequestSchema),
    defaultValues: {
      street: property.street,
      address_number: property.address_number,
      complement: property.complement ?? "",
      district: property.district,
      postal_code: property.postal_code,
      city: property.city,
      state: property.state as AddressRequest["state"],
      justification: "",
    },
  });
  async function onSubmit(v: AddressRequest) {
    setError(undefined);
    const { justification, ...data } = addressRequestSchema.parse(v);
    try {
      const r = await request.mutateAsync({ id: property.id, data, justification });
      toast.success("Alteração de endereço enviada para aprovação.");
      onOpenChange(false);
      router.push(`/aprovacoes/detalhe/?id=${r.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="contents">
          <DialogHeader>
            <DialogTitle>Solicitar alteração de endereço</DialogTitle>
            <DialogDescription>O endereço só muda depois da aprovação de um administrador.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {error && <InlineAlert tone="danger">{error}</InlineAlert>}
            <AddressFields
              register={form.register}
              errors={form.formState.errors}
              setValue={form.setValue}
              idPrefix="addr"
            />
            <FormField
              id="addr-just"
              label="Justificativa"
              required
              error={form.formState.errors.justification?.message}
            >
              <Textarea rows={2} {...form.register("justification")} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Enviar para aprovação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const deptRequestSchema = z.object({
  department_id: z.uuid({ message: "Selecione a secretaria." }),
  unit_department_id: z.string().optional(),
  justification: reasonSchema,
});
type DeptRequest = z.input<typeof deptRequestSchema>;

export function DepartmentChangeDialog({
  property,
  open,
  onOpenChange,
}: {
  property: Property;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const request = useRequestDepartmentChange();
  const [error, setError] = React.useState<string>();
  const form = useForm<DeptRequest>({
    resolver: zodResolver(deptRequestSchema),
    defaultValues: {
      department_id: property.department_id,
      unit_department_id: property.unit_department_id ?? "",
      justification: "",
    },
  });
  const dept = form.watch("department_id");
  async function onSubmit(v: DeptRequest) {
    setError(undefined);
    try {
      const r = await request.mutateAsync({
        id: property.id,
        department_id: v.department_id,
        unit_department_id: v.unit_department_id || null,
        justification: v.justification,
      });
      toast.success("Alteração enviada para aprovação.");
      onOpenChange(false);
      router.push(`/aprovacoes/detalhe/?id=${r.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="contents">
          <DialogHeader>
            <DialogTitle>Solicitar alteração de secretaria</DialogTitle>
            <DialogDescription>Muda quem tem acesso ao imóvel. Exige aprovação.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {error && <InlineAlert tone="danger">{error}</InlineAlert>}
            <FormField
              id="dc-dept"
              label="Secretaria responsável"
              required
              error={form.formState.errors.department_id?.message}
            >
              <DepartmentSelect
                {...form.register("department_id", {
                  onChange: () => form.setValue("unit_department_id", ""),
                })}
              />
            </FormField>
            <FormField id="dc-unit" label="Unidade administrativa">
              <DepartmentSelect
                rootId={dept || null}
                emptyLabel="Não informada"
                {...form.register("unit_department_id")}
              />
            </FormField>
            <FormField
              id="dc-just"
              label="Justificativa"
              required
              error={form.formState.errors.justification?.message}
            >
              <Textarea rows={2} {...form.register("justification")} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Enviar para aprovação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const detailsFormSchema = propertyDetailsSchema.extend({ reason: reasonSchema });
type DetailsForm = z.input<typeof detailsFormSchema>;

export function DetailsDialog({
  property,
  open,
  onOpenChange,
}: {
  property: Property;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const update = useUpdatePropertyDetails();
  const [error, setError] = React.useState<string>();
  const form = useForm<DetailsForm>({
    resolver: zodResolver(detailsFormSchema),
    defaultValues: {
      name: property.name,
      purpose: property.purpose,
      internal_responsible_id: property.internal_responsible_id ?? "",
      occupation_date: property.occupation_date ?? "",
      status: property.status,
      notes: property.notes ?? "",
      reason: "",
    },
  });
  async function onSubmit(v: DetailsForm) {
    setError(undefined);
    const { reason, ...data } = detailsFormSchema.parse(v);
    try {
      await update.mutateAsync({ id: property.id, data, reason });
      toast.success("Dados do imóvel atualizados.");
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const errors = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="contents">
          <DialogHeader>
            <DialogTitle>Editar dados do imóvel</DialogTitle>
            <DialogDescription>
              Alteração direta, registrada na auditoria com a justificativa.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            {error && (
              <InlineAlert tone="danger" className="sm:col-span-2">
                {error}
              </InlineAlert>
            )}
            <FormField id="d-name" label="Nome ou identificação" required error={errors.name?.message}>
              <Input {...form.register("name")} />
            </FormField>
            <FormField id="d-purpose" label="Finalidade" required error={errors.purpose?.message}>
              <Input {...form.register("purpose")} />
            </FormField>
            <FormField id="d-resp" label="Responsável interno">
              <UserSelect {...form.register("internal_responsible_id")} />
            </FormField>
            <FormField id="d-date" label="Data de ocupação">
              <Input type="date" {...form.register("occupation_date")} />
            </FormField>
            <FormField id="d-status" label="Situação" required>
              <NativeSelect {...form.register("status")}>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="vacated">Desocupado</option>
              </NativeSelect>
            </FormField>
            <FormField id="d-notes" label="Observações" className="sm:col-span-2">
              <Textarea rows={3} {...form.register("notes")} />
            </FormField>
            <FormField
              id="d-reason"
              label="Justificativa"
              required
              error={errors.reason?.message}
              className="sm:col-span-2"
            >
              <Textarea rows={2} {...form.register("reason")} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Salvar alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
