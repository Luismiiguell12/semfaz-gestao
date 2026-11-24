"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { FullPageLoading, InlineAlert } from "@/components/shared/states";
import { getSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { totpCodeSchema } from "@/schemas/auth";
import { useAuth } from "@/providers/auth-provider";

type Values = z.infer<typeof totpCodeSchema>;
interface Enrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

/**
 * Verificação em duas etapas (TOTP). Obrigatória para administradores e exigida
 * de quem já cadastrou o MFA. Eleva a sessão para AAL2.
 */
export default function MfaPage() {
  const router = useRouter();
  const { session, access, refreshAccess, signOut } = useAuth();
  const supabase = getSupabase();
  const [mode, setMode] = React.useState<"loading" | "enroll" | "verify">("loading");
  const [enrollment, setEnrollment] = React.useState<Enrollment>();
  const [factorId, setFactorId] = React.useState<string>();
  const [error, setError] = React.useState<string>();
  const form = useForm<Values>({ resolver: zodResolver(totpCodeSchema), defaultValues: { code: "" } });

  React.useEffect(() => {
    if (session === null) router.replace("/login/");
  }, [session, router]);

  React.useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (err) {
        setError(errorMessage(err));
        return;
      }
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) {
        setFactorId(verified.id);
        setMode("verify");
        return;
      }
      // Remove cadastros iniciados e não concluídos antes de gerar um novo QR code.
      for (const f of data.all.filter((f) => f.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const enroll = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `SEMFAZ ${new Date().toISOString().slice(0, 10)}` });
      if (cancelled) return;
      if (enroll.error) {
        setError(errorMessage(enroll.error));
        return;
      }
      setEnrollment({ factorId: enroll.data.id, qrCode: enroll.data.totp.qr_code, secret: enroll.data.totp.secret });
      setFactorId(enroll.data.id);
      setMode("enroll");
    })();
    return () => {
      cancelled = true;
    };
  }, [session, supabase]);

  async function onSubmit({ code }: Values) {
    if (!factorId) return;
    setError(undefined);
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (err) {
      setError(errorMessage(err, "Código inválido. Tente novamente."));
      form.reset({ code: "" });
      return;
    }
    await refreshAccess();
    router.replace("/");
  }

  if (!session || mode === "loading") {
    return error ? <InlineAlert tone="danger">{error}</InlineAlert> : <FullPageLoading label="Preparando verificação" />;
  }

  return (
    <div>
      <ShieldCheck className="mb-3 size-8 text-brand" aria-hidden="true" />
      <h1 className="text-2xl font-bold text-brand">Verificação em duas etapas</h1>
      {mode === "enroll" ? (
        <>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {access?.is_admin
              ? "Obrigatória para administradores. "
              : "Recomendada para proteger sua conta. "}
            Leia o QR code com um aplicativo autenticador (por exemplo, Google Authenticator ou Microsoft Authenticator) e informe o código gerado.
          </p>
          {enrollment && (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border bg-surface p-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enrollment.qrCode} alt="QR code para cadastrar o SEMFAZ Gestão no aplicativo autenticador" className="size-44 bg-white p-2" />
              <div className="w-full text-center">
                <p className="text-xs text-muted-foreground">Ou digite a chave manualmente:</p>
                <code className="mt-1 block font-mono text-sm break-all select-all">{enrollment.secret}</code>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="mt-1.5 text-sm text-muted-foreground">Informe o código de 6 dígitos exibido no seu aplicativo autenticador.</p>
      )}
      <form className="mt-6 space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        <FormField id="code" label="Código de verificação" required error={form.formState.errors.code?.message}>
          <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus className="tabular text-lg tracking-[0.3em]" {...form.register("code")} />
        </FormField>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          {mode === "enroll" ? "Ativar verificação" : "Verificar"}
        </Button>
      </form>
      {mode === "enroll" && !access?.is_admin && (
        <Button variant="link" className="mt-4 w-full" onClick={() => router.replace("/")}>
          Configurar depois
        </Button>
      )}
      <Button
        variant="link"
        className="mt-2 w-full text-muted-foreground"
        onClick={async () => {
          await signOut();
          router.replace("/login/");
        }}
      >
        Sair
      </Button>
    </div>
  );
}
