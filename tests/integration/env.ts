// Configuração do ambiente de integração: SEMPRE o Supabase local.
// As chaves vêm de `supabase status -o env` (chaves de demonstração do ambiente
// local, não secretas). Nada aqui pode apontar para homologação ou produção.
import { execSync } from "node:child_process";

function readLocalStatus(): Record<string, string> {
  const out = execSync("npx supabase status -o env", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const env: Record<string, string> = {};
  for (const line of out.split("\n")) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m?.[1]) env[m[1]] = m[2] ?? "";
  }
  return env;
}

const status = readLocalStatus();
function required(key: string): string {
  const v = status[key];
  if (!v)
    throw new Error(
      `Supabase local não está em execução (variável ${key} ausente). Rode: npx supabase start`,
    );
  return v;
}
export const SUPABASE_URL = required("API_URL");
export const ANON_KEY = required("ANON_KEY");
export const SERVICE_ROLE_KEY = required("SERVICE_ROLE_KEY");
export const MAILPIT_URL = status.MAILPIT_URL ?? status.INBUCKET_URL ?? "http://127.0.0.1:54324";

if (!SUPABASE_URL.startsWith("http://127.0.0.1") && !SUPABASE_URL.startsWith("http://localhost")) {
  throw new Error("Testes de integração só podem rodar contra o Supabase local.");
}
