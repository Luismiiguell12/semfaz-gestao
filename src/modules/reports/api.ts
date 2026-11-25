"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import {
  PREVIEW_ROWS,
  REPORTS,
  REPORT_BY_ID,
  reportFiltersSchema,
  type ReportDef,
  type ReportFilters,
} from "@shared/reports/catalog.ts";

export { PREVIEW_ROWS, REPORTS, REPORT_BY_ID, type ReportDef, type ReportFilters };
export { formatCell, type Column, type FilterDef, type Row } from "@shared/reports/catalog.ts";

export type ExportFormat = "xlsx" | "pdf";

/** Remove filtros vazios (o servidor valida com o mesmo esquema). */
export function cleanFilters(f: Record<string, string | undefined>): ReportFilters {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) if (v) out[k] = v;
  return reportFiltersSchema.parse(out);
}

/** Prévia: a mesma consulta do arquivo, com o cliente do usuário (RLS). */
export function useReportPreview(def: ReportDef | undefined, filters: ReportFilters, enabled = true) {
  return useQuery({
    queryKey: ["reports", "preview", def?.id, filters],
    enabled: !!def && enabled,
    queryFn: () => def!.fetch(getSupabase(), filters, PREVIEW_ROWS + 1),
  });
}

/**
 * Exportação: a Edge Function gera o arquivo com o token do usuário e registra
 * a exportação na auditoria antes de devolvê-lo.
 */
export async function downloadReport(report: string, format: ExportFormat, filters: ReportFilters) {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AppError("Sua sessão expirou. Entre novamente.");
  const res = await fetch(`${env.supabaseUrl}/functions/v1/reports-export`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ report, format, filters }),
  }).catch(() => {
    throw new AppError("Sem conexão com o servidor. Verifique sua internet e tente novamente.");
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new AppError(payload.error ?? "Não foi possível gerar o arquivo.");
  }
  const blob = await res.blob();
  const name =
    /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ??
    `semfaz-${report}.${format}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return name;
}
