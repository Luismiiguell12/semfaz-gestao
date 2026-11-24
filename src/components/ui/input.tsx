import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input bg-background text-foreground placeholder:text-muted-foreground/80 flex h-10 w-full min-w-0 rounded-md border px-3 py-2 text-sm",
        "focus-visible:border-primary focus-visible:outline-ring/40 focus-visible:outline-2 focus-visible:outline-offset-0",
        "disabled:bg-muted disabled:cursor-not-allowed disabled:opacity-70",
        "aria-invalid:border-danger aria-invalid:focus-visible:outline-danger/40",
        "file:bg-muted file:mr-3 file:rounded file:border-0 file:px-2 file:py-1 file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
