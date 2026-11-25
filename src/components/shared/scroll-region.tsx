import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Área com rolagem horizontal (tabelas largas no celular). Recebe foco pelo teclado
 * para que a rolagem funcione sem mouse (WCAG 2.1.1) e tem nome para leitores de tela.
 * `relative` mantém textos ocultos (sr-only) dentro do recorte.
 */
export function ScrollRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn(
        "focus-visible:outline-ring relative overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
