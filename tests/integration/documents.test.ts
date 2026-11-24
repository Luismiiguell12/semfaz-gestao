// Integração: envio validado de documentos e acesso a arquivos por registro associado.
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ANON_KEY, SUPABASE_URL } from "./env";
import { bootstrapAdmin, callFunction, PASSWORD, ROLE, SEMFAZ_ID, serviceClient, signIn, uniq } from "./helpers";

const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

let admin: { client: SupabaseClient; id: string };
let outsider: SupabaseClient;
let otherDeptId: string;

async function upload(client: SupabaseClient, bytes: Uint8Array, name: string, entityId = SEMFAZ_ID, extra: Record<string, string> = {}) {
  const { data } = await client.auth.getSession();
  const form = new FormData();
  form.set("entity_type", "department");
  form.set("entity_id", entityId);
  for (const [k, v] of Object.entries(extra)) form.set(k, v);
  form.set("file", new Blob([bytes as BlobPart]), name);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/documents-upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${data.session?.access_token}`, apikey: ANON_KEY },
    body: form,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

beforeAll(async () => {
  admin = await bootstrapAdmin();
  const dept = await admin.client.from("departments")
    .insert({ organization_id: "00000000-0000-4000-8000-000000000001", kind: "secretariat", name: uniq("Secretaria Teste ") })
    .select("id").single();
  if (dept.error) throw dept.error;
  otherDeptId = dept.data.id;

  const username = uniq("fora");
  const email = `${username}@teste.invalid`;
  const inv = await callFunction(admin.client, "admin-users", {
    action: "invite",
    payload: { full_name: "Usuário Fora Teste", email, username, role_ids: [ROLE.collaborator], department_ids: [otherDeptId] },
  });
  if (inv.status !== 201) throw new Error(JSON.stringify(inv.body));
  await serviceClient().auth.admin.updateUserById(inv.body.user_id, { password: PASSWORD, email_confirm: true });
  outsider = await signIn(email);
});

describe("Documentos", () => {
  let docId: string;
  let path: string;

  it("aceita PDF válido, calcula SHA-256 e grava com nome gerado (UUID)", async () => {
    const res = await upload(admin.client, PDF, "Portaria Teste.pdf");
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    docId = res.body.document.id;
    path = res.body.document.storage_path;
    expect(res.body.document.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.document.original_name).toBe("Portaria Teste.pdf");
    expect(path).not.toContain("Portaria");
  });

  it("rejeita arquivo cuja extensão não corresponde ao conteúdo", async () => {
    const res = await upload(admin.client, PNG, "disfarcado.pdf");
    expect(res.status).toBe(415);
  });

  it("rejeita tipo não permitido", async () => {
    const res = await upload(admin.client, new TextEncoder().encode("MZ executável"), "programa.pdf");
    expect(res.status).toBe(415);
  });

  it("substituição cria nova versão e preserva a anterior", async () => {
    const res = await upload(admin.client, PDF, "Portaria Teste v2.pdf", SEMFAZ_ID, { replaces_document_id: docId });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.document.version).toBe(2);
    const old = await admin.client.from("documents").select("is_current").eq("id", docId).single();
    expect(old.data?.is_current).toBe(false);
  });

  it("gera URL assinada temporária para quem tem acesso", async () => {
    const signed = await admin.client.storage.from("documents").createSignedUrl(path, 60);
    expect(signed.error).toBeNull();
    const file = await fetch(signed.data!.signedUrl);
    expect(file.status).toBe(200);
  });

  it("nega metadados e arquivo a usuário sem acesso ao registro", async () => {
    const meta = await outsider.from("documents").select("id");
    expect(meta.data ?? []).toHaveLength(0);
    const signed = await outsider.storage.from("documents").createSignedUrl(path, 60);
    expect(signed.error).not.toBeNull();
  });

  it("usuário sem permissão não anexa documentos", async () => {
    const res = await upload(outsider, PDF, "tentativa.pdf", otherDeptId);
    expect(res.status).toBe(403);
  });

  it("upload direto no Storage (sem a Edge Function) é negado", async () => {
    const res = await outsider.storage.from("documents").upload(`00000000-0000-4000-8000-000000000001/department/${crypto.randomUUID()}`, PDF, { contentType: "application/pdf" });
    expect(res.error).not.toBeNull();
  });

  it("exclusão de arquivo pelo usuário é negada", async () => {
    await admin.client.storage.from("documents").remove([path]);
    const still = await admin.client.storage.from("documents").createSignedUrl(path, 60);
    expect(still.error).toBeNull();
  });
});
