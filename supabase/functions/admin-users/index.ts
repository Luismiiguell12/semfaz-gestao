// Edge Function: administração de usuários (convite, situação e reenvio de convite).
// Toda autorização é verificada no banco com o JWT do operador (RPCs com
// users.manage + AAL2). A chave de serviço só é usada para as operações do
// Supabase Auth que exigem privilégio administrativo, após essa verificação.
import { corsHeaders, isOriginAllowed } from "../_shared/cors.ts";
import { handleError, HttpError, json } from "../_shared/http.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { adminUsersRequestSchema } from "../_shared/schemas/users.ts";

const APP_URL = (Deno.env.get("APP_URL") ?? "http://localhost:3000/semfaz-gestao").replace(/\/$/, "");
// Bloqueio no Supabase Auth: impede novos logins/renovação de sessão.
const BAN_DURATION = "876000h";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  try {
    if (!isOriginAllowed(req)) throw new HttpError(403, "Origem não autorizada.", "forbidden_origin");
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido.");

    const { userId, userClient } = await requireUser(req);
    const parsed = adminUsersRequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError(422, parsed.error.issues[0]?.message ?? "Dados inválidos.", "validation_error");
    }
    const request = parsed.data;
    const admin = serviceClient();

    if (request.action === "invite") {
      const p = request.payload;
      // 1) Autorização + unicidade, com o JWT do operador.
      const pre = await userClient.rpc("admin_precheck_invite", { p_email: p.email, p_username: p.username });
      if (pre.error) throw pre.error;

      // 2) Cria a conta no Auth e envia o convite por e-mail.
      const invited = await admin.auth.admin.inviteUserByEmail(p.email, {
        redirectTo: `${APP_URL}/auth/confirmar/`,
      });
      if (invited.error || !invited.data.user) {
        const exists = invited.error?.message?.toLowerCase().includes("already");
        throw new HttpError(exists ? 409 : 400, exists
          ? "Já existe uma conta de autenticação com este e-mail."
          : "Não foi possível enviar o convite. Verifique o e-mail informado.");
      }
      const newUserId = invited.data.user.id;

      // 3) Cria o perfil com o JWT do operador (auditado em seu nome).
      const created = await userClient.rpc("admin_create_profile", {
        p_user_id: newUserId,
        p_full_name: p.full_name,
        p_username: p.username,
        p_employee_number: p.employee_number ?? null,
        p_job_title: p.job_title ?? null,
        p_department_id: p.department_id ?? null,
        p_role_ids: p.role_ids,
        p_department_ids: p.department_ids,
        p_organization_wide_access: p.organization_wide_access,
      });
      if (created.error) {
        // Desfaz a conta recém-criada (ainda sem perfil nem histórico).
        await admin.auth.admin.deleteUser(newUserId);
        throw created.error;
      }
      return json(req, 201, { user_id: newUserId });
    }

    if (request.action === "set_status") {
      const p = request.payload;
      if (p.user_id === userId) throw new HttpError(403, "Você não pode alterar a própria situação.");
      // A RPC valida permissão, MFA, último administrador e registra a auditoria.
      const updated = await userClient.rpc("admin_set_user_status", {
        p_user_id: p.user_id,
        p_status: p.status,
        p_reason: p.reason,
      });
      if (updated.error) throw updated.error;

      // Defesa adicional: bloqueia o login no Auth. A RLS já nega o acesso aos dados.
      const ban = await admin.auth.admin.updateUserById(p.user_id, {
        ban_duration: p.status === "active" ? "none" : BAN_DURATION,
      });
      if (ban.error) {
        return json(req, 207, {
          warning: "Situação alterada, mas o bloqueio de login no Auth falhou. O acesso aos dados já está negado.",
        });
      }
      return json(req, 200, { ok: true });
    }

    // resend_invite
    const allowed = await userClient.rpc("has_permission", { permission: "users.manage" });
    if (allowed.error) throw allowed.error;
    if (!allowed.data) throw new HttpError(403, "Acesso negado: requer users.manage com verificação em duas etapas.");

    const target = await userClient.from("profiles").select("id, email").eq("id", request.payload.user_id).maybeSingle();
    if (target.error) throw target.error;
    if (!target.data) throw new HttpError(404, "Usuário não encontrado.");

    const authUser = await admin.auth.admin.getUserById(target.data.id);
    if (authUser.error) throw new HttpError(400, "Não foi possível consultar a conta.");
    if (authUser.data.user?.email_confirmed_at) {
      throw new HttpError(409, "Este usuário já aceitou o convite. Use a recuperação de senha.");
    }
    const resent = await admin.auth.admin.inviteUserByEmail(target.data.email, {
      redirectTo: `${APP_URL}/auth/confirmar/`,
    });
    if (resent.error) throw new HttpError(400, "Não foi possível reenviar o convite.");
    return json(req, 200, { ok: true });
  } catch (err) {
    return handleError(req, err);
  }
});
