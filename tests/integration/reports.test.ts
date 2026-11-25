// Integração: Edge Function reports-export (Excel e PDF), RLS e auditoria.
import { beforeAll, describe, expect, it } from "vitest";
import { inflateRawSync } from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ANON_KEY, SUPABASE_URL } from "./env";
import {
  bootstrapAdmin,
  createAuthUser,
  ORG_ID,
  ROLE,
  SEMFAZ_ID,
  serviceClient,
  signIn,
  uniq,
} from "./helpers";

let manager: { client: SupabaseClient; id: string };
let colab: { client: SupabaseClient; id: string };
let auditor: SupabaseClient;
let mine: string;
let other: string;

async function makeUser(prefix: string, role: string, dept: string) {
  const svc = serviceClient();
  const username = uniq(prefix);
  const u = await createAuthUser(username);
  await svc.from("profiles").insert({
    id: u.id,
    organization_id: ORG_ID,
    full_name: `Teste ${username}`,
    email: "",
    username,
    department_id: dept,
  });
  await svc.from("user_roles").insert({ organization_id: ORG_ID, user_id: u.id, role_id: role });
  await svc
    .from("user_department_access")
    .insert({ organization_id: ORG_ID, user_id: u.id, department_id: dept });
  return { id: u.id, client: await signIn(u.email) };
}

async function exportReport(client: SupabaseClient | null, body: unknown) {
  const token = client ? (await client.auth.getSession()).data.session?.access_token : undefined;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/reports-export`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      apikey: ANON_KEY,
      "Content-Type": "application/json",
      Origin: "http://localhost:4173",
    },
    body: JSON.stringify(body),
  });
  const bytes = new Uint8Array(await res.arrayBuffer());
  return {
    status: res.status,
    type: res.headers.get("content-type") ?? "",
    disposition: res.headers.get("content-disposition") ?? "",
    bytes,
  };
}

/** Lê um arquivo de dentro do .xlsx (zip) pelo diretório central. */
function unzipEntry(zip: Uint8Array, name: string): string | null {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocd = zip.length - 22;
  while (eocd >= 0 && dv.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) return null;
  let p = dv.getUint32(eocd + 16, true);
  const count = dv.getUint16(eocd + 10, true);
  for (let i = 0; i < count; i++) {
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const xlen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const entry = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nlen));
    if (entry === name) {
      const lnlen = dv.getUint16(local + 26, true);
      const lxlen = dv.getUint16(local + 28, true);
      const data = zip.subarray(local + 30 + lnlen + lxlen, local + 30 + lnlen + lxlen + csize);
      return new TextDecoder().decode(method === 8 ? inflateRawSync(data) : data);
    }
    p += 46 + nlen + xlen + clen;
  }
  return null;
}
const xlsxText = (bytes: Uint8Array) =>
  `${unzipEntry(bytes, "xl/sharedStrings.xml") ?? ""}${unzipEntry(bytes, "xl/worksheets/sheet1.xml") ?? ""}`;

beforeAll(async () => {
  const svc = serviceClient();
  const dept = await svc
    .from("departments")
    .insert({ organization_id: ORG_ID, kind: "secretariat", name: uniq("Secretaria Relatórios ") })
    .select("id")
    .single();
  auditor = (await bootstrapAdmin()).client;
  manager = await makeUser("relgestor", ROLE.manager, SEMFAZ_ID);
  colab = await makeUser("relcolab", ROLE.collaborator, SEMFAZ_ID);
  mine = uniq("Imóvel Exportado ");
  other = uniq("Imóvel Fora do Escopo ");
  const base = {
    organization_id: ORG_ID,
    street: "Rua Teste",
    address_number: "1",
    district: "Centro",
    postal_code: "49400-000",
    city: "Lagarto",
    state: "SE",
    purpose: "Teste de exportação",
  };
  const ins = await svc.from("properties").insert([
    { ...base, name: mine, department_id: SEMFAZ_ID },
    { ...base, name: other, department_id: dept.data!.id },
  ]);
  expect(ins.error).toBeNull();
});

describe("Exportação de relatórios", () => {
  it("gera Excel com os dados do escopo do usuário (RLS) e registra na auditoria", async () => {
    const r = await exportReport(manager.client, {
      report: "imoveis",
      format: "xlsx",
      filters: { departamento: SEMFAZ_ID },
    });
    expect(r.status).toBe(200);
    expect(r.type).toContain("spreadsheetml");
    expect(r.disposition).toMatch(/attachment; filename="semfaz-imoveis-\d+\.xlsx"/);
    expect(String.fromCharCode(r.bytes[0]!, r.bytes[1]!)).toBe("PK");
    const text = xlsxText(r.bytes);
    expect(text).toContain("Imóveis");
    expect(text).toContain(mine);
    expect(text).not.toContain(other);
    expect(text).toContain("Secretaria: Secretaria Municipal da Fazenda");

    const log = await auditor
      .from("audit_logs")
      .select("operation, module, metadata, actor_id")
      .eq("actor_id", manager.id)
      .eq("operation", "EXPORT")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .single();
    expect(log.error).toBeNull();
    expect(log.data!.module).toBe("reports");
    expect(log.data!.metadata).toMatchObject({
      report: "imoveis",
      format: "xlsx",
      filters: { departamento: SEMFAZ_ID },
    });
    expect(log.data!.metadata.rows).toBeGreaterThanOrEqual(1);
  });

  it("gera PDF", async () => {
    const r = await exportReport(manager.client, { report: "contratos", format: "pdf", filters: {} });
    expect(r.status).toBe(200);
    expect(r.type).toBe("application/pdf");
    expect(new TextDecoder().decode(r.bytes.subarray(0, 5))).toBe("%PDF-");
    expect(r.bytes.length).toBeGreaterThan(1000);
  });

  it("produtividade leva o aviso de uso no arquivo", async () => {
    const r = await exportReport(manager.client, {
      report: "produtividade",
      format: "xlsx",
      filters: { periodo: "month" },
    });
    expect(r.status).toBe(200);
    expect(xlsxText(r.bytes)).toContain("não devem ser usados como avaliação automática");
  });

  it("sem reports.export: recusa e não registra exportação", async () => {
    const r = await exportReport(colab.client, { report: "imoveis", format: "xlsx", filters: {} });
    expect(r.status).toBe(403);
    const log = await auditor
      .from("audit_logs")
      .select("id")
      .eq("actor_id", colab.id)
      .eq("operation", "EXPORT");
    expect(log.data).toHaveLength(0);
  });

  it("valida o pedido: sessão, relatório e filtros", async () => {
    expect((await exportReport(null, { report: "imoveis", format: "xlsx" })).status).toBe(401);
    expect((await exportReport(manager.client, { report: "nao_existe", format: "xlsx" })).status).toBe(404);
    expect((await exportReport(manager.client, { report: "imoveis", format: "docx" })).status).toBe(422);
    expect(
      (await exportReport(manager.client, { report: "imoveis", format: "xlsx", filters: { sql: "1" } }))
        .status,
    ).toBe(422);
  });

  it("a auditoria não pode ser registrada sem permissão de exportar", async () => {
    const r = await colab.client.rpc("log_report_export", {
      p_report: "imoveis",
      p_format: "xlsx",
      p_filters: {},
      p_row_count: 1,
    });
    expect(r.error?.code).toBe("42501");
  });
});
