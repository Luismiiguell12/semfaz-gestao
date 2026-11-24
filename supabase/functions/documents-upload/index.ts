// Edge Function: envio de documentos com validação do tipo real e hash SHA-256.
// O arquivo é gravado com nome gerado pelo sistema (UUID) em bucket privado.
import { corsHeaders, isOriginAllowed } from "../_shared/cors.ts";
import { handleError, HttpError, json } from "../_shared/http.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { documentUploadFieldsSchema } from "../_shared/schemas/documents.ts";
import {
  detectKind,
  extensionMatches,
  MIME_BY_KIND,
  sanitizeFileName,
  sha256Hex,
} from "../_shared/file-type.ts";

const HARD_LIMIT_BYTES = 10 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  let uploadedPath: string | null = null;
  const admin = serviceClient();
  try {
    if (!isOriginAllowed(req)) throw new HttpError(403, "Origem não autorizada.", "forbidden_origin");
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido.");

    const length = Number(req.headers.get("content-length") ?? "0");
    if (length > HARD_LIMIT_BYTES + 64 * 1024)
      throw new HttpError(413, "Arquivo maior que o limite de 10 MB.");

    const { userId, userClient } = await requireUser(req);
    const form = await req.formData().catch(() => null);
    if (!form) throw new HttpError(400, "Envie o arquivo como multipart/form-data.");

    const fields = documentUploadFieldsSchema.safeParse({
      entity_type: form.get("entity_type"),
      entity_id: form.get("entity_id"),
      description: form.get("description") || undefined,
      replaces_document_id: form.get("replaces_document_id") || undefined,
    });
    if (!fields.success) throw new HttpError(422, fields.error.issues[0]?.message ?? "Dados inválidos.");
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(422, "Selecione um arquivo.");

    // 1) Autorização sobre o registro associado (RLS + regras no banco).
    const can = await userClient.rpc("can_attach_document", {
      p_entity_type: fields.data.entity_type,
      p_entity_id: fields.data.entity_id,
    });
    if (can.error) throw can.error;
    if (!can.data) throw new HttpError(403, "Você não tem permissão para anexar documentos a este registro.");

    // 2) Limite configurável (system_settings), nunca acima do limite físico.
    const setting = await userClient
      .from("system_settings")
      .select("value")
      .eq("key", "documents.max_file_size_mb")
      .maybeSingle();
    const maxMb = Math.min(Number(setting.data?.value ?? 10) || 10, 10);
    if (file.size === 0) throw new HttpError(422, "O arquivo está vazio.");
    if (file.size > maxMb * 1024 * 1024)
      throw new HttpError(413, `Arquivo maior que o limite de ${maxMb} MB.`);

    // 3) Tipo real pelo conteúdo + coerência com a extensão.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = detectKind(bytes);
    const originalName = sanitizeFileName(file.name);
    if (!kind) throw new HttpError(415, "Tipo de arquivo não permitido. Envie PDF, JPG, PNG, DOCX ou XLSX.");
    if (!extensionMatches(kind, originalName)) {
      throw new HttpError(415, "A extensão do arquivo não corresponde ao seu conteúdo.");
    }
    const mimeType = MIME_BY_KIND[kind];
    const sha256 = await sha256Hex(bytes);

    // 4) Organização do usuário (para o caminho do arquivo).
    const access = await userClient.rpc("get_my_access");
    if (access.error) throw access.error;
    const orgId = access.data?.profile?.organization_id as string | undefined;
    if (!orgId) throw new HttpError(403, "Usuário sem acesso ativo.");

    // 5) Grava no Storage com nome gerado pelo sistema.
    const path = `${orgId}/${fields.data.entity_type}/${crypto.randomUUID()}`;
    const up = await admin.storage
      .from("documents")
      .upload(path, bytes, { contentType: mimeType, upsert: false });
    if (up.error) throw new HttpError(500, "Falha ao armazenar o arquivo.");
    uploadedPath = path;

    // 6) Metadados + versionamento, de forma transacional no banco.
    const reg = await admin.rpc("service_register_document", {
      p_user_id: userId,
      p_entity_type: fields.data.entity_type,
      p_entity_id: fields.data.entity_id,
      p_storage_path: path,
      p_original_name: originalName,
      p_mime_type: mimeType,
      p_size_bytes: file.size,
      p_sha256: sha256,
      p_description: fields.data.description ?? null,
      p_replaces_document_id: fields.data.replaces_document_id ?? null,
    });
    if (reg.error) throw reg.error;
    uploadedPath = null;
    return json(req, 201, { document: reg.data });
  } catch (err) {
    // Objeto órfão (sem metadados registrados) é removido; documentos registrados nunca são apagados.
    if (uploadedPath)
      await admin.storage
        .from("documents")
        .remove([uploadedPath])
        .catch(() => undefined);
    return handleError(req, err);
  }
});
