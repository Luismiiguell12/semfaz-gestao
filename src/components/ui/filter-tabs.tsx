"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Filtro com aparência de abas (Não lidas/Todas, Mês/Semana/Dia, Lista/Kanban...).
 * Semântica de grupo de botões alternáveis (aria-pressed), pois não há painéis de
 * abas: o conteúdo abaixo é a mesma lista com outro filtro. Usar `Tabs` aqui gera
 * referências a painéis inexistentes para leitores de tela (WCAG 4.1.2).
 */
const Ctx = React.createContext<{ value: string; onValueChange: (v: string) => void } | null>(null);

export function FilterTabs({
  value,
  onValueChange,
  className,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Ctx.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </Ctx.Provider>
  );
}

export function FilterTabsList({
  className,
  "aria-label": label,
  children,
}: {
  className?: string;
  "aria-label": string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "border-border relative flex w-full [scrollbar-width:none] gap-1 overflow-x-auto border-b",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FilterTab({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("FilterTab precisa estar dentro de FilterTabs.");
  const active = ctx.value === value;
  return (
    <button
      type="button"
      aria-pressed={active}
      data-state={active ? "active" : "inactive"}
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        "text-muted-foreground -mb-px cursor-pointer border-b-2 border-transparent px-3 py-2.5 text-sm font-medium whitespace-nowrap",
        "hover:text-foreground focus-visible:outline-ring data-[state=active]:border-primary data-[state=active]:text-foreground focus-visible:outline-2",
        className,
      )}
    >
      {children}
    </button>
  );
}
