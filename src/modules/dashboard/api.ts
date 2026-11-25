"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { toAppError } from "@/lib/errors";

export interface FoundationStats {
  unread_notifications: number;
  departments: { secretariats: number; directorates: number; units: number };
  users: null | {
    active: number;
    inactive: number;
    blocked: number;
    active_admins: number;
    admins_without_mfa: number;
  };
}

export function useFoundationStats() {
  return useQuery({
    queryKey: ["dashboard", "foundation"],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("dashboard_foundation_stats");
      if (error) throw toAppError(error);
      return data as unknown as FoundationStats;
    },
  });
}

export interface ContractStats {
  properties_total: number;
  properties_active: number;
  contracts_active: number;
  contracts_expiring: number;
  contracts_expired: number;
  monthly_rent_total: string;
  approvals_pending: number;
  can_view_properties: boolean;
  can_view_contracts: boolean;
  can_review: boolean;
}

/** Indicadores de imóveis, contratos e aprovações (calculados no banco com a RLS do usuário). */
export function useContractStats() {
  return useQuery({
    queryKey: ["dashboard", "contracts"],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("dashboard_contract_stats");
      if (error) throw toAppError(error);
      return data as unknown as ContractStats;
    },
  });
}
