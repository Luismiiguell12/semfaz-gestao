// Configuração do ambiente de integração: SEMPRE o Supabase local.
// As chaves vêm de `supabase status -o env` (chaves de demonstração do ambiente
// local, não secretas). Nada aqui pode apontar para homologação ou produção.
import { execSync } from "node:child_process";

function readLocalStatus(): Record<string, string> {
  const out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const env: Record<string, string> = {};
  for (const line of out.split("\n")) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const status = readLocalStatus();
export const SUPABASE_URL = status.API_URL;
export const ANON_KEY = status.ANON_KEY;
export const SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
export const MAILPIT_URL = status.MAILPIT_URL ?? status.INBUCKET_URL;
export const DB_URL = status.DB_URL;

if (!SUPABASE_URL?.startsWith("http://127.0.0.1") && !SUPABASE_URL?.startsWith("http://localhost")) {
  throw new Error("Testes de integração só podem rodar contra o Supabase local.");
}
