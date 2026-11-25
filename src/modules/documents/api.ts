"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { invokeFunction } from "@/lib/supabase/functions";
import { AppError, toAppError } from "@/lib/errors";
import type { Database } from "@/types/database";

export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
export type DocumentEntityType =
  | "department"
  | "property"
  | "contract"
  | "amendment"
  | "approval_request"
  | "invoice"
  | "rent_charge"
  | "payment"
  | "consumer_unit";

export const ACCEPTED_FILE_TYPES = ".pdf,.jpg,.jpeg,.png,.docx,.xlsx";
export const MAX_FILE_MB = 10;

export const documentKeys = { entity: (t: string, id: string) => ["documents", t, id] as const };

export function useDocuments(entityType: DocumentEntityType, entityId: string) {
  return useQuery({
    queryKey: documentKeys.entity(entityType, entityId),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("documents")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("uploaded_at", { ascending: false });
      if (error) throw toAppError(error);
      return data;
    },
  });
}

export function useUploadDocument(entityType: DocumentEntityType, entityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      description,
      replacesId,
    }: {
      file: File;
      description?: string;
      replacesId?: string;
    }) => {
      // Verificação prévia na interface; a validação definitiva (tipo real,
      // tamanho e permissão) é feita pela Edge Function e pelo banco.
      if (file.size > MAX_FILE_MB * 1024 * 1024) throw new AppError(`O arquivo excede ${MAX_FILE_MB} MB.`);
      const form = new FormData();
      form.set("entity_type", entityType);
      form.set("entity_id", entityId);
      if (description) form.set("description", description);
      if (replacesId) form.set("replaces_document_id", replacesId);
      form.set("file", file, file.name);
      return invokeFunction<{ document: DocumentRow }>("documents-upload", form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.entity(entityType, entityId) }),
  });
}

/** Gera URL temporária assinada (validade curta) e abre o arquivo. */
export async function openDocument(doc: DocumentRow) {
  const supabase = getSupabase();
  const { data: setting } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "documents.signed_url_ttl_seconds")
    .maybeSingle();
  const ttl = Math.min(Number(setting?.value ?? 60) || 60, 300);
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, ttl, { download: doc.original_name });
  if (error || !data) throw new AppError("Você não tem acesso a este arquivo ou ele não está disponível.");
  await supabase.rpc("log_client_event", {
    p_operation: "DOCUMENT_VIEW",
    p_module: "documents",
    p_metadata: { document_id: doc.id, entity_type: doc.entity_type, entity_id: doc.entity_id },
  });
  window.location.assign(data.signedUrl);
}
