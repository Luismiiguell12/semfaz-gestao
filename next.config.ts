import type { NextConfig } from "next";

/**
 * Exportação estática para o GitHub Pages.
 * Não há servidor Next.js: sem Server Actions, Route Handlers, middleware/proxy,
 * cookies ou renderização sob demanda. Todo o backend fica no Supabase.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/semfaz-gestao";

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
