"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { toAppError } from "@/lib/errors";

export const settingsKeys = { rules: ["settings", "rules"] as const };

export function useRulesAndLists() {
  return useQuery({
    queryKey: settingsKeys.rules,
    queryFn: async () => {
      const supabase = getSupabase();
      const [approval, alert, modalities, indexes, suppliers] = await Promise.all([
        supabase
          .from("approval_rules")
          .select("*, approval_operations(description, module)")
          .order("operation_code"),
        supabase.from("alert_rules").select("*").order("code").order("days_before", { ascending: false }),
        supabase.from("contract_modalities").select("*").order("name"),
        supabase.from("adjustment_indexes").select("*").order("name"),
        supabase.from("suppliers").select("*").order("name"),
      ]);
      for (const r of [approval, alert, modalities, indexes, suppliers])
        if (r.error) throw toAppError(r.error);
      return {
        approval: approval.data ?? [],
        alert: alert.data ?? [],
        modalities: modalities.data ?? [],
        indexes: indexes.data ?? [],
        suppliers: suppliers.data ?? [],
      };
    },
  });
}

/** Alterações de configuração: RLS exige settings.manage (com MFA); auditadas por trigger. */
export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      table,
      id,
      values,
    }: {
      table: "approval_rules" | "alert_rules" | "contract_modalities" | "adjustment_indexes" | "suppliers";
      id: string;
      values: Record<string, unknown>;
    }) => {
      const { data, error } = await getSupabase()
        .from(table)
        .update(values as never)
        .eq("id", id)
        .select("id");
      if (error) throw toAppError(error);
      if (!data || data.length === 0)
        throw toAppError({ message: "Acesso negado: você não pode alterar esta configuração." });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.rules });
      qc.invalidateQueries({ queryKey: ["contract-lists"] });
      qc.invalidateQueries({ queryKey: ["consumer-units"] });
    },
  });
}

/** Novo fornecedor (água ou energia). RLS exige settings.manage; auditado por trigger. */
export function useAddSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { name: string; kind: "energy" | "water"; organizationId: string }) => {
      const { error } = await getSupabase()
        .from("suppliers")
        .insert({ name: v.name.trim(), kind: v.kind, organization_id: v.organizationId });
      if (error) {
        if (error.code === "23505") throw toAppError({ message: "Já existe um fornecedor com este nome." });
        throw toAppError(error);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.rules });
      qc.invalidateQueries({ queryKey: ["consumer-units"] });
    },
  });
}

export function useAddListItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      table,
      name,
      organizationId,
    }: {
      table: "contract_modalities" | "adjustment_indexes";
      name: string;
      organizationId: string;
    }) => {
      const { error } = await getSupabase()
        .from(table)
        .insert({ name: name.trim(), organization_id: organizationId });
      if (error) throw toAppError(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.rules });
      qc.invalidateQueries({ queryKey: ["contract-lists"] });
    },
  });
}
