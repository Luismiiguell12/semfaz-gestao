"use client";

import Link from "next/link";
import { Filter, X } from "lucide-react";
import { useProperty } from "@/modules/properties/api";
import { useDepartments } from "@/modules/departments/api";
import { describeDrill, type DrillFilters } from "./drill";

/** Faixa com os filtros vindos de um relatório, com opção de limpar. */
export function DrillBanner({ filters, clearHref }: { filters: DrillFilters; clearHref: string }) {
  const property = useProperty(filters.propertyId ?? null);
  const deps = useDepartments();
  const department = deps.data?.find((d) => d.id === filters.departmentId)?.name;
  const parts = describeDrill(filters, { property: property.data?.name, department });
  if (parts.length === 0) return null;
  return (
    <div
      role="status"
      className="bg-primary-soft text-foreground mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border px-4 py-2.5 text-sm"
    >
      <Filter className="text-primary size-4 shrink-0" aria-hidden="true" />
      <span className="font-semibold">Filtros do relatório:</span>
      <span className="min-w-0 flex-1">{parts.join(" · ")}</span>
      <Link
        href={clearHref}
        className="text-primary inline-flex items-center gap-1 font-semibold hover:underline"
      >
        <X className="size-3.5" aria-hidden="true" /> Limpar filtros
      </Link>
    </div>
  );
}
