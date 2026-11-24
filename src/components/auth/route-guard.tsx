"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { FullPageLoading, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";

/**
 * Proteção de páginas no cliente: SOMENTE experiência de uso.
 * A proteção real dos dados é a RLS e as verificações das RPCs/Edge Functions.
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { session, access, accessLoading, accessError, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const mfaPending = Boolean(
    access?.status === "active" && access.mfa && !access.mfa.satisfied && (access.mfa.required || access.mfa.enrolled),
  );

  React.useEffect(() => {
    if (session === null) {
      const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login/${next}`);
    } else if (mfaPending) {
      router.replace("/mfa/");
    }
  }, [session, mfaPending, pathname, router]);

  if (session === undefined || session === null || accessLoading || mfaPending) {
    return <FullPageLoading label="Verificando acesso" />;
  }

  if (accessError) {
    return (
      <div className="mx-auto max-w-lg pt-20">
        <ErrorState message={errorMessage(accessError)} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (!access || access.status !== "active") {
    const reason =
      access?.status === "no_profile"
        ? "Sua conta ainda não foi vinculada a um cadastro no sistema."
        : "Seu acesso está inativo ou bloqueado.";
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface p-6">
        <div role="alert" className="max-w-md rounded-lg border bg-background p-8 text-center">
          <ShieldAlert className="mx-auto mb-4 size-10 text-danger" aria-hidden="true" />
          <h1 className="text-lg font-semibold">Acesso indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">{reason} Procure um administrador do sistema.</p>
          <Button
            className="mt-6"
            variant="outline"
            onClick={async () => {
              await signOut();
              router.replace("/login/");
            }}
          >
            Sair
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/** Bloqueia a página (com mensagem) quando falta a permissão. */
export function RequirePermission({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { can } = useAuth();
  if (!can(permission)) {
    return (
      <div className="mx-auto max-w-lg pt-12">
        <ErrorState title="Você não tem acesso a esta página." message="Se precisar desse acesso, solicite a um administrador." />
      </div>
    );
  }
  return <>{children}</>;
}
