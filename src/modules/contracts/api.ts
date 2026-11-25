"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { toAppError } from "@/lib/errors";
import type { Database } from "@/types/database";
import type { ApprovalRequest } from "@/modules/approvals/api";

export type ContractOverview = Database["public"]["Views"]["contracts_overview"]["Row"];
export type Amendment = Database["public"]["Tables"]["contract_amendments"]["Row"];
export type ValidityStatus = "not_started" | "active" | "expiring" | "expired" | "inactive";

export const VALIDITY_LABEL: Record<ValidityStatus, string> = {
  not_started: "Não iniciado",
  active: "Vigente",
  expiring: "Próximo do vencimento",
  expired: "Vencido",
  inactive: "Encerrado/suspenso",
};

export const ADMIN_STATUS_LABEL: Record<Database["public"]["Enums"]["contract_admin_status"], string> = {
  active: "Ativo",
  suspended: "Suspenso",
  terminated: "Rescindido",
  closed: "Encerrado",
};

export const AMENDMENT_KIND_LABEL: Record<Database["public"]["Enums"]["amendment_kind"], string> = {
  term: "Prazo",
  value: "Valor",
  term_and_value: "Prazo e valor",
  other: "Outro",
};

export const contractKeys = {
  all: ["contracts"] as const,
  detail: (id: string) => ["contracts", "detail", id] as const,
  byProperty: (id: string) => ["contracts", "property", id] as const,
  lists: ["contract-lists"] as const,
};

export function useContracts() {
  return useQuery({
    queryKey: contractKeys.all,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("contracts_overview")
        .select("*")
        .order("effective_end_date");
      if (error) throw toAppError(error);
      return data;
    },
  });
}

export function usePropertyContracts(propertyId: string | null) {
  return useQuery({
    queryKey: contractKeys.byProperty(propertyId ?? ""),
    enabled: Boolean(propertyId),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("contracts_overview")
        .select("*")
        .eq("property_id", propertyId!)
        .order("start_date", { ascending: false });
      if (error) throw toAppError(error);
      return data;
    },
  });
}

export function useContract(id: string | null) {
  return useQuery({
    queryKey: contractKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const supabase = getSupabase();
      const [c, landlords, amendments, alerts] = await Promise.all([
        supabase.from("contracts_overview").select("*").eq("id", id!).maybeSingle(),
        supabase
          .from("contract_landlords")
          .select("id, landlord_id, share_percent, landlords(id, name, person_type, document_masked)")
          .eq("contract_id", id!),
        supabase.from("contract_amendments").select("*").eq("contract_id", id!).order("signed_on"),
        supabase.from("alerts").select("*").eq("entity_id", id!).order("created_at", { ascending: false }),
      ]);
      for (const r of [c, landlords, amendments, alerts]) if (r.error) throw toAppError(r.error);
      return {
        contract: c.data,
        landlords: landlords.data ?? [],
        amendments: amendments.data ?? [],
        alerts: alerts.data ?? [],
      };
    },
  });
}

export function useContractLists() {
  return useQuery({
    queryKey: contractKeys.lists,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const supabase = getSupabase();
      const [m, i] = await Promise.all([
        supabase.from("contract_modalities").select("*").order("name"),
        supabase.from("adjustment_indexes").select("*").order("name"),
      ]);
      if (m.error) throw toAppError(m.error);
      if (i.error) throw toAppError(i.error);
      return { modalities: m.data, indexes: i.data };
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: contractKeys.all }),
      qc.invalidateQueries({ queryKey: ["approvals"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(fn as never, args as never);
  if (error) throw toAppError(error);
  return data as T;
}

export function useRequestContractCreate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { data: Record<string, unknown>; justification: string }) =>
      rpc<ApprovalRequest>("request_contract_create", { p_data: v.data, p_justification: v.justification }),
    onSuccess: invalidate,
  });
}

export function useRequestValueChange() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; monthly: string; global: string; justification: string }) =>
      rpc<ApprovalRequest>("request_contract_value_change", {
        p_contract_id: v.id,
        p_monthly_value: v.monthly,
        p_global_value: v.global,
        p_justification: v.justification,
      }),
    onSuccess: invalidate,
  });
}

export function useRequestTermChange() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; start: string; end: string; justification: string }) =>
      rpc<ApprovalRequest>("request_contract_term_change", {
        p_contract_id: v.id,
        p_start_date: v.start,
        p_end_date: v.end,
        p_justification: v.justification,
      }),
    onSuccess: invalidate,
  });
}

export function useRequestAmendment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { data: Record<string, unknown>; justification: string }) =>
      rpc<ApprovalRequest>("request_amendment_create", { p_data: v.data, p_justification: v.justification }),
    onSuccess: invalidate,
  });
}

export function useUpdateContractDetails() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; data: Record<string, unknown>; reason: string }) =>
      rpc<unknown>("update_contract_details", { p_contract_id: v.id, p_data: v.data, p_reason: v.reason }),
    onSuccess: invalidate,
  });
}

/** Aditivos de todos os contratos de um imóvel (ficha do imóvel). */
export function usePropertyAmendments(contractIds: string[] | undefined) {
  return useQuery({
    queryKey: ["contracts", "amendments-by-contracts", contractIds ?? []],
    enabled: Boolean(contractIds?.length),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("contract_amendments")
        .select("*")
        .in("contract_id", contractIds!)
        .order("signed_on", { ascending: false });
      if (error) throw toAppError(error);
      return data;
    },
  });
}
