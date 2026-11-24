// Converte erros do Supabase (PostgREST, Auth, Edge Functions) em mensagens
// claras em português. Nunca exibe detalhes técnicos internos.
type MaybeError = { message?: string; code?: string; status?: number; hint?: string } | null | undefined;

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  "Invalid login credentials": "E-mail ou senha incorretos.",
  user_banned: "Seu acesso está bloqueado ou inativo. Procure um administrador.",
  "User is banned": "Seu acesso está bloqueado ou inativo. Procure um administrador.",
  email_not_confirmed: "Confirme seu e-mail pelo link do convite antes de entrar.",
  over_request_rate_limit: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  over_email_send_rate_limit: "Muitos e-mails enviados. Aguarde alguns minutos e tente novamente.",
  weak_password: "Senha fraca: use pelo menos 10 caracteres, com letras maiúsculas, minúsculas e números.",
  same_password: "A nova senha deve ser diferente da atual.",
  reauthentication_needed: "Por segurança, entre novamente antes de alterar a senha.",
  mfa_verification_failed: "Código inválido ou expirado. Confira o aplicativo autenticador.",
  "Invalid TOTP code entered": "Código inválido ou expirado. Confira o aplicativo autenticador.",
  session_expired: "Sua sessão expirou. Entre novamente.",
};

// Códigos do PostgreSQL usados pelas funções e constraints do banco.
const PG_MESSAGES: Record<string, string> = {
  "23505": "Já existe um registro com esses dados.",
  "23503": "O registro relacionado não existe ou não pode ser usado.",
  "23514": "Os dados não atendem às regras de validação.",
  "22P02": "Valor em formato inválido.",
  PGRST116: "Registro não encontrado.",
};

/** Mensagens do banco que já foram escritas para o usuário final (em português). */
function isFriendlyDbMessage(message: string): boolean {
  return /[áéíóúãõâêôç]|^(Acesso negado|Você|Informe|Selecione|Não|Já|Este|Esta|O |A |Os |As |Uma |Um |Usuário|Perfil|Departamento|Documento|Somente|Remova|Exclua|Há )/.test(
    message,
  );
}

export function errorMessage(error: unknown, fallback = "Não foi possível concluir a operação."): string {
  const e = error as MaybeError;
  if (!e) return fallback;
  if (e.code && AUTH_MESSAGES[e.code]) return AUTH_MESSAGES[e.code]!;
  if (e.message && AUTH_MESSAGES[e.message]) return AUTH_MESSAGES[e.message]!;
  if (e.message && isFriendlyDbMessage(e.message) && e.message.length < 300) return e.message;
  if (e.code && PG_MESSAGES[e.code]) return PG_MESSAGES[e.code]!;
  if (e.message?.toLowerCase().includes("failed to fetch")) {
    return "Sem conexão com o servidor. Verifique sua internet e tente novamente.";
  }
  return fallback;
}

export function isMfaRequired(error: unknown): boolean {
  const e = error as MaybeError;
  return e?.hint === "mfa_required" || e?.code === "mfa_required" || Boolean(e?.message?.includes("duas etapas"));
}

/** Erro lançado pelas camadas de serviço, já com mensagem para o usuário. */
export class AppError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AppError";
  }
}

export function toAppError(error: unknown, fallback?: string): AppError {
  if (error instanceof AppError) return error;
  return new AppError(errorMessage(error, fallback), error);
}
