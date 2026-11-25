"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { toAppError } from "@/lib/errors";
import type { Database } from "@/types/database";

export type ApprovalRequest = Database["public"]["Tables"]["approval_requests"]["Row"] & {
  approval_operations: { description: string; module: string } | null;
};
export type ApprovalStatus = Database["public"]["Enums"]["approval_status"];

export const APPROVAL_STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Rejeitada",
  cancelled: "Cancelada",
  failed: "Não efetivada",
};

export const approvalKeys = {
  all: ["approvals"] as const,
  list: (filter: string) => ["approvals", "list", filter] as const,
  detail: (id: string) => ["approvals", "detail", id] as const,
  entity: (id: string) => ["approvals", "entity", id] as const,
};

const SELECT = "*, approval_operations(description, module)";

export function useApprovalRequests(filter: "to_review" | "mine" | "all", userId: string | undefined) {
  return useQuery({
    queryKey: approvalKeys.list(filter),
    enabled: Boolean(userId),
    queryFn: async () => {
      let q = getSupabase()
        .from("approval_requests")
        .select(SELECT)
        .order("requested_at", { ascending: false })
        .limit(300);
      if (filter === "to_review") q = q.eq("status", "pending").neq("requested_by", userId!);
      if (filter === "mine") q = q.eq("requested_by", userId!);
      const { data, error } = await q;
      if (error) throw toAppError(error);
      return data as unknown as ApprovalRequest[];
    },
  });
}

export function useEntityApprovals(entityId: string | undefined) {
  return useQuery({
    queryKey: approvalKeys.entity(entityId ?? ""),
    enabled: Boolean(entityId),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("approval_requests")
        .select(SELECT)
        .or(`entity_id.eq.${entityId},result_entity_id.eq.${entityId}`)
        .order("requested_at", { ascending: false });
      if (error) throw toAppError(error);
      return data as unknown as ApprovalRequest[];
    },
  });
}

export function useApprovalRequest(id: string | null) {
  return useQuery({
    queryKey: approvalKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const supabase = getSupabase();
      const [req, decisions] = await Promise.all([
        supabase.from("approval_requests").select(SELECT).eq("id", id!).maybeSingle(),
        supabase.from("approval_decisions").select("*").eq("request_id", id!).order("decided_at"),
      ]);
      if (req.error) throw toAppError(req.error);
      if (decisions.error) throw toAppError(decisions.error);
      return { request: req.data as unknown as ApprovalRequest | null, decisions: decisions.data };
    },
  });
}

function useInvalidateAll() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: approvalKeys.all }),
      qc.invalidateQueries({ queryKey: ["properties"] }),
      qc.invalidateQueries({ queryKey: ["contracts"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
      qc.invalidateQueries({ queryKey: ["notifications"] }),
    ]);
}

export function useDecideApproval() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({
      id,
      decision,
      comment,
    }: {
      id: string;
      decision: "approved" | "rejected";
      comment?: string;
    }) => {
      const { data, error } = await getSupabase().rpc("decide_approval", {
        p_request_id: id,
        p_decision: decision,
        p_comment: comment ?? "",
      });
      if (error) throw toAppError(error);
      return data as unknown as ApprovalRequest;
    },
    onSuccess: invalidate,
  });
}

export function useCancelApproval() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await getSupabase().rpc("cancel_approval_request", {
        p_request_id: id,
        p_reason: reason,
      });
      if (error) throw toAppError(error);
    },
    onSuccess: invalidate,
  });
}
