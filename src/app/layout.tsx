import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/providers/app-providers";
import { buildCsp } from "@/lib/csp";

export const metadata: Metadata = {
  title: { default: "SEMFAZ Gestão", template: "%s | SEMFAZ Gestão" },
  description:
    "Plataforma de gestão administrativa da Secretaria Municipal da Fazenda — Prefeitura Municipal de Lagarto.",
  applicationName: "SEMFAZ Gestão",
  robots: { index: false, follow: false },
  referrer: "strict-origin-when-cross-origin",
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? "/semfaz-gestao"}/icon.svg` },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e2a47",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const csp = buildCsp(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NODE_ENV === "development");
  return (
    <html lang="pt-BR">
      <head>
        <meta httpEquiv="Content-Security-Policy" content={csp} />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
      </head>
      <body>
        <a
          href="#conteudo"
          className="bg-primary text-primary-foreground sr-only z-[100] rounded-md px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Pular para o conteúdo
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
