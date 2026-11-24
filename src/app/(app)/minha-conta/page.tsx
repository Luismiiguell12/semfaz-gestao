"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { FormField } from "@/components/shared/form-field";
import { InlineAlert, LoadingRows } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/providers/auth-provider";
import { getSupabase } from "@/lib/supabase/client";
import { errorMessage, toAppError } from "@/lib/errors";
import { newPasswordSchema } from "@/schemas/auth";
import { useDepartments } from "@/modules/departments/api";

type PasswordValues = z.infer<typeof newPasswordSchema>;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-words">{children}</dd>
    </div>
  );
}

function NotificationPreferences() {
  const { access } = useAuth();
  const qc = useQueryClient();
  const supabase = getSupabase();
  const prefs = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: async () => {
      const [types, mine] = await Promise.all([
        supabase.from("notification_types").select("*").eq("is_available", true).order("description"),
        supabase.from("notification_preferences").select("*"),
      ]);
      if (types.error) throw toAppError(types.error);
      if (mine.error) throw toAppError(mine.error);
      return { types: types.data, mine: new Map(mine.data.map((p) => [p.type_code, p])) };
    },
  });
  const save = useMutation({
    mutationFn: async ({ code, inApp }: { code: string; inApp: boolean }) => {
      const existing = prefs.data?.mine.get(code);
      const res = existing
        ? await supabase.from("notification_preferences").update({ in_app: inApp }).eq("id", existing.id)
        : await supabase.from("notification_preferences").insert({
            organization_id: access!.profile!.organization_id,
            user_id: access!.profile!.id,
            type_code: code,
            in_app: inApp,
          });
      if (res.error) throw toAppError(res.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-preferences"] }),
    onError: (e) => toast.error(e.message),
  });

  if (prefs.isLoading) return <LoadingRows rows={2} />;
  if (!prefs.data) return null;
  return (
    <div>
      <ul className="divide-y">
        {prefs.data.types.map((t) => {
          const inApp = prefs.data.mine.get(t.code)?.in_app ?? t.default_in_app;
          const id = `pref-${t.code}`;
          return (
            <li key={t.code} className="flex items-center gap-3 py-3">
              <Checkbox id={id} checked={inApp} onCheckedChange={(v) => save.mutate({ code: t.code, inApp: v === true })} />
              <label htmlFor={id} className="cursor-pointer text-sm">
                {t.description}
              </label>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        O envio por e-mail será disponibilizado em versão futura. Novos tipos de aviso aparecem aqui quando os módulos forem liberados.
      </p>
    </div>
  );
}

export default function MyAccountPage() {
  const { access, session } = useAuth();
  const departments = useDepartments();
  const [pwError, setPwError] = React.useState<string>();
  const form = useForm<PasswordValues>({ resolver: zodResolver(newPasswordSchema), defaultValues: { password: "", confirm: "" } });
  const p = access?.profile;
  const deptName = (id: string) => departments.data?.find((d) => d.id === id)?.name ?? "—";
  const scopeQuery = useQuery({
    queryKey: ["my-scope", p?.id],
    enabled: Boolean(p?.id),
    queryFn: async () => {
      const { data, error } = await getSupabase().from("user_department_access").select("department_id").eq("user_id", p!.id);
      if (error) throw toAppError(error);
      return data.map((r) => r.department_id);
    },
  });

  async function onChangePassword({ password }: PasswordValues) {
    setPwError(undefined);
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) {
      setPwError(errorMessage(error, "Não foi possível alterar a senha."));
      return;
    }
    form.reset();
    toast.success("Senha alterada.");
  }

  return (
    <>
      <PageHeader title="Minha conta" description="Seus dados funcionais, perfis de acesso e segurança da conta." />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <Panel title="Dados funcionais" description="Alterações são feitas por um administrador.">
            <dl className="divide-y">
              <Row label="Nome">{p?.full_name}</Row>
              <Row label="E-mail institucional">{p?.email}</Row>
              <Row label="Nome de usuário">{p?.username}</Row>
              <Row label="Cargo">{p?.job_title ?? "—"}</Row>
              <Row label="Lotação">{access?.department?.name ?? "—"}</Row>
              <Row label="Perfis de acesso">
                <span className="flex flex-wrap gap-1.5">
                  {access?.roles?.map((r) => (
                    <Badge key={r.id} tone={r.code === "admin" ? "brand" : "neutral"}>
                      {r.name}
                    </Badge>
                  ))}
                </span>
              </Row>
              <Row label="Escopo de acesso">
                {p?.organization_wide_access || access?.is_admin
                  ? "Toda a organização"
                  : scopeQuery.data && scopeQuery.data.length > 0
                    ? scopeQuery.data.map(deptName).join(", ")
                    : "Somente registros em que você participa"}
              </Row>
            </dl>
          </Panel>
          <Panel title="Avisos no sistema" description="Escolha quais avisos aparecem no sino de notificações.">
            <NotificationPreferences />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Verificação em duas etapas">
            {access?.mfa?.enrolled ? (
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
                <p className="text-sm">
                  Ativa. Sua sessão atual está {access.mfa.current_aal === "aal2" ? "verificada" : "pendente de verificação"}.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <ShieldOff className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
                  <p className="text-sm">
                    Não configurada. {access?.is_admin ? "Obrigatória para o seu perfil." : "Recomendada, especialmente para gestores."}
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href="/mfa/">Configurar verificação</Link>
                </Button>
              </div>
            )}
          </Panel>

          <Panel title="Alterar senha">
            <form className="space-y-4" onSubmit={form.handleSubmit(onChangePassword)} noValidate>
              {pwError && <InlineAlert tone="danger">{pwError}</InlineAlert>}
              <input type="email" autoComplete="username" value={session?.user.email ?? ""} readOnly hidden />
              <FormField id="new-password" label="Nova senha" required error={form.formState.errors.password?.message} hint="Mínimo de 10 caracteres, com maiúsculas, minúsculas e números.">
                <Input type="password" autoComplete="new-password" {...form.register("password")} />
              </FormField>
              <FormField id="confirm-password" label="Confirmar nova senha" required error={form.formState.errors.confirm?.message}>
                <Input type="password" autoComplete="new-password" {...form.register("confirm")} />
              </FormField>
              <Button type="submit" loading={form.formState.isSubmitting}>
                Alterar senha
              </Button>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
