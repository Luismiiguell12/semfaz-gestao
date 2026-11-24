import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input bg-background text-foreground placeholder:text-muted-foreground/80 flex min-h-20 w-full rounded-md border px-3 py-2 text-sm",
        "focus-visible:border-primary focus-visible:outline-ring/40 focus-visible:outline-2 focus-visible:outline-offset-0",
        "disabled:bg-muted aria-invalid:border-danger disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
