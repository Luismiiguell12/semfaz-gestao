"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { FullPageLoading, InlineAlert } from "@/components/shared/states";
import { getSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { newPasswordSchema } from "@/schemas/auth";
import { useAuth } from "@/providers/auth-provider";

type Values = z.infer<typeof newPasswordSchema>;

export default function SetPasswordPage() {
  const router = useRouter();
  const { session, refreshAccess } = useAuth();
  const [error, setError] = React.useState<string>();
  const form = useForm<Values>({ resolver: zodResolver(newPasswordSchema), defaultValues: { password: "", confirm: "" } });

  React.useEffect(() => {
    if (session === null) router.replace("/login/");
  }, [session, router]);

  async function onSubmit({ password }: Values) {
    setError(undefined);
    const { error: err } = await getSupabase().auth.updateUser({ password });
    if (err) {
      setError(errorMessage(err, "Não foi possível definir a senha."));
      return;
    }
    toast.success("Senha definida.");
    await refreshAccess();
    router.replace("/");
  }

  if (!session) return <FullPageLoading />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand">Definir senha</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Conta: <span className="font-medium text-foreground">{session.user.email}</span>
      </p>
      <form className="mt-7 space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        <FormField
          id="password"
          label="Nova senha"
          required
          error={form.formState.errors.password?.message}
          hint="Mínimo de 10 caracteres, com letras maiúsculas, minúsculas e números."
        >
          <Input type="password" autoComplete="new-password" autoFocus {...form.register("password")} />
        </FormField>
        <FormField id="confirm" label="Confirmar nova senha" required error={form.formState.errors.confirm?.message}>
          <Input type="password" autoComplete="new-password" {...form.register("confirm")} />
        </FormField>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          Salvar senha
        </Button>
      </form>
    </div>
  );
}
