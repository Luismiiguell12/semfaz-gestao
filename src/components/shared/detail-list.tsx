import * as React from "react";
import { cn } from "@/lib/utils";

/** Lista de pares rótulo/valor para telas de detalhe. */
export function DetailList({
  items,
  className,
}: {
  items: { label: string; value: React.ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-muted-foreground text-xs font-medium">{i.label}</dt>
          <dd className="text-foreground mt-0.5 text-sm break-words">{i.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Número de destaque (vigência, valor vigente...). */
export function Figure({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="bg-surface-raised rounded-lg border px-4 py-3">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="tabular text-brand mt-1 text-xl font-bold">{value}</p>
      {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
    </div>
  );
}
