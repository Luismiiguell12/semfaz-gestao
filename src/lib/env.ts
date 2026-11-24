// Somente a URL e a chave pública (anon) do Supabase vão para o build.
// Ambas são públicas por natureza; a proteção dos dados é a RLS.
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "/semfaz-gestao",
  environment: (process.env.NEXT_PUBLIC_APP_ENV ?? "development") as "development" | "staging" | "production",
};

export function assertEnv() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error("Configuração ausente: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
}

/** URL absoluta de uma rota da aplicação (para links de e-mail de autenticação). */
export function appUrl(path: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${env.basePath}${path}`;
}
