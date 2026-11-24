"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase, initialAuthHash } from "@/lib/supabase/client";
import { FullPageLoading, InlineAlert } from "@/components/shared/states";

/**
 * Destino dos links de convite e de recuperação de senha. O cliente Supabase
 * lê os tokens do fragmento da URL e os remove; aqui só decidimos o próximo passo.
 */
const noopSubscribe = () => () => {};

function linkError(hash: string): string | undefined {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (!params.get("error")) return undefined;
  return params.get("error_code") === "otp_expired"
    ? "Este link expirou ou já foi utilizado. Solicite um novo."
    : "Link inválido. Solicite um novo.";
}

export default function ConfirmPage() {
  const router = useRouter();
  const hash = React.useSyncExternalStore(noopSubscribe, () => initialAuthHash, () => "");
  const hashError = linkError(hash);
  const [timeoutError, setTimeoutError] = React.useState<string>();
  const error = hashError ?? timeoutError;

  React.useEffect(() => {
    if (linkError(initialAuthHash)) return;
    const type = new URLSearchParams(initialAuthHash.replace(/^#/, "")).get("type");
    const supabase = getSupabase();
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      router.replace(type === "invite" || type === "recovery" ? "/definir-senha/" : "/");
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) go();
    });
    const timeout = window.setTimeout(() => {
      if (!done) setTimeoutError("Não foi possível validar o link. Solicite um novo.");
    }, 8000);
    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [router]);

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-brand">Link inválido</h1>
        <InlineAlert tone="danger" className="mt-6">
          {error}
        </InlineAlert>
        <p className="mt-6 text-center text-sm">
          <Link href="/recuperar-senha/" className="font-medium text-primary hover:underline">
            Solicitar novo link
          </Link>
        </p>
      </div>
    );
  }
  return <FullPageLoading label="Validando link" />;
}
