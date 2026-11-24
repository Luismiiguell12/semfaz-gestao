"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BellOff, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/modules/notifications/api";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function NotificationsPage() {
  const router = useRouter();
  const [filter, setFilter] = React.useState<"unread" | "all">("unread");
  const list = useNotifications(filter);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const hasUnread = (list.data ?? []).some((n) => !n.read_at);

  return (
    <>
      <PageHeader
        title="Notificações"
        description="Avisos do sistema sobre sua conta e, nas próximas fases, sobre demandas, contratos, faturas e aprovações."
        actions={
          hasUnread && (
            <Button
              variant="outline"
              loading={markAll.isPending}
              onClick={() =>
                markAll.mutate(undefined, {
                  onSuccess: (n) =>
                    toast.success(
                      `${n} ${n === 1 ? "notificação marcada" : "notificações marcadas"} como lida${n === 1 ? "" : "s"}.`,
                    ),
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              <CheckCheck aria-hidden="true" /> Marcar todas como lidas
            </Button>
          )
        }
      />
      <Panel bodyClassName="p-0">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as "unread" | "all")} className="px-4 pt-2">
          <TabsList className="border-b-0">
            <TabsTrigger value="unread">Não lidas</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="border-t">
          {list.isLoading && <LoadingRows rows={4} />}
          {list.isError && <ErrorState message={list.error.message} onRetry={() => list.refetch()} />}
          {list.data && list.data.length === 0 && (
            <EmptyState
              icon={BellOff}
              title={filter === "unread" ? "Nenhuma notificação não lida" : "Nenhuma notificação"}
              description="Quando houver avisos para você, eles aparecerão aqui e no sino do cabeçalho."
            />
          )}
          <ul className="divide-y">
            {list.data?.map((n) => (
              <li
                key={n.id}
                className={cn(
                  "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start",
                  !n.read_at && "bg-primary-soft/40",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 hidden size-2 shrink-0 rounded-full sm:block",
                    n.read_at ? "bg-border" : "bg-primary",
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", !n.read_at && "font-semibold")}>
                    {n.title}
                    {!n.read_at && <span className="sr-only"> (não lida)</span>}
                  </p>
                  {n.body && <p className="text-muted-foreground mt-0.5 text-sm">{n.body}</p>}
                  <p className="tabular text-muted-foreground mt-1 text-xs">{formatDateTime(n.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  {n.link_path && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!n.read_at) markRead.mutate(n.id);
                        router.push(n.link_path!);
                      }}
                    >
                      Abrir
                    </Button>
                  )}
                  {!n.read_at && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markRead.mutate(n.id, { onError: (e) => toast.error(e.message) })}
                    >
                      Marcar como lida
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Panel>
    </>
  );
}
