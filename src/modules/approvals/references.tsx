"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { formatCalendarDate, formatCurrency } from "@/lib/format";
import { PROPERTY_STATUS_LABEL } from "@/modules/properties/api";
import { ADMIN_STATUS_LABEL, AMENDMENT_KIND_LABEL } from "@/modules/contracts/api";

/** Rótulos dos campos exibidos na comparação "atual × proposto". */
export const FIELD_LABEL: Record<string, string> = {
  name: "Identificação",
  street: "Logradouro",
  address_number: "Número",
  complement: "Complemento",
  district: "Bairro",
  postal_code: "CEP",
  city: "Município",
  state: "UF",
  department_id: "Secretaria responsável",
  unit_department_id: "Unidade administrativa",
  purpose: "Finalidade",
  internal_responsible_id: "Responsável interno",
  occupation_date: "Data de ocupação",
  status: "Situação",
  notes: "Observações",
  property_id: "Imóvel",
  contract_number: "Número do contrato",
  process_number: "Processo administrativo",
  modality_id: "Modalidade",
  object: "Objeto",
  signed_on: "Data de assinatura",
  start_date: "Início da vigência",
  end_date: "Fim da vigência",
  global_value: "Valor global",
  monthly_value: "Valor mensal",
  adjustment_index_id: "Índice de reajuste",
  base_date: "Data-base",
  inspector_id: "Fiscal do contrato",
  manager_id: "Gestor do contrato",
  landlords: "Locadores",
  contract_id: "Contrato",
  amendment_number: "Número do aditivo",
  kind: "Tipo de aditivo",
  new_end_date: "Nova vigência (fim)",
  new_monthly_value: "Novo valor mensal",
  value_effective_from: "Novo valor a partir de",
  description: "Descrição",
  effective_end_date: "Vigência efetiva atual",
  effective_monthly_value: "Valor mensal vigente atual",
};

const MONEY = new Set(["global_value", "monthly_value", "new_monthly_value", "effective_monthly_value"]);
const DATES = new Set([
  "occupation_date",
  "signed_on",
  "start_date",
  "end_date",
  "base_date",
  "new_end_date",
  "value_effective_from",
  "effective_end_date",
]);

/** Mapas id → nome para exibir referências de forma legível. */
export function useReferenceNames() {
  return useQuery({
    queryKey: ["reference-names"],
    staleTime: 60_000,
    queryFn: async () => {
      const s = getSupabase();
      const [deps, users, props, lls, mods, idx, contracts] = await Promise.all([
        s.from("departments").select("id, name"),
        s.from("user_directory").select("id, full_name"),
        s.from("properties").select("id, name"),
        s.from("landlords").select("id, name"),
        s.from("contract_modalities").select("id, name"),
        s.from("adjustment_indexes").select("id, name"),
        s.from("contracts").select("id, contract_number"),
      ]);
      const m = new Map<string, string>();
      for (const r of deps.data ?? []) m.set(r.id, r.name);
      for (const r of users.data ?? []) if (r.id) m.set(r.id, r.full_name ?? "");
      for (const r of props.data ?? []) m.set(r.id, r.name);
      for (const r of lls.data ?? []) m.set(r.id, r.name);
      for (const r of mods.data ?? []) m.set(r.id, r.name);
      for (const r of idx.data ?? []) m.set(r.id, r.name);
      for (const r of contracts.data ?? []) m.set(r.id, `Contrato ${r.contract_number}`);
      return m;
    },
  });
}

export function displayValue(
  field: string,
  value: unknown,
  names: Map<string, string> | undefined,
): React.ReactNode {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "landlords" && Array.isArray(value)) {
    return (
      <ul className="space-y-0.5">
        {value.map((l: { landlord_id: string; share_percent?: number }) => (
          <li key={l.landlord_id}>
            {names?.get(l.landlord_id) ?? "Locador"}
            {l.share_percent !== undefined && l.share_percent !== null
              ? ` (${String(l.share_percent).replace(".", ",")}%)`
              : ""}
          </li>
        ))}
      </ul>
    );
  }
  if (MONEY.has(field)) return formatCurrency(String(value));
  if (DATES.has(field)) return formatCalendarDate(String(value));
  if (field === "status")
    return PROPERTY_STATUS_LABEL[value as keyof typeof PROPERTY_STATUS_LABEL] ?? String(value);
  if (field === "admin_status")
    return ADMIN_STATUS_LABEL[value as keyof typeof ADMIN_STATUS_LABEL] ?? String(value);
  if (field === "kind")
    return AMENDMENT_KIND_LABEL[value as keyof typeof AMENDMENT_KIND_LABEL] ?? String(value);
  if (typeof value === "string" && /^[0-9a-f-]{36}$/.test(value))
    return names?.get(value) ?? "Registro sem acesso";
  return String(value);
}

/** Tabela de comparação entre dados atuais (snapshot) e propostos. */
export function ProposalTable({
  snapshot,
  proposed,
}: {
  snapshot: Record<string, unknown> | null;
  proposed: Record<string, unknown>;
}) {
  const names = useReferenceNames();
  const fields = Object.keys(proposed).filter((f) => f in FIELD_LABEL);
  const hasCurrent = Boolean(snapshot);
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface text-muted-foreground border-b text-left text-xs">
            <th scope="col" className="px-4 py-2 font-semibold">
              Campo
            </th>
            {hasCurrent && (
              <th scope="col" className="px-4 py-2 font-semibold">
                Atual
              </th>
            )}
            <th scope="col" className="px-4 py-2 font-semibold">
              {hasCurrent ? "Proposto" : "Dados informados"}
            </th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => {
            const changed =
              hasCurrent && JSON.stringify(snapshot?.[f] ?? null) !== JSON.stringify(proposed[f] ?? null);
            return (
              <tr key={f} className="border-b align-top last:border-b-0">
                <th scope="row" className="text-muted-foreground w-1/4 px-4 py-2.5 text-left font-medium">
                  {FIELD_LABEL[f]}
                </th>
                {hasCurrent && (
                  <td className="px-4 py-2.5 break-words">{displayValue(f, snapshot?.[f], names.data)}</td>
                )}
                <td
                  className={
                    changed
                      ? "bg-warning-soft/60 px-4 py-2.5 font-medium break-words"
                      : "px-4 py-2.5 break-words"
                  }
                >
                  {displayValue(f, proposed[f], names.data)}
                  {changed && <span className="sr-only"> (alterado)</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
