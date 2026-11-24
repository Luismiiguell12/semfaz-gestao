"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { ErrorState, FullPageLoading, InlineAlert } from "@/components/shared/states";
import { FormField } from "@/components/shared/form-field";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminUsers, useResendInvite, useSetUserAccess, useSetUserStatus, useUpdateUser, USER_STATUS_LABEL, type AdminUser, type UserStatus } from "@/modules/users/api";
import { RolePicker, ScopePicker, UserStatusBadge } from "@/modules/users/components";
import { useRoles } from "@/modules/roles/api";
import { toTree, useDepartments } from "@/modules/departments/api";
import { updateUserSchema, type UpdateUserInput } from "@shared/schemas/users.ts";
import { useAuth } from "@/providers/auth-provider";
import { formatDateTime } from "@/lib/format";

function ProfileForm({ user }: { user: AdminUser }) {
  const update = useUpdateUser();
  const departments = useDepartments();
  const tree = React.useMemo(() => toTree(departments.data ?? []), [departments.data]);
  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      user_id: user.id,
      full_name: user.full_name,
      username: user.username,
      employee_number: user.employee_number ?? "",
      job_title: user.job_title ?? "",
      department_id: user.department_id ?? "",
      reason: "",
    },
  });
  const errors = form.formState.errors;

  async function onSubmit(values: UpdateUserInput) {
    try {
      await update.mutateAsync(values);
      toast.success("Dados atualizados.");
      form.setValue("reason", "");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <FormField id="u-name" label="Nome completo" required error={errors.full_name?.message} className="sm:col-span-2">
        <Input {...form.register("full_name")} />
      </FormField>
      <FormField id="u-username" label="Nome de usuário" required error={errors.username?.message}>
        <Input {...form.register("username")} />
      </FormField>
      <FormField id="u-email" label="E-mail institucional" hint="O e-mail de login não é alterado por aqui.">
        <Input value={user.email} readOnly disabled />
      </FormField>
      <FormField id="u-employee" label="Matrícula funcional" error={errors.employee_number?.message}>
        <Input {...form.register("employee_number")} />
      </FormField>
      <FormField id="u-job" label="Cargo" error={errors.job_title?.message}>
        <Input {...form.register("job_title")} />
      </FormField>
      <FormField id="u-dept" label="Lotação (setor)" className="sm:col-span-2">
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
      <FormField id="u-reason" label="Justificativa" required error={errors.reason?.message} className="sm:col-span-2" hint="Registrada na auditoria.">
        <Textarea rows={2} {...form.register("reason")} />
      </FormField>
      <div className="sm:col-span-2">
        <Button type="submit" loading={form.formState.isSubmitting}>
          Salvar dados
        </Button>
      </div>
    </form>
  );
}

function AccessForm({ user }: { user: AdminUser }) {
  const { access } = useAuth();
  const roles = useRoles();
  const departments = useDepartments();
  const tree = React.useMemo(() => toTree(departments.data ?? []), [departments.data]);
  const save = useSetUserAccess();
  const [roleIds, setRoleIds] = React.useState(user.roles.map((r) => r.id));
  const [deptIds, setDeptIds] = React.useState(user.department_access.map((d) => d.id));
  const [orgWide, setOrgWide] = React.useState(user.organization_wide_access);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const isSelf = access?.profile?.id === user.id;

  if (isSelf) {
    return <InlineAlert tone="info">Por segurança, você não pode alterar as próprias permissões ou escopos. Peça a outro administrador.</InlineAlert>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <RolePicker roles={roles.data ?? []} value={roleIds} onChange={setRoleIds} idPrefix="acc" disabledCodes={access?.is_admin ? [] : ["admin"]} />
        <div className="space-y-4">
          <div className="flex items-start gap-2.5">
            <Checkbox id="acc-orgwide" checked={orgWide} disabled={!access?.is_admin} onCheckedChange={(v) => setOrgWide(v === true)} className="mt-0.5" />
            <label htmlFor="acc-orgwide" className="cursor-pointer text-sm">
              <span className="font-medium">Acesso a toda a organização</span>
              <span className="block text-xs text-muted-foreground">Somente administradores alteram esta opção.</span>
            </label>
          </div>
          <ScopePicker departments={tree} value={deptIds} onChange={setDeptIds} idPrefix="acc" />
        </div>
      </div>
      <Button onClick={() => (roleIds.length === 0 ? toast.error("Selecione pelo menos um perfil de acesso.") : setConfirmOpen(true))}>
        Salvar acesso
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Salvar perfis e escopo de acesso?"
        description={`As permissões de ${user.full_name} passam a valer imediatamente.`}
        confirmLabel="Salvar acesso"
        requireReason
        onConfirm={async (reason) => {
          try {
            await save.mutateAsync({ user_id: user.id, role_ids: roleIds, department_ids: deptIds, organization_wide_access: orgWide, reason });
            toast.success("Acesso atualizado.");
          } catch (e) {
            toast.error((e as Error).message);
            throw e;
          }
        }}
      />
    </div>
  );
}

function StatusSection({ user }: { user: AdminUser }) {
  const { access } = useAuth();
  const setStatus = useSetUserStatus();
  const resend = useResendInvite();
  const [target, setTarget] = React.useState<UserStatus | null>(null);
  const isSelf = access?.profile?.id === user.id;
  const options = (["active", "inactive", "blocked"] as UserStatus[]).filter((s) => s !== user.status);

  return (
    <div className="max-w-2xl space-y-5">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Situação</dt>
          <dd className="mt-1">
            <UserStatusBadge status={user.status} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Motivo registrado</dt>
          <dd className="mt-1">{user.status_reason ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Convite</dt>
          <dd className="tabular mt-1">{user.confirmed_at ? `Aceito em ${formatDateTime(user.confirmed_at)}` : `Enviado em ${formatDateTime(user.invited_at)}`}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Último acesso</dt>
          <dd className="tabular mt-1">{formatDateTime(user.last_sign_in_at)}</dd>
        </div>
      </dl>
      {isSelf ? (
        <InlineAlert tone="info">Você não pode alterar a própria situação.</InlineAlert>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((s) => (
            <Button key={s} variant={s === "active" ? "default" : "outline"} className={s === "blocked" ? "border-danger/40 text-danger hover:bg-danger-soft" : undefined} onClick={() => setTarget(s)}>
              {s === "active" ? "Reativar acesso" : s === "inactive" ? "Inativar" : "Bloquear"}
            </Button>
          ))}
          {!user.confirmed_at && (
            <Button
              variant="ghost"
              loading={resend.isPending}
              onClick={() => resend.mutate(user.id, { onSuccess: () => toast.success("Convite reenviado."), onError: (e) => toast.error(e.message) })}
            >
              <Mail aria-hidden="true" /> Reenviar convite
            </Button>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Usuário inativo ou bloqueado perde imediatamente o acesso aos dados, mesmo que esteja com uma sessão aberta. Nenhum registro é apagado.
      </p>
      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(v) => !v && setTarget(null)}
        title={target ? `Alterar situação para "${USER_STATUS_LABEL[target]}"?` : ""}
        confirmLabel="Confirmar"
        tone={target === "active" ? "default" : "destructive"}
        requireReason
        onConfirm={async (reason) => {
          try {
            const res = await setStatus.mutateAsync({ user_id: user.id, status: target!, reason });
            if (res.warning) toast.warning(res.warning);
            else toast.success("Situação alterada.");
          } catch (e) {
            toast.error((e as Error).message);
            throw e;
          }
        }}
      />
    </div>
  );
}

export function UserDetail() {
  const id = useSearchParams().get("id");
  const users = useAdminUsers();
  const user = users.data?.find((u) => u.id === id);

  if (users.isLoading) return <FullPageLoading />;
  if (users.isError) return <ErrorState message={users.error.message} onRetry={() => users.refetch()} />;
  if (!user) {
    return (
      <ErrorState
        title="Usuário não encontrado."
        message="O endereço pode estar incompleto ou o usuário não pertence à sua organização."
      />
    );
  }

  return (
    <>
      <Button asChild variant="link" size="sm" className="mb-3">
        <Link href="/administracao/usuarios/">
          <ArrowLeft aria-hidden="true" /> Usuários
        </Link>
      </Button>
      <PageHeader title={user.full_name} description={`${user.username}, ${user.email}`} actions={<UserStatusBadge status={user.status} />} />
      <Panel bodyClassName="pt-1">
        <Tabs defaultValue="dados">
          <TabsList>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="acesso">Perfis e escopo</TabsTrigger>
            <TabsTrigger value="situacao">Situação</TabsTrigger>
          </TabsList>
          <TabsContent value="dados">
            <ProfileForm user={user} />
          </TabsContent>
          <TabsContent value="acesso">
            <AccessForm user={user} />
          </TabsContent>
          <TabsContent value="situacao">
            <StatusSection user={user} />
          </TabsContent>
        </Tabs>
      </Panel>
    </>
  );
}
