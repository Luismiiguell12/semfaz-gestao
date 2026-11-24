// CORS restrito às origens autorizadas (domínio do GitHub Pages e ambiente local).
// Configure ALLOWED_ORIGINS (separadas por vírgula) nos secrets da função.
const allowedOrigins = (
  Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:3000,http://127.0.0.1:3000,http://localhost:4173"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
  if (allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function isOriginAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  // Requisições sem Origin (scripts, testes de integração) seguem para a validação do JWT.
  return origin === null || allowedOrigins.includes(origin);
}
