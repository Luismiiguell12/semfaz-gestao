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

function NavLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  const base = cn(
    "group relative flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
    collapsed && "justify-center px-0",
  );

  if (item.comingSoon) {
    // Módulo de fase futura: visível para orientar, mas sem ação.
    return (
      <span
        aria-disabled="true"
        title={`${item.label}: disponível em breve`}
        className={cn(base, "text-brand-muted/55 cursor-not-allowed")}
      >
        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
        <span className={collapsed ? "sr-only" : "min-w-0 flex-1 leading-tight"}>{item.label}</span>
        {collapsed ? (
          <span className="sr-only"> (em breve)</span>
        ) : (
          <span className="border-brand-muted/30 text-brand-muted shrink-0 rounded-sm border px-1.5 py-px text-[10px] font-semibold whitespace-nowrap">
            Em breve
          </span>
        )}
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
      {active && (
        <span
          className="bg-brand-accent absolute top-2 bottom-2 left-0 w-[3px] rounded-r"
          aria-hidden="true"
        />
      )}
      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
      {collapsed ? (
        <span className="sr-only">{item.label}</span>
      ) : (
        <span className="min-w-0 leading-tight">{item.label}</span>
      )}
    </Link>
  );
}

export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { can } = useAuth();
  return (
    <nav aria-label="Menu principal" className="flex-1 overflow-y-auto px-3 py-4">
      {NAVIGATION.map((section) => {
        const items = section.items.filter((i) => !i.permission || can(i.permission));
        if (items.length === 0) return null;
        return (
          <div key={section.label} className="mb-5">
            {!collapsed ? (
              <p className="text-brand-muted/80 mb-1.5 flex items-center justify-between px-3 text-xs font-semibold">
                {section.label}
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
        "bg-brand text-brand-foreground sticky top-0 hidden h-dvh shrink-0 flex-col transition-[width] duration-200 lg:flex",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b border-white/10",
          collapsed ? "justify-center px-2" : "px-5",
        )}
      >
        {collapsed ? <BrandMark inverted /> : <BrandLockup />}
      </div>
      <SidebarNav collapsed={collapsed} />
      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className={cn(
            "text-brand-muted focus-visible:outline-brand-accent flex h-9 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-sm hover:bg-white/5 hover:text-white",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-[18px]" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="size-[18px]" aria-hidden="true" />
          )}
          {collapsed ? <span className="sr-only">Expandir menu</span> : <span>Recolher menu</span>}
        </button>
      </div>
    </aside>
  );
}
