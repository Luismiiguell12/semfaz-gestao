import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Select nativo: acessível por padrão, adequado a teclado e leitores de tela,
// e com a experiência nativa do celular.
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative w-full">
      <select
        data-slot="select"
        className={cn(
          "border-input bg-background text-foreground flex h-10 w-full cursor-pointer appearance-none rounded-md border py-2 pr-9 pl-3 text-sm",
          "focus-visible:border-primary focus-visible:outline-ring/40 focus-visible:outline-2 focus-visible:outline-offset-0",
          "disabled:bg-muted aria-invalid:border-danger disabled:cursor-not-allowed",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
    </div>
  );
}

export { NativeSelect };
