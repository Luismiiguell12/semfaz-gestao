import Link from "next/link";
import { BrandMark } from "@/components/layout/brand";

export default function NotFound() {
  return (
    <main
      id="conteudo"
      className="bg-surface flex min-h-dvh flex-col items-center justify-center px-6 text-center"
    >
      <BrandMark className="mb-6 size-12" />
      <h1 className="text-brand text-2xl font-bold">Página não encontrada</h1>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        O endereço pode estar incorreto ou a página foi movida.
      </p>
      <Link
        href="/"
        className="bg-primary text-primary-foreground hover:bg-primary-hover mt-6 rounded-md px-4 py-2.5 text-sm font-semibold"
      >
        Ir para o painel
      </Link>
    </main>
  );
}
