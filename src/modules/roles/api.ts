"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { toAppError } from "@/lib/errors";
import type { Database } from "@/types/database";
import { roleSchema, type RoleInput } from "@shared/schemas/organization.ts";

export type Role = Database["public"]["Tables"]["roles"]["Row"];
export type Permission = Database["public"]["Tables"]["permissions"]["Row"];

export const MODULE_LABEL: Record<string, string> = {
  users: "Usuários",
  permissions: "Perfis e permissões",
  departments: "Departamentos",
  audit: "Auditoria",
  settings: "Configurações",
  properties: "Imóveis e locadores",
  contracts: "Contratos",
  utilities: "Unidades consumidoras",
  finance: "Financeiro",
  tasks: "Demandas",
  approvals: "Aprovações",
  productivity: "Produtividade",
  reports: "Relatórios",
};

/** Ordem de exibição dos grupos de permissões (módulos do sistema). */
export const MODULE_ORDER = Object.keys(MODULE_LABEL);

export const roleKeys = { all: ["roles"] as const, permissions: ["permissions"] as const };

export function useRoles() {
  return useQuery({
    queryKey: roleKeys.all,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("roles")
        .select("*, role_permissions(permission_code)")
        .is("deleted_at", null)
        .order("name");
      if (error) throw toAppError(error);
      return data;
    },
  });
}

export function usePermissions() {
  return useQuery({
    queryKey: roleKeys.permissions,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabase().from("permissions").select("*").order("code");
      if (error) throw toAppError(error);
      return data;
    },
  });
}

export function useSaveRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string | null; values: RoleInput }) => {
      const v = roleSchema.parse(values);
      const { data, error } = await getSupabase().rpc("admin_save_role", {
        p_role_id: id as string,
        p_code: v.code,
        p_name: v.name,
        p_description: v.description ?? "",
        p_permission_codes: v.permission_codes,
        p_reason: v.reason,
      });
      if (error) throw toAppError(error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: roleKeys.all }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await getSupabase().rpc("admin_delete_role", { p_role_id: id, p_reason: reason });
      if (error) throw toAppError(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: roleKeys.all }),
  });
}
