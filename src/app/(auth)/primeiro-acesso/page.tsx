import type { Metadata } from "next";
import Link from "next/link";
import { EmailCodeForm } from "@/components/auth/email-code-form";

export const metadata: Metadata = { title: "Primeiro acesso" };

export default function FirstAccessPage() {
  return (
    <div>
      <h1 className="text-brand text-2xl font-bold">Primeiro acesso</h1>
      <p className="text-muted-foreground mt-1.5 text-sm">
        Informe seu e-mail institucional e o código de 6 números que você recebeu no e-mail de convite. Em
        seguida, você vai criar sua senha.
      </p>
      <div className="mt-7">
        <EmailCodeForm type="invite" submitLabel="Continuar" />
      </div>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        O código expirou?{" "}
        <Link href="/recuperar-senha/" className="text-primary font-medium hover:underline">
          Receber um novo código
        </Link>
      </p>
      <p className="mt-2 text-center text-sm">
        <Link href="/login/" className="text-primary font-medium hover:underline">
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
