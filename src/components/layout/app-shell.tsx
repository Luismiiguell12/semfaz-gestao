"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { DesktopSidebar, SidebarNav } from "./sidebar";
import { Breadcrumbs } from "./breadcrumbs";
import { NotificationsMenu } from "./notifications-menu";
import { UserMenu } from "./user-menu";
import { BrandLockup } from "./brand";
import { env } from "@/lib/env";

const COLLAPSE_KEY = "semfaz.sidebar.collapsed";
const listeners = new Set<() => void>();

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false; // armazenamento indisponível: mantém o padrão
  }
}

function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  } catch {
    /* ignora */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  // Preferência visual por navegador (não é dado de negócio).
  const collapsed = React.useSyncExternalStore(subscribe, readCollapsed, () => false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const toggle = () => writeCollapsed(!collapsed);

  return (
    <div className="flex min-h-dvh">
      <DesktopSidebar collapsed={collapsed} onToggle={toggle} />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="bg-brand text-brand-foreground">
          <SheetTitle className="sr-only">Menu principal</SheetTitle>
          <SheetDescription className="sr-only">Navegação entre os módulos do sistema</SheetDescription>
          <div className="flex h-16 items-center border-b border-white/10 px-5">
            <BrandLockup />
          </div>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/95 sticky top-0 z-30 flex h-16 items-center gap-2 border-b px-3 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="size-5" aria-hidden="true" />
          </Button>
          <div className="min-w-0 flex-1">
            <Breadcrumbs />
          </div>
          {env.environment !== "production" && (
            <span className="border-warning-strong/60 bg-warning-soft text-warning hidden rounded-sm border px-2 py-0.5 text-xs font-semibold sm:inline">
              {env.environment === "staging" ? "Homologação" : "Desenvolvimento"}
            </span>
          )}
          <NotificationsMenu />
          <UserMenu />
        </header>
        <main
          id="conteudo"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>
        <footer className="text-muted-foreground flex flex-col gap-0.5 border-t px-4 py-4 text-xs sm:flex-row sm:gap-6 sm:px-8">
          <span>Prefeitura Municipal de Lagarto</span>
          <span>Secretaria Municipal da Fazenda</span>
        </footer>
      </div>
    </div>
  );
}
