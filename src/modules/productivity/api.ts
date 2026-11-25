"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { toAppError } from "@/lib/errors";

export type PeriodType = "month" | "quarter" | "semester" | "year";
export const PERIOD_LABEL: Record<PeriodType, string> = {
  month: "Mensal",
  quarter: "Trimestral",
  semester: "Semestral",
  year: "Anual",
};

export interface Metrics {
  recebidas: number;
  concluidas: number;
  com_prazo: number;
  no_prazo: number;
  pendentes: number;
  atrasadas: number;
  tempo_medio_dias: number | null;
  por_complexidade: Record<"simple" | "medium" | "complex" | "very_complex", number>;
  como_responsavel: number;
  como_participante: number;
  percentual_conclusao: number | null;
  cumprimento_prazos: number | null;
}

export interface ProductivityReport {
  period: { type: PeriodType; start: string; end: string; closed: boolean };
  can_view_team: boolean;
  people: {
    user_id: string;
    name: string;
    department_id: string | null;
    is_me: boolean;
    consolidated: boolean;
    metrics: Metrics;
  }[];
  totals: Metrics;
  notice: string;
}

export function useProductivityReport(f: {
  type: PeriodType;
  ref: string;
  departmentId?: string;
  userId?: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["productivity", "report", { ...f, enabled: undefined }],
    enabled: f.enabled ?? true,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("productivity_report", {
        p_period_type: f.type,
        p_ref: f.ref,
        p_department_id: (f.departmentId || null) as string,
        p_user_id: (f.userId || null) as string,
      });
      if (error) throw toAppError(error);
      return data as unknown as ProductivityReport;
    },
  });
}

export function useProductivitySeries(type: PeriodType, count: number, userId?: string) {
  return useQuery({
    queryKey: ["productivity", "series", type, count, userId ?? null],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("productivity_series", {
        p_period_type: type,
        p_count: count,
        p_user_id: (userId || null) as string,
      });
      if (error) throw toAppError(error);
      return data as unknown as { start: string; end: string; metrics: Metrics }[];
    },
  });
}

/** Rótulo do período (ex.: "11/2026", "4º trimestre de 2026"). */
export function periodLabel(type: PeriodType, start: string): string {
  const [y, m] = start.split("-").map(Number) as [number, number];
  if (type === "month") return `${String(m).padStart(2, "0")}/${y}`;
  if (type === "quarter") return `${Math.ceil(m / 3)}º trimestre de ${y}`;
  if (type === "semester") return `${m <= 6 ? 1 : 2}º semestre de ${y}`;
  return String(y);
}

export const COMPLEXITY_ORDER = ["simple", "medium", "complex", "very_complex"] as const;
