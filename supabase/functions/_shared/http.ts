import { corsHeaders } from "./cors.ts";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
  ) {
    super(message);
  }
}

export function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

// Mensagens de erro do banco já estão em português e não contêm dados pessoais.
// Erros inesperados nunca expõem detalhes internos ao cliente.
export function handleError(req: Request, err: unknown): Response {
  if (err instanceof HttpError) {
    return json(req, err.status, { error: err.message, code: err.code });
  }
  const pg = err as { code?: string; message?: string; hint?: string };
  if (pg && typeof pg.code === "string" && typeof pg.message === "string") {
    const status = pg.code === "42501" ? 403 : pg.code === "P0002" ? 404 : pg.code === "23505" ? 409 : 400;
    return json(req, status, {
      error: pg.message,
      code: pg.hint === "mfa_required" ? "mfa_required" : pg.code,
    });
  }
  console.error("Erro inesperado na função:", err instanceof Error ? err.name : typeof err);
  return json(req, 500, { error: "Erro interno. Tente novamente ou contate o suporte." });
}
