import { BrandMark } from "@/components/layout/brand";

/** Layout das telas de autenticação: painel institucional + formulário. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="ledger-rule bg-brand text-brand-foreground relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark inverted className="size-10" />
          <div className="leading-tight">
            <p className="text-lg font-bold text-white">SEMFAZ Gestão</p>
            <p className="text-brand-muted text-sm">Gestão administrativa da Fazenda Municipal</p>
          </div>
        </div>
        <div className="max-w-md">
          <p className="text-[2rem] leading-[1.15] font-semibold text-white">
            Imóveis, contratos, faturas e demandas em um só registro, com histórico de cada decisão.
          </p>
        </div>
        <div className="text-brand-muted text-sm">
          <p className="font-semibold text-white">Prefeitura Municipal de Lagarto</p>
          <p>Secretaria Municipal da Fazenda</p>
        </div>
      </aside>
      <main id="conteudo" className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <BrandMark className="size-10" />
          <div className="leading-tight">
            <p className="text-brand text-lg font-bold">SEMFAZ Gestão</p>
            <p className="text-muted-foreground text-xs">Prefeitura Municipal de Lagarto</p>
          </div>
        </div>
        <div className="w-full max-w-sm">{children}</div>
        <p className="text-muted-foreground mt-10 max-w-sm text-center text-xs">
          Acesso restrito a servidores autorizados. Todas as operações são registradas.
        </p>
      </main>
    </div>
  );
}
