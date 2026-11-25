"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ROUTE_LABELS } from "./navigation";

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = [
    { href: "/", label: "Painel" },
    ...segments.map((seg, i) => ({
      href: `/${segments.slice(0, i + 1).join("/")}/`,
      label: ROUTE_LABELS[seg] ?? seg,
    })),
  ];
  return (
    <nav aria-label="Trilha de navegação" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          // "Administração" não tem página própria: exibido como texto.
          const linkable = !last && c.href !== "/administracao/" && c.href !== "/financeiro/";
          return (
            <li key={c.href} className={`flex min-w-0 items-center gap-1 ${!last ? "hidden sm:flex" : ""}`}>
              {i > 0 && (
                <ChevronRight className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
              )}
              {linkable ? (
                <Link
                  href={c.href}
                  className="text-muted-foreground hover:text-foreground truncate hover:underline"
                >
                  {c.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={`truncate ${last ? "text-foreground font-semibold" : "text-muted-foreground"}`}
                >
                  {c.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
