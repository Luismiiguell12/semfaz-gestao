"use client";

import * as React from "react";
import { Download, FileText, History, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/states";
import { ACCEPTED_FILE_TYPES, MAX_FILE_MB, openDocument, useDocuments, useUploadDocument, type DocumentEntityType, type DocumentRow } from "./api";
import { formatBytes, formatDateTime } from "@/lib/format";
import { useUserDirectory } from "@/modules/users/api";

/** Lista, envio, nova versão e download (URL assinada) de documentos de um registro. */
export function DocumentsPanel({ entityType, entityId, canAttach }: { entityType: DocumentEntityType; entityId: string; canAttach: boolean }) {
  const docs = useDocuments(entityType, entityId);
  const upload = useUploadDocument(entityType, entityId);
  const directory = useUserDirectory();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = React.useState<DocumentRow | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);
  const inputId = React.useId();

  function pick(replace: DocumentRow | null) {
    setReplacing(replace);
    inputRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    upload.mutate(
      { file, replacesId: replacing?.id },
      {
        onSuccess: () => toast.success(replacing ? "Nova versão enviada." : "Documento enviado."),
        onError: (err) => toast.error(err.message),
        onSettled: () => setReplacing(null),
      },
    );
  }

  const all = docs.data ?? [];
  const visible = showHistory ? all : all.filter((d) => d.is_current);

  return (
    <div>
      {canAttach && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label htmlFor={inputId} className="sr-only">
            Selecionar arquivo
          </label>
          <Input id={inputId} ref={inputRef} type="file" accept={ACCEPTED_FILE_TYPES} className="hidden" onChange={onFile} />
          <Button variant="outline" size="sm" onClick={() => pick(null)} loading={upload.isPending && !replacing}>
            <Upload aria-hidden="true" /> Anexar documento
          </Button>
          <p className="text-xs text-muted-foreground">PDF, JPG, PNG, DOCX ou XLSX, até {MAX_FILE_MB} MB.</p>
        </div>
      )}
      {docs.isLoading && <LoadingRows rows={2} />}
      {docs.isError && <ErrorState message={docs.error.message} onRetry={() => docs.refetch()} />}
      {docs.data && visible.length === 0 && (
        <EmptyState icon={FileText} title="Nenhum documento anexado" className="py-6" />
      )}
      <ul className="divide-y rounded-md border empty:hidden">
        {visible.map((d) => (
          <li key={d.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
            <FileText className="hidden size-5 shrink-0 text-brand/70 sm:block" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {d.original_name} <Badge tone={d.is_current ? "info" : "neutral"}>v{d.version}</Badge>
              </p>
              <p className="tabular text-xs text-muted-foreground">
                {formatBytes(d.size_bytes)}, enviado por {directory.data?.get(d.uploaded_by)?.full_name ?? "usuário"} em {formatDateTime(d.uploaded_at)}
              </p>
              <p className="truncate font-mono text-[11px] text-muted-foreground" title="SHA-256">
                SHA-256 {d.sha256}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openDocument(d).catch((err: Error) => toast.error(err.message))}
                aria-label={`Baixar ${d.original_name}`}
              >
                <Download aria-hidden="true" /> Baixar
              </Button>
              {canAttach && d.is_current && (
                <Button size="sm" variant="ghost" onClick={() => pick(d)} loading={upload.isPending && replacing?.id === d.id}>
                  Nova versão
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {all.some((d) => !d.is_current) && (
        <Button variant="link" size="sm" className="mt-2" onClick={() => setShowHistory((s) => !s)}>
          <History aria-hidden="true" /> {showHistory ? "Ocultar versões anteriores" : "Mostrar versões anteriores"}
        </Button>
      )}
    </div>
  );
}
