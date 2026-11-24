"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { InlineAlert } from "@/components/shared/states";
import { getSupabase } from "@/lib/supabase/client";
import { appUrl } from "@/lib/env";
import { errorMessage } from "@/lib/errors";
import { recoverSchema } from "@/schemas/auth";

type Values = z.infer<typeof recoverSchema>;

export default function RecoverPasswordPage() {
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const form = useForm<Values>({ resolver: zodResolver(recoverSchema), defaultValues: { email: "" } });

  async function onSubmit({ email }: Values) {
    setError(undefined);
    const { error: err } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: appUrl("/auth/confirmar/"),
    });
    // Resposta idêntica exista ou não a conta (não revela e-mails cadastrados).
    if (err && err.code?.startsWith("over_")) {
      setError(errorMessage(err));
      return;
    }
    setSent(true);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand">Recuperar senha</h1>
      {sent ? (
        <InlineAlert tone="success" className="mt-6" title="Verifique seu e-mail">
          Se o endereço estiver cadastrado, você receberá um link para definir uma nova senha. O link expira em 1 hora.
        </InlineAlert>
      ) : (
        <>
          <p className="mt-1.5 text-sm text-muted-foreground">Informe seu e-mail institucional para receber o link de redefinição.</p>
          <form className="mt-7 space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {error && <InlineAlert tone="danger">{error}</InlineAlert>}
            <FormField id="email" label="E-mail institucional" error={form.formState.errors.email?.message} required>
              <Input type="email" autoComplete="email" inputMode="email" autoFocus {...form.register("email")} />
            </FormField>
            <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
              Enviar link
            </Button>
          </form>
        </>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login/" className="font-medium text-primary hover:underline">
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
