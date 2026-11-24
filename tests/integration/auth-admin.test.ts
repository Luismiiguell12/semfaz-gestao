// Integração: autenticação, convite, MFA, bloqueio de usuário e acesso direto à API.
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAILPIT_URL } from "./env";
import {
  anonClient,
  bootstrapAdmin,
  callFunction,
  PASSWORD,
  ROLE,
  SEMFAZ_ID,
  serviceClient,
  signIn,
  uniq,
} from "./helpers";

let admin: { client: SupabaseClient; id: string; email: string };

async function inviteCollaborator(roleIds: string[] = [ROLE.collaborator]) {
  const username = uniq("colab");
  const email = `${username}@teste.invalid`;
  const res = await callFunction(admin.client, "admin-users", {
    action: "invite",
    payload: {
      full_name: "Colaborador Teste",
      email,
      username,
      role_ids: roleIds,
      department_ids: [SEMFAZ_ID],
      department_id: SEMFAZ_ID,
    },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  // Somente no ambiente de testes: define uma senha para simular o aceite do convite.
  await serviceClient().auth.admin.updateUserById(res.body.user_id, {
    password: PASSWORD,
    email_confirm: true,
  });
  return { id: res.body.user_id as string, email, username };
}

beforeAll(async () => {
  admin = await bootstrapAdmin();
});

describe("Autenticação", () => {
  it("não permite cadastro público", async () => {
    const { error } = await anonClient().auth.signUp({
      email: `${uniq("publico")}@teste.invalid`,
      password: PASSWORD,
    });
    expect(error).not.toBeNull();
  });

  it("anônimo não lê dados pela API", async () => {
    const { data, error } = await anonClient().from("departments").select("id");
    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull();
  });

  it("administrador com AAL2 tem as permissões privilegiadas", async () => {
    const { data, error } = await admin.client.rpc("get_my_access");
    expect(error).toBeNull();
    expect(data.mfa.satisfied).toBe(true);
    expect(data.permissions).toContain("users.manage");
  });

  it("login e logout são auditados", async () => {
    const colab = await inviteCollaborator();
    const client = await signIn(colab.email);
    await client.auth.signOut();
    const { data } = await admin.client
      .from("audit_logs")
      .select("operation")
      .eq("actor_id", colab.id)
      .in("operation", ["LOGIN", "LOGOUT"]);
    const ops = (data ?? []).map((r) => r.operation);
    expect(ops).toContain("LOGIN");
    expect(ops).toContain("LOGOUT");
  });
});

describe("Convite e administração de usuários", () => {
  it("convida usuário: cria perfil, papéis, escopo e envia e-mail", async () => {
    const colab = await inviteCollaborator();
    const { data: profile } = await admin.client
      .from("profiles")
      .select("username, status, created_by")
      .eq("id", colab.id)
      .single();
    expect(profile?.status).toBe("active");
    expect(profile?.created_by).toBe(admin.id);

    const mail = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${colab.email}`)}`,
    ).then((r) => r.json());
    expect(mail.messages_count ?? mail.total ?? 0).toBeGreaterThan(0);
  });

  it("rejeita convite com dados inválidos (validação Zod na Edge Function)", async () => {
    const res = await callFunction(admin.client, "admin-users", {
      action: "invite",
      payload: { full_name: "X", email: "nao-e-email", username: "A!", role_ids: [] },
    });
    expect(res.status).toBe(422);
  });

  it("rejeita nome de usuário duplicado", async () => {
    const colab = await inviteCollaborator();
    const res = await callFunction(admin.client, "admin-users", {
      action: "invite",
      payload: {
        full_name: "Outro Teste",
        email: `${uniq("dup")}@teste.invalid`,
        username: colab.username,
        role_ids: [ROLE.viewer],
      },
    });
    expect(res.status).toBe(409);
  });

  it("colaborador não usa a função administrativa", async () => {
    const colab = await inviteCollaborator();
    const client = await signIn(colab.email);
    const res = await callFunction(client, "admin-users", {
      action: "invite",
      payload: {
        full_name: "Invasor Teste",
        email: `${uniq("inv")}@teste.invalid`,
        username: uniq("inv"),
        role_ids: [ROLE.admin],
      },
    });
    expect(res.status).toBe(403);
  });

  it("administrador sem verificar o MFA na sessão é bloqueado (AAL1)", async () => {
    const aal1 = await signIn(admin.email);
    const res = await callFunction(aal1, "admin-users", {
      action: "invite",
      payload: {
        full_name: "Teste MFA",
        email: `${uniq("mfa")}@teste.invalid`,
        username: uniq("mfa"),
        role_ids: [ROLE.viewer],
      },
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("mfa_required");
  });

  it("usuário bloqueado perde o acesso, mesmo com sessão válida, e não consegue novo login", async () => {
    const colab = await inviteCollaborator();
    const session = await signIn(colab.email);
    const before = await session.from("departments").select("id");
    expect((before.data ?? []).length).toBeGreaterThan(0);

    const res = await callFunction(admin.client, "admin-users", {
      action: "set_status",
      payload: { user_id: colab.id, status: "blocked", reason: "Bloqueio em teste de integração" },
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    const after = await session.from("departments").select("id");
    expect(after.data ?? []).toHaveLength(0);

    const relogin = await anonClient().auth.signInWithPassword({ email: colab.email, password: PASSWORD });
    expect(relogin.error).not.toBeNull();

    const reactivate = await callFunction(admin.client, "admin-users", {
      action: "set_status",
      payload: { user_id: colab.id, status: "active", reason: "Reativação em teste de integração" },
    });
    expect(reactivate.status).toBe(200);
    const again = await anonClient().auth.signInWithPassword({ email: colab.email, password: PASSWORD });
    expect(again.error).toBeNull();
  });
});

describe("Acesso direto à API com token de usuário comum", () => {
  let colab: SupabaseClient;
  let colabId: string;

  beforeAll(async () => {
    const c = await inviteCollaborator();
    colabId = c.id;
    colab = await signIn(c.email);
  });

  it("não lê perfis de outros usuários nem a auditoria", async () => {
    const profiles = await colab.from("profiles").select("id");
    expect((profiles.data ?? []).map((p) => p.id)).toEqual([colabId]);
    const audit = await colab.from("audit_logs").select("id");
    expect(audit.data ?? []).toHaveLength(0);
  });

  it("não concede a si mesmo o perfil Administrador", async () => {
    const ins = await colab.from("user_roles").insert({
      organization_id: "00000000-0000-4000-8000-000000000001",
      user_id: colabId,
      role_id: ROLE.admin,
    });
    expect(ins.error).not.toBeNull();
    const rpc = await colab.rpc("admin_set_user_access", {
      p_user_id: colabId,
      p_role_ids: [ROLE.admin],
      p_department_ids: [],
      p_organization_wide_access: true,
      p_reason: "Tentativa de escalonamento",
    });
    expect(rpc.error).not.toBeNull();
    const access = await colab.rpc("get_my_access");
    expect(access.data.is_admin).toBe(false);
  });

  it("não altera perfis nem apaga departamentos", async () => {
    const upd = await colab
      .from("profiles")
      .update({ full_name: "Alterado Indevidamente" })
      .eq("id", admin.id)
      .select();
    expect(upd.data ?? []).toHaveLength(0);
    const del = await colab.from("departments").delete().eq("id", SEMFAZ_ID).select();
    expect(del.data ?? []).toHaveLength(0);
    const own = await colab.from("profiles").update({ status: "active" }).eq("id", colabId).select();
    expect(own.data ?? []).toHaveLength(0);
  });

  it("não executa funções restritas ao backend", async () => {
    const res = await colab.rpc("bootstrap_first_admin", {
      p_user_id: colabId,
      p_organization_id: "00000000-0000-4000-8000-000000000001",
      p_full_name: "Invasor",
      p_username: "invasor",
    });
    expect(res.error).not.toBeNull();
  });
});
