"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { FormField } from "@/components/shared/form-field";
import { InlineAlert } from "@/components/shared/states";
import { inviteUserSchema, type InviteUserInput } from "@shared/schemas/users.ts";
import { useInviteUser } from "@/modules/users/api";
import { useRoles } from "@/modules/roles/api";
import { toTree, useDepartments } from "@/modules/departments/api";
import { RolePicker, ScopePicker } from "@/modules/users/components";
import { useAuth } from "@/providers/auth-provider";

export function InviteUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { access } = useAuth();
  const invite = useInviteUser();
  const roles = useRoles();
  const departments = useDepartments();
  const tree = React.useMemo(() => toTree(departments.data ?? []), [departments.data]);
  const [error, setError] = React.useState<string>();
  const form = useForm<InviteUserInput>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      full_name: "",
      email: "",
      username: "",
      employee_number: "",
      job_title: "",
      department_id: "",
      role_ids: [],
      department_ids: [],
      organization_wide_access: false,
    },
  });

  React.useEffect(() => {
    if (!open) {
      form.reset();
      setError(undefined);
    }
  }, [open, form]);

  async function onSubmit(values: InviteUserInput) {
    setError(undefined);
    try {
      await invite.mutateAsync(values);
      toast.success("Convite enviado por e-mail.");
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
            <DialogTitle>Convidar usuário</DialogTitle>
            <DialogDescription>
              A pessoa recebe um e-mail para definir a senha. Não há cadastro público no sistema.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">
            {error && <InlineAlert tone="danger">{error}</InlineAlert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="inv-name"
                label="Nome completo"
                required
                error={errors.full_name?.message}
                className="sm:col-span-2"
              >
                <Input {...form.register("full_name")} autoComplete="off" />
              </FormField>
              <FormField
                id="inv-email"
                label="E-mail institucional"
                required
                error={errors.email?.message}
                hint="Usado para o login."
              >
                <Input type="email" {...form.register("email")} autoComplete="off" />
              </FormField>
              <FormField
                id="inv-username"
                label="Nome de usuário"
                required
                error={errors.username?.message}
                hint="Identificador de exibição, ex.: maria.souza"
              >
                <Input {...form.register("username")} autoComplete="off" />
              </FormField>
              <FormField
                id="inv-employee"
                label="Matrícula funcional"
                error={errors.employee_number?.message}
              >
                <Input {...form.register("employee_number")} />
              </FormField>
              <FormField id="inv-job" label="Cargo" error={errors.job_title?.message}>
                <Input {...form.register("job_title")} />
              </FormField>
              <FormField
                id="inv-dept"
                label="Lotação (setor)"
                error={errors.department_id?.message}
                className="sm:col-span-2"
              >
                <NativeSelect {...form.register("department_id")}>
                  <option value="">Não informada</option>
                  {tree.map((d) => (
                    <option key={d.id} value={d.id}>
                      {"  ".repeat(d.depth)}
                      {d.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Controller
                  control={form.control}
                  name="role_ids"
                  render={({ field }) => (
                    <RolePicker
                      roles={roles.data ?? []}
                      value={field.value}
                      onChange={field.onChange}
                      idPrefix="inv"
                      disabledCodes={access?.is_admin ? [] : ["admin"]}
                    />
                  )}
                />
                {errors.role_ids && (
                  <p className="text-danger mt-1 text-xs font-medium">{errors.role_ids.message}</p>
                )}
              </div>
              <div className="space-y-3">
                {access?.is_admin && (
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id="inv-orgwide"
                      checked={form.watch("organization_wide_access")}
                      onCheckedChange={(v) => form.setValue("organization_wide_access", v === true)}
                      className="mt-0.5"
                    />
                    <label htmlFor="inv-orgwide" className="cursor-pointer text-sm">
                      <span className="font-medium">Acesso a toda a organização</span>
                      <span className="text-muted-foreground block text-xs">
                        Todos os departamentos, atuais e futuros.
                      </span>
                    </label>
                  </div>
                )}
                <Controller
                  control={form.control}
                  name="department_ids"
                  render={({ field }) => (
                    <ScopePicker
                      departments={tree}
                      value={field.value ?? []}
                      onChange={field.onChange}
                      idPrefix="inv"
                    />
                  )}
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Enviar convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
