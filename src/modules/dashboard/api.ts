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
