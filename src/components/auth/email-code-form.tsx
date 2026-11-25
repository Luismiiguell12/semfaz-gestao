"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { InlineAlert } from "@/components/shared/states";
import { getSupabase } from "@/lib/supabase/client";
import { emailCodeSchema } from "@/schemas/auth";

type Values = z.infer<typeof emailCodeSchema>;

const CODE_ERRORS: Record<string, string> = {
  otp_expired: "Código inválido ou expirado. Confira os números ou solicite um novo código.",
  invalid_credentials: "Código inválido ou expirado. Confira os números ou solicite um novo código.",
  over_request_rate_limit: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
};

/**
 * Validação por código de 6 números enviado por e-mail (convite ou recuperação).
 * Evita links de uso único, que podem ser "gastos" por pré-visualizações de e-mail.
 */
export function EmailCodeForm({
  type,
  defaultEmail = "",
  submitLabel,
}: {
  type: "invite" | "recovery";
  defaultEmail?: string;
  submitLabel: string;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string>();
  const form = useForm<Values>({
    resolver: zodResolver(emailCodeSchema),
    defaultValues: { email: defaultEmail, code: "" },
  });

  async function onSubmit({ email, code }: Values) {
    setError(undefined);
    const supabase = getSupabase();
    // Uma sessão anterior no mesmo navegador não pode interferir.
    await supabase.auth.signOut({ scope: "local" });
    const { error: err } = await supabase.auth.verifyOtp({ email, token: code, type });
    if (err) {
      setError(
        CODE_ERRORS[err.code ?? ""] ??
          "Código inválido ou expirado. Confira os números ou solicite um novo código.",
      );
      form.setValue("code", "");
      return;
    }
    router.replace("/definir-senha/");
  }

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {error && <InlineAlert tone="danger">{error}</InlineAlert>}
      <FormField
        id="code-email"
        label="E-mail institucional"
        required
        error={form.formState.errors.email?.message}
      >
        <Input type="email" autoComplete="username" inputMode="email" {...form.register("email")} />
      </FormField>
      <FormField
        id="code-value"
        label="Código recebido por e-mail"
        required
        error={form.formState.errors.code?.message}
        hint="6 números. O código vale por 1 hora."
      >
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          className="tabular text-lg tracking-[0.3em]"
          {...form.register("code")}
        />
      </FormField>
      <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
