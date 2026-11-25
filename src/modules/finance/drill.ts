"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { toAppError } from "@/lib/errors";
import { useDepartments } from "@/modules/departments/api";

/**
 * Filtros de detalhamento ("drill-down") passados pela URL, usados quando o
 * usuário clica num valor dos Relatórios de despesas. Os nomes são curtos e em
 * português para que o endereço possa ser compartilhado.
 *   de / ate      mês inicial e final (AAAA-MM), por competência ou pagamento
 *   imovel        id do imóvel
 *   secretaria    id do departamento (inclui a estrutura abaixo dele)
 *   tipo          rent | water | energy (lista separada por vírgula)
 *   situacao      paid | pending | partially_paid | overdue (lista)
 *   fornecedor    id do fornecedor (faturas)
 *   locador       id do locador (aluguéis)
 */
export interface DrillFilters {
  from?: string;
  to?: string;
  propertyId?: string;
  departmentId?: string;
  kinds?: string[];
  statuses?: string[];
  supplierId?: string;
  landlordId?: string;
}

const MONTH = /^\d{4}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

export function useDrillFilters(): DrillFilters {
  const sp = useSearchParams();
  return React.useMemo(() => {
    const month = (k: string) => {
      const v = sp.get(k);
      return v && MONTH.test(v) ? v : undefined;
    };
    const id = (k: string) => {
      const v = sp.get(k);
      return v && UUID.test(v) ? v : undefined;
    };
    const list = (k: string) => {
      const v = sp.get(k);
      return v ? v.split(",").filter(Boolean) : undefined;
    };
    return {
      from: month("de"),
      to: month("ate"),
      propertyId: id("imovel"),
      departmentId: id("secretaria"),
      kinds: list("tipo"),
      statuses: list("situacao"),
      supplierId: id("fornecedor"),
      landlordId: id("locador"),
    };
  }, [sp]);
}

export function hasDrill(f: DrillFilters): boolean {
  return Object.values(f).some((v) => v !== undefined);
}

export function drillHref(base: string, f: DrillFilters): string {
  const p = new URLSearchParams();
  if (f.from) p.set("de", f.from);
  if (f.to) p.set("ate", f.to);
  if (f.propertyId) p.set("imovel", f.propertyId);
  if (f.departmentId) p.set("secretaria", f.departmentId);
  if (f.kinds?.length) p.set("tipo", f.kinds.join(","));
  if (f.statuses?.length) p.set("situacao", f.statuses.join(","));
  if (f.supplierId) p.set("fornecedor", f.supplierId);
  if (f.landlordId) p.set("locador", f.landlordId);
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Ids do departamento informado e de toda a estrutura abaixo dele. */
export function useDepartmentSubtree(departmentId?: string): Set<string> | undefined {
  const deps = useDepartments();
  return React.useMemo(() => {
    if (!departmentId || !deps.data) return undefined;
    const ids = new Set([departmentId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const d of deps.data) {
        if (d.parent_id && ids.has(d.parent_id) && !ids.has(d.id)) {
          ids.add(d.id);
          grew = true;
        }
      }
    }
    return ids;
  }, [departmentId, deps.data]);
}

/** Contratos de um locador (para detalhar aluguéis por locador). */
export function useLandlordContractIds(landlordId?: string) {
  return useQuery({
    queryKey: ["finance", "landlord-contracts", landlordId ?? ""],
    enabled: Boolean(landlordId),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("contract_landlords")
        .select("contract_id")
        .eq("landlord_id", landlordId!)
        .is("deleted_at", null);
      if (error) throw toAppError(error);
      return new Set(data.map((r) => r.contract_id));
    },
  });
}

/** Aplica os filtros comuns a uma linha com competência, imóvel, secretaria e situação. */
export function matchesDrill(
  row: {
    competence: string | null;
    property_id: string | null;
    department_id: string | null;
    status: string | null;
  },
  f: DrillFilters,
  subtree?: Set<string>,
): boolean {
  const comp = row.competence?.slice(0, 7);
  if (f.from && (!comp || comp < f.from)) return false;
  if (f.to && (!comp || comp > f.to)) return false;
  if (f.propertyId && row.property_id !== f.propertyId) return false;
  if (subtree && (!row.department_id || !subtree.has(row.department_id))) return false;
  if (f.statuses?.length && !f.statuses.includes(row.status ?? "")) return false;
  return true;
}

export function describeDrill(f: DrillFilters, names: { property?: string; department?: string }): string[] {
  const out: string[] = [];
  const fmt = (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`;
  if (f.from && f.to) out.push(f.from === f.to ? `Mês ${fmt(f.from)}` : `De ${fmt(f.from)} a ${fmt(f.to)}`);
  else if (f.from) out.push(`A partir de ${fmt(f.from)}`);
  else if (f.to) out.push(`Até ${fmt(f.to)}`);
  if (f.propertyId) out.push(`Imóvel: ${names.property ?? "selecionado"}`);
  if (f.departmentId) out.push(`Secretaria: ${names.department ?? "selecionada"}`);
  if (f.kinds?.length) {
    const label: Record<string, string> = { rent: "Aluguel", water: "Água", energy: "Energia" };
    out.push(`Tipo: ${f.kinds.map((k) => label[k] ?? k).join(", ")}`);
  }
  if (f.statuses?.length) {
    const label: Record<string, string> = {
      paid: "Paga",
      pending: "Pendente",
      partially_paid: "Parcialmente paga",
      overdue: "Vencida",
    };
    out.push(`Situação: ${f.statuses.map((s) => label[s] ?? s).join(", ")}`);
  }
  if (f.supplierId) out.push("Fornecedor selecionado");
  if (f.landlordId) out.push("Locador selecionado");
  return out;
}
