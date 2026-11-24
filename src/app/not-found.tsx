import Link from "next/link";
import { BrandMark } from "@/components/layout/brand";

export default function NotFound() {
  return (
    <main id="conteudo" className="flex min-h-dvh flex-col items-center justify-center bg-surface px-6 text-center">
      <BrandMark className="mb-6 size-12" />
      <h1 className="text-2xl font-bold text-brand">Página não encontrada</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">O endereço pode estar incorreto ou a página foi movida.</p>
      <Link href="/" className="mt-6 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
        Ir para o painel
      </Link>
    </main>
  );
}
