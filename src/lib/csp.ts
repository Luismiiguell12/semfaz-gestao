// Content Security Policy aplicada por <meta http-equiv>, pois o GitHub Pages
// não permite cabeçalhos HTTP personalizados. Limitações documentadas em
// docs/deployment.md (frame-ancestors, report-uri e sandbox não funcionam via meta).
export function buildCsp(supabaseUrl: string, isDev: boolean): string {
  let supabaseOrigin = "";
  let supabaseWs = "";
  try {
    const u = new URL(supabaseUrl);
    supabaseOrigin = u.origin;
    supabaseWs = `${u.protocol === "https:" ? "wss:" : "ws:"}//${u.host}`;
  } catch {
    // URL ausente: a aplicação exibirá erro de configuração.
  }
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // O Next.js em exportação estática injeta scripts inline de hidratação
    // (sem nonce possível sem servidor). 'unsafe-eval' somente em desenvolvimento.
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", supabaseOrigin].filter(Boolean),
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", supabaseOrigin, supabaseWs, ...(isDev ? ["ws:"] : [])].filter(Boolean),
    "frame-src": ["'self'", supabaseOrigin].filter(Boolean),
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
  };
  const policy = Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ");
  // Só força HTTPS quando o backend é HTTPS (homologação/produção).
  return supabaseUrl.startsWith("https://") ? `${policy}; upgrade-insecure-requests` : policy;
}
