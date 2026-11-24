"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { NAVIGATION, type NavItem } from "./navigation";
import { BrandLockup, BrandMark } from "./brand";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

function NavLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  const base = cn(
    "group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium",
    collapsed && "justify-center px-0",
  );

  if (item.comingSoon) {
    // Módulo de fase futura: visível para orientar, mas sem ação.
    return (
      <span
        aria-disabled="true"
        title={`${item.label}: disponível em breve`}
        className={cn(base, "cursor-not-allowed text-brand-muted/55")}
      >
        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
        <span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span>
        <span className="sr-only"> (em breve)</span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        base,
        "focus-visible:outline-brand-accent",
        active ? "bg-white/10 text-white" : "text-brand-muted hover:bg-white/5 hover:text-white",
      )}
    >
      {/* Marcador de página atual: uma "linha de registro" à esquerda */}
      {active && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r bg-brand-accent" aria-hidden="true" />}
      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
      {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
    </Link>
  );
}

export function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { can } = useAuth();
  return (
    <nav aria-label="Menu principal" className="flex-1 overflow-y-auto px-3 py-4">
      {NAVIGATION.map((section) => {
        const items = section.items.filter((i) => !i.permission || can(i.permission));
        if (items.length === 0) return null;
        return (
          <div key={section.label} className="mb-5">
            {!collapsed ? (
              <p className="mb-1.5 flex items-center justify-between px-3 text-xs font-semibold text-brand-muted/80">
                {section.label}
                {items.every((i) => i.comingSoon) && (
                  <span className="rounded-sm border border-brand-muted/30 px-1.5 py-px text-[10px] font-semibold whitespace-nowrap text-brand-muted">
                    Em breve
                  </span>
                )}
              </p>
            ) : (
              <div className="mx-auto mb-2 h-px w-6 bg-white/10" aria-hidden="true" />
            )}
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} collapsed={collapsed} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function DesktopSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col bg-brand text-brand-foreground transition-[width] duration-200 lg:flex",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-white/10", collapsed ? "justify-center px-2" : "px-5")}>
        {collapsed ? <BrandMark inverted /> : <BrandLockup />}
      </div>
      <SidebarNav collapsed={collapsed} />
      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className={cn(
            "flex h-9 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-sm text-brand-muted hover:bg-white/5 hover:text-white focus-visible:outline-brand-accent",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? <PanelLeftOpen className="size-[18px]" aria-hidden="true" /> : <PanelLeftClose className="size-[18px]" aria-hidden="true" />}
          {collapsed ? <span className="sr-only">Expandir menu</span> : <span>Recolher menu</span>}
        </button>
      </div>
    </aside>
  );
}
