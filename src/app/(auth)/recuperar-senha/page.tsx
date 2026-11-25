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
import { EmailCodeForm } from "@/components/auth/email-code-form";
import { getSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { recoverSchema } from "@/schemas/auth";

type Values = z.infer<typeof recoverSchema>;

export default function RecoverPasswordPage() {
  const [step, setStep] = React.useState<"email" | "code">("email");
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string>();
  const form = useForm<Values>({ resolver: zodResolver(recoverSchema), defaultValues: { email: "" } });

  async function onSubmit(values: Values) {
    setError(undefined);
    const { error: err } = await getSupabase().auth.resetPasswordForEmail(values.email);
    // Resposta idêntica exista ou não a conta (não revela e-mails cadastrados).
    if (err && err.code?.startsWith("over_")) {
      setError(errorMessage(err));
      return;
    }
    setEmail(values.email);
    setStep("code");
  }

  return (
    <div>
      <h1 className="text-brand text-2xl font-bold">Recuperar senha</h1>
      {step === "email" ? (
        <>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Informe seu e-mail institucional. Enviaremos um código de 6 números para você criar uma nova
            senha.
          </p>
          <form className="mt-7 space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {error && <InlineAlert tone="danger">{error}</InlineAlert>}
            <FormField
              id="email"
              label="E-mail institucional"
              error={form.formState.errors.email?.message}
              required
            >
              <Input
                type="email"
                autoComplete="email"
                inputMode="email"
                autoFocus
                {...form.register("email")}
              />
            </FormField>
            <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
              Enviar código
            </Button>
          </form>
          <p className="mt-6 text-center text-sm">
            <button
              type="button"
              className="text-primary cursor-pointer font-medium hover:underline"
              onClick={() => setStep("code")}
            >
              Já tenho um código
            </button>
          </p>
        </>
      ) : (
        <>
          <InlineAlert tone="info" className="mt-6">
            Se o e-mail estiver cadastrado, você receberá um código de 6 números em alguns minutos. Confira
            também a caixa de spam.
          </InlineAlert>
          <div className="mt-6">
            <EmailCodeForm type="recovery" defaultEmail={email} submitLabel="Continuar" />
          </div>
          <p className="mt-6 text-center text-sm">
            <button
              type="button"
              className="text-primary cursor-pointer font-medium hover:underline"
              onClick={() => setStep("email")}
            >
              Enviar um novo código
            </button>
          </p>
        </>
      )}
      <p className="mt-2 text-center text-sm">
        <Link href="/login/" className="text-primary font-medium hover:underline">
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
