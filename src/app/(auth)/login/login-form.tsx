"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { InlineAlert } from "@/components/shared/states";
import { getSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { loginSchema, safeNextPath } from "@/schemas/auth";
import { useAuth } from "@/providers/auth-provider";

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const { session } = useAuth();
  const [error, setError] = React.useState<string>();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  React.useEffect(() => {
    if (session) router.replace(next);
  }, [session, next, router]);

  async function onSubmit(values: LoginValues) {
    setError(undefined);
    const { error: err } = await getSupabase().auth.signInWithPassword(values);
    if (err) {
      setError(errorMessage(err, "Não foi possível entrar. Tente novamente."));
      return;
    }
    // O guarda de rotas envia para o MFA, quando necessário.
    router.replace(next);
  }

  return (
    <div>
      <h1 className="text-brand text-2xl font-bold">Entrar</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">Use seu e-mail institucional e sua senha.</p>
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
            autoComplete="username"
            inputMode="email"
            autoFocus
            {...form.register("email")}
          />
        </FormField>
        <FormField id="password" label="Senha" error={form.formState.errors.password?.message} required>
          <Input type="password" autoComplete="current-password" {...form.register("password")} />
        </FormField>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          Entrar
        </Button>
      </form>
      <div className="mt-6 flex flex-col items-center gap-2 text-sm">
        <Link href="/recuperar-senha/" className="text-primary font-medium hover:underline">
          Esqueci minha senha
        </Link>
        <Link href="/primeiro-acesso/" className="text-primary font-medium hover:underline">
          Primeiro acesso (recebi um código por e-mail)
        </Link>
      </div>
    </div>
  );
}
