// Integração (Fase 7): ataque direto à API do Supabase, sem passar pela interface.
// Para CADA tabela e visão publicada pelo PostgREST, com a chave pública (anônimo)
// e com o token de usuários comuns, tenta ler, inserir, alterar e apagar.
// A lista vem do próprio PostgREST: tabelas novas entram no teste automaticamente.
// A conferência é feita pelo banco (service role): nada pode ter mudado.
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL } from "./env";
import { createAuthUser, ORG_ID, ROLE, SEMFAZ_ID, serviceClient, signIn, uniq } from "./helpers";

type Props = Record<string, { type?: string; format?: string }>;
let relations: { name: string; props: Props }[] = [];
const tokens: Record<string, string> = {};
const MARK = "__ataque_api__";

async function makeUser(prefix: string, roles: string[]) {
  const svc = serviceClient();
  const username = uniq(prefix);
  const u = await createAuthUser(username);
  await svc.from("profiles").insert({
    id: u.id,
    organization_id: ORG_ID,
    full_name: `Teste ${username}`,
    email: "",
    username,
    department_id: SEMFAZ_ID,
  });
  for (const role_id of roles)
    await svc.from("user_roles").insert({ organization_id: ORG_ID, user_id: u.id, role_id });
  const client: SupabaseClient = await signIn(u.email);
  return (await client.auth.getSession()).data.session!.access_token;
}

function rest(path: string, init: RequestInit & { token?: string } = {}) {
  const { token, ...rest } = init;
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...rest,
    headers: {
      apikey: ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(rest.headers ?? {}),
    },
  });
}

/** Contagem real (service role). null quando nem o serviço lê (ex.: auditoria). */
async function count(table: string): Promise<number | null> {
  const r = await serviceClient().from(table).select("*", { count: "exact", head: true });
  return r.error ? null : (r.count ?? 0);
}
async function countMarked(table: string, col: string): Promise<number> {
  const r = await serviceClient().from(table).select("*", { count: "exact", head: true }).eq(col, MARK);
  return r.error ? 0 : (r.count ?? 0);
}

/** Coluna de texto alterável (para a tentativa de UPDATE). */
function textColumn(props: Props): string | undefined {
  return Object.entries(props).find(
    ([k, p]) =>
      p.type === "string" &&
      !p.format?.includes("uuid") &&
      !/^(id|.*_id|.*_at|status|kind)$/.test(k) &&
      (p.format === "text" || p.format === "character varying" || p.format === "public.citext"),
  )?.[0];
}

beforeAll(async () => {
  // Catálogo do PostgREST (somente com a service role).
  const spec = (await (
    await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    })
  ).json()) as { definitions: Record<string, { properties: Props }> };
  relations = Object.entries(spec.definitions).map(([name, d]) => ({ name, props: d.properties ?? {} }));
  expect(relations.length).toBeGreaterThan(40);

  // Dados-alvo fictícios para as tentativas de alteração/exclusão.
  const svc = serviceClient();
  const prop = await svc.from("properties").insert({
    organization_id: ORG_ID,
    department_id: SEMFAZ_ID,
    name: uniq("Imóvel Alvo "),
    street: "Rua Teste",
    address_number: "1",
    district: "Centro",
    postal_code: "49400-000",
    city: "Lagarto",
    state: "SE",
    purpose: "Teste de segurança",
  });
  expect(prop.error).toBeNull();

  tokens.semPapel = await makeUser("atqsem", []);
  tokens.consulta = await makeUser("atqconsulta", [ROLE.viewer]);
  tokens.colaborador = await makeUser("atqcolab", [ROLE.collaborator]);
});

describe("Ataque direto à API (PostgREST)", () => {
  it("anônimo não lê nenhuma tabela ou visão", async () => {
    const leaks: string[] = [];
    for (const { name } of relations) {
      const r = await rest(`${name}?select=*&limit=1`);
      const body = r.ok ? ((await r.json()) as unknown[]) : [];
      if (r.ok && body.length > 0) leaks.push(name);
    }
    expect(leaks).toEqual([]);
  });

  for (const who of ["anônimo", "semPapel", "consulta", "colaborador"] as const) {
    it(`${who}: não insere, não altera e não apaga em nenhuma tabela`, async () => {
      const token = who === "anônimo" ? undefined : tokens[who];
      const problems: string[] = [];
      for (const { name, props } of relations) {
        const before = await count(name);
        const ins = await rest(name, { method: "POST", token, body: JSON.stringify({}) });
        const col = textColumn(props);
        if (col) {
          await rest(`${name}?${col}=not.is.null`, {
            method: "PATCH",
            token,
            body: JSON.stringify({ [col]: MARK }),
          });
          if ((await countMarked(name, col)) > 0) problems.push(`${name}: UPDATE em ${col}`);
        }
        const idCol = "id" in props ? "id" : Object.keys(props)[0];
        await rest(`${name}?${idCol}=not.is.null`, { method: "DELETE", token });
        const after = await count(name);
        if (before !== null && after !== before) problems.push(`${name}: contagem ${before} → ${after}`);
        if (ins.status === 201) problems.push(`${name}: INSERT aceito`);
      }
      expect(problems).toEqual([]);
    });
  }

  it("visão do diretório: colaborador não altera colegas", async () => {
    const r = await rest(`user_directory?id=not.is.null`, {
      method: "PATCH",
      token: tokens.colaborador,
      body: JSON.stringify({ full_name: MARK }),
    });
    expect(r.status).toBe(403);
    expect(await countMarked("profiles", "full_name")).toBe(0);
  });

  it("usuário sem papel não lê dados de negócio", async () => {
    const leaks: string[] = [];
    const allowed = new Set([
      // catálogos e dados próprios, legíveis por qualquer usuário ativo
      "permissions",
      "notification_types",
      "organizations",
      "profiles",
      "user_directory",
      "departments",
      "notification_preferences",
      "task_categories",
      "task_complexity_levels",
      "suppliers",
      "contract_modalities",
      "adjustment_indexes",
      "approval_operations",
      "roles",
      "user_roles",
      "role_permissions",
      "user_department_access",
      "system_settings",
      // regras configuradas (quais operações exigem aprovação, prazos de alerta): não são dados de negócio
      "approval_rules",
      "alert_rules",
    ]);
    for (const { name } of relations) {
      if (allowed.has(name)) continue;
      const r = await rest(`${name}?select=*&limit=1`, { token: tokens.semPapel });
      const body = r.ok ? ((await r.json()) as unknown[]) : [];
      if (body.length > 0) leaks.push(name);
    }
    expect(leaks).toEqual([]);
  });
});
