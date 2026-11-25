// Edge Function: exportação de relatórios (Excel e PDF).
// Consulta os dados com o TOKEN DO USUÁRIO (nunca a service-role key): a RLS e as
// verificações das RPCs valem como na tela. Registra a exportação na auditoria
// ANTES de devolver o arquivo; se o registro falhar, nada é entregue.
import { corsHeaders, isOriginAllowed } from "../_shared/cors.ts";
import { handleError, HttpError } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";
import {
  describeFilters,
  exportRequestSchema,
  MAX_EXPORT_ROWS,
  REPORT_BY_ID,
} from "../_shared/reports/catalog.ts";
import { toPdf, toXlsx } from "./render.ts";

const MIME = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  try {
    if (!isOriginAllowed(req)) throw new HttpError(403, "Origem não autorizada.", "forbidden_origin");
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido.");
    const { userClient, userId } = await requireUser(req);

    const body = exportRequestSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new HttpError(422, body.error.issues[0]?.message ?? "Pedido inválido.");
    const { report, format, filters } = body.data;
    const def = REPORT_BY_ID.get(report);
    if (!def) throw new HttpError(404, "Relatório não encontrado.");

    // Permissões: exportar + ver o relatório (a RLS limita as linhas de qualquer forma).
    for (const perm of ["reports.export", def.permission].filter(Boolean) as string[]) {
      const ok = await userClient.rpc("has_permission", { permission: perm, department_id: null });
      if (ok.error) throw ok.error;
      if (!ok.data) throw new HttpError(403, "Você não tem permissão para exportar este relatório.");
    }

    const rows = await def.fetch(userClient, filters, MAX_EXPORT_ROWS + 1);
    if (rows.length > MAX_EXPORT_ROWS) {
      throw new HttpError(
        422,
        `O relatório passa de ${MAX_EXPORT_ROWS} linhas. Restrinja os filtros (por exemplo, o período).`,
      );
    }

    // Auditoria antes da entrega (quem, relatório, filtros, formato, linhas, quando).
    const logged = await userClient.rpc("log_report_export", {
      p_report: report,
      p_format: format,
      p_filters: filters,
      p_row_count: rows.length,
    });
    if (logged.error) throw logged.error;

    const me = await userClient.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    const header = {
      title: def.title,
      filters: await describeFilters(userClient, def, filters),
      generatedBy: me.data?.full_name ?? "usuário",
      generatedAt: new Date(),
      notice: def.notice,
    };
    const file =
      format === "xlsx" ? await toXlsx(header, def.columns, rows) : await toPdf(header, def.columns, rows);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
    return new Response(file, {
      status: 200,
      headers: {
        ...corsHeaders(req),
        "Content-Type": MIME[format],
        "Content-Disposition": `attachment; filename="semfaz-${report}-${stamp}.${format}"`,
        "Access-Control-Expose-Headers": "Content-Disposition",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleError(req, err);
  }
});
