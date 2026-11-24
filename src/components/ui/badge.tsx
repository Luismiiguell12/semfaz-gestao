import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-foreground",
        info: "border-primary/20 bg-primary-soft text-primary-hover",
        success: "border-success/20 bg-success-soft text-success",
        warning: "border-warning-strong/40 bg-warning-soft text-warning",
        danger: "border-danger/20 bg-danger-soft text-danger",
        brand: "border-brand/20 bg-brand text-brand-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

function Badge({ className, tone, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { Badge, badgeVariants };
