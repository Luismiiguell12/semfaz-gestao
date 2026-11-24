import { cn } from "@/lib/utils";

/**
 * Símbolo próprio do SEMFAZ Gestão: um "S" construído com linhas de
 * livro-razão (registro, conferência, controle). Não faz referência ao brasão.
 */
export function BrandMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  const bg = inverted ? "#ffffff" : "#0e2a47";
  const fg = inverted ? "#0e2a47" : "#ffffff";
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} role="img" aria-label="SEMFAZ Gestão">
      <rect width="32" height="32" rx="7" fill={bg} />
      <rect x="8" y="7.5" width="16" height="3" rx="1.5" fill={fg} />
      <rect x="8" y="7.5" width="3" height="10" rx="1.5" fill={fg} />
      <rect x="8" y="14.5" width="16" height="3" rx="1.5" fill="#7fb0ff" />
      <rect x="21" y="14.5" width="3" height="10" rx="1.5" fill={fg} />
      <rect x="8" y="21.5" width="16" height="3" rx="1.5" fill={fg} />
    </svg>
  );
}

export function BrandLockup({ compact = false, inverted = true }: { compact?: boolean; inverted?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <BrandMark inverted={!inverted} />
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className={cn("text-[15px] font-bold tracking-tight", inverted ? "text-white" : "text-brand")}>SEMFAZ Gestão</p>
          <p className={cn("truncate text-[11px]", inverted ? "text-brand-muted" : "text-muted-foreground")}>
            Prefeitura Municipal de Lagarto
          </p>
        </div>
      )}
    </div>
  );
}
