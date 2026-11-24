"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationSummary } from "@/modules/notifications/api";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NotificationsMenu() {
  const router = useRouter();
  const { data, isLoading, isError } = useNotificationSummary();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const unread = data?.unreadCount ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notificações: ${unread} não lidas` : "Notificações"}>
          <Bell className="size-5" aria-hidden="true" />
          {unread > 0 && (
            <span className="tabular absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4 font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <DropdownMenuLabel className="p-0 font-semibold">Notificações</DropdownMenuLabel>
          {unread > 0 && (
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1 rounded text-xs font-medium text-primary hover:underline"
              onClick={() => markAll.mutate(undefined, { onError: (e) => toast.error(e.message) })}
            >
              <CheckCheck className="size-3.5" aria-hidden="true" /> Marcar todas como lidas
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-96 overflow-y-auto p-1">
          {isLoading && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Carregando…</p>}
          {isError && <p className="px-3 py-6 text-center text-sm text-danger">Não foi possível carregar as notificações.</p>}
          {data && data.latest.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Você não tem notificações.</p>
          )}
          {data?.latest.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="items-start gap-3 py-2.5"
              onSelect={() => {
                if (!n.read_at) markRead.mutate(n.id);
                if (n.link_path) router.push(n.link_path);
              }}
            >
              <span
                className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-primary")}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", !n.read_at && "font-semibold")}>{n.title}</span>
                {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>}
                <span className="mt-1 block text-xs text-muted-foreground">
                  {formatRelative(n.created_at)}
                  {!n.read_at && <span className="sr-only"> — não lida</span>}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem asChild className="justify-center rounded-none py-2.5 font-medium text-primary">
          <Link href="/notificacoes/">Ver todas</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
