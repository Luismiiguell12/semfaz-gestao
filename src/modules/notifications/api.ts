"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { toAppError } from "@/lib/errors";
import type { Database } from "@/types/database";

export type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (filter: "all" | "unread") => ["notifications", "list", filter] as const,
  summary: ["notifications", "summary"] as const,
};

/** Resumo para o cabeçalho: não lidas + últimas notificações. Atualiza a cada minuto. */
export function useNotificationSummary(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.summary,
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const supabase = getSupabase();
      const [unread, latest] = await Promise.all([
        supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
        supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(8),
      ]);
      if (unread.error) throw toAppError(unread.error);
      if (latest.error) throw toAppError(latest.error);
      return { unreadCount: unread.count ?? 0, latest: latest.data };
    },
  });
}

export function useNotifications(filter: "all" | "unread") {
  return useQuery({
    queryKey: notificationKeys.list(filter),
    queryFn: async () => {
      let q = getSupabase().from("notifications").select("*").order("created_at", { ascending: false }).limit(200);
      if (filter === "unread") q = q.is("read_at", null);
      const { data, error } = await q;
      if (error) throw toAppError(error);
      return data;
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().rpc("mark_notification_read", { p_notification_id: id });
      if (error) throw toAppError(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabase().rpc("mark_all_notifications_read");
      if (error) throw toAppError(error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
