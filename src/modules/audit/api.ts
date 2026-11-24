"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { toAppError } from "@/lib/errors";
import type { Database } from "@/types/database";

export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];

export interface AuditFilters {
  from?: string; // AAAA-MM-DD (dia em America/Maceio)
  to?: string;
  module?: string;
  operation?: string;
  actorId?: string;
  page: number;
}

export const AUDIT_PAGE_SIZE = 50;

export const OPERATION_LABEL: Record<string, string> = {
  INSERT: "Inclusão",
  UPDATE: "Alteração",
  DELETE: "Exclusão",
  SOFT_DELETE: "Exclusão lógica",
  RESTORE: "Restauração",
  LOGIN: "Login",
  LOGOUT: "Logout",
  MFA_VERIFIED: "Verificação MFA",
  EXPORT: "Exportação",
  DOCUMENT_VIEW: "Visualização de documento",
};

export const AUDIT_MODULE_LABEL: Record<string, string> = {
  auth: "Autenticação",
  users: "Usuários",
  permissions: "Perfis e permissões",
  departments: "Departamentos",
  documents: "Documentos",
  settings: "Configurações",
  organization: "Organização",
};

/** Converte um dia local (America/Maceio, UTC−3 fixo) em instante UTC. */
export function maceioDayStartUtc(day: string): string {
  return new Date(`${day}T00:00:00-03:00`).toISOString();
}

export function useAuditLogs(filters: AuditFilters) {
  return useQuery({
    queryKey: ["audit", filters],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = getSupabase()
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("occurred_at", { ascending: false })
        .range(filters.page * AUDIT_PAGE_SIZE, filters.page * AUDIT_PAGE_SIZE + AUDIT_PAGE_SIZE - 1);
      if (filters.from) q = q.gte("occurred_at", maceioDayStartUtc(filters.from));
      if (filters.to) {
        const end = new Date(maceioDayStartUtc(filters.to));
        end.setUTCDate(end.getUTCDate() + 1);
        q = q.lt("occurred_at", end.toISOString());
      }
      if (filters.module) q = q.eq("module", filters.module);
      if (filters.operation) q = q.eq("operation", filters.operation);
      if (filters.actorId) q = q.eq("actor_id", filters.actorId);
      const { data, error, count } = await q;
      if (error) throw toAppError(error);
      return { rows: data, total: count ?? 0 };
    },
  });
}
