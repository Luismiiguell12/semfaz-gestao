"use client";

import * as React from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { downloadReport, type ExportFormat, type ReportFilters } from "./api";

/** Botões Excel/PDF. Só aparecem para quem tem reports.export; cada exportação é auditada. */
export function ExportButtons({
  report,
  filters,
  disabled,
  disabledReason,
}: {
  report: string;
  filters: ReportFilters;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const { can } = useAuth();
  const [busy, setBusy] = React.useState<ExportFormat | null>(null);
  if (!can("reports.export")) return null;

  async function run(format: ExportFormat) {
    setBusy(format);
    try {
      const name = await downloadReport(report, format, filters);
      toast.success(`Arquivo gerado: ${name}`, { description: "A exportação foi registrada na auditoria." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o arquivo.");
    } finally {
      setBusy(null);
    }
  }
  const icon = (f: ExportFormat, Icon: typeof FileText) =>
    busy === f ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Icon aria-hidden="true" />;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || busy !== null}
        title={disabled ? disabledReason : "Exportar para Excel (registrado na auditoria)"}
        onClick={() => run("xlsx")}
      >
        {icon("xlsx", FileSpreadsheet)} Excel
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || busy !== null}
        title={disabled ? disabledReason : "Exportar para PDF (registrado na auditoria)"}
        onClick={() => run("pdf")}
      >
        {icon("pdf", FileText)} PDF
      </Button>
    </>
  );
}
