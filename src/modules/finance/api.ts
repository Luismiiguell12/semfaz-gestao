"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { toAppError } from "@/lib/errors";
import type { Database } from "@/types/database";
import type { ApprovalRequest } from "@/modules/approvals/api";

export type InvoiceOverview = Database["public"]["Views"]["invoices_overview"]["Row"];
export type RentOverview = Database["public"]["Views"]["rent_charges_overview"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type ChargeStatus = "pending" | "partially_paid" | "paid" | "overdue" | "cancelled";

export const CHARGE_STATUS_LABEL: Record<ChargeStatus, string> = {
  pending: "Pendente",
  partially_paid: "Parcialmente paga",
  paid: "Paga",
  overdue: "Vencida",
  cancelled: "Cancelada",
};

export const financeKeys = {
  invoices: ["finance", "invoices"] as const,
  invoice: (id: string) => ["finance", "invoice", id] as const,
  rents: ["finance", "rents"] as const,
  rent: (id: string) => ["finance", "rent", id] as const,
  stats: ["dashboard", "finance"] as const,
};

/** Competência "AAAA-MM-01" → "MM/AAAA". */
export function formatCompetence(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m] = value.split("-");
  return `${m}/${y}`;
}

export function useInvoices(filter?: { propertyId?: string; unitId?: string; contractId?: string }) {
  return useQuery({
    queryKey: [...financeKeys.invoices, filter ?? {}],
    queryFn: async () => {
      let q = getSupabase()
        .from("invoices_overview")
        .select("*")
        .order("competence", { ascending: false })
        .limit(500);
      if (filter?.propertyId) q = q.eq("property_id", filter.propertyId);
      if (filter?.unitId) q = q.eq("unit_id", filter.unitId);
      const { data, error } = await q;
      if (error) throw toAppError(error);
      return data;
    },
  });
}

export function useInvoice(id: string | null) {
  return useQuery({
    queryKey: financeKeys.invoice(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const s = getSupabase();
      const [inv, payments, consumption, alerts] = await Promise.all([
        s.from("invoices_overview").select("*").eq("id", id!).maybeSingle(),
        s.from("payments").select("*").eq("invoice_id", id!).order("created_at"),
        s.from("consumption_records").select("*").eq("invoice_id", id!).maybeSingle(),
        s.from("alerts").select("*").eq("entity_id", id!).order("created_at", { ascending: false }),
      ]);
      for (const r of [inv, payments, consumption, alerts]) if (r.error) throw toAppError(r.error);
      return {
        invoice: inv.data,
        payments: payments.data ?? [],
        consumption: consumption.data,
        alerts: alerts.data ?? [],
      };
    },
  });
}

export function useRents(filter?: { contractId?: string; propertyId?: string }) {
  return useQuery({
    queryKey: [...financeKeys.rents, filter ?? {}],
    queryFn: async () => {
      let q = getSupabase()
        .from("rent_charges_overview")
        .select("*")
        .order("competence", { ascending: false })
        .limit(500);
      if (filter?.contractId) q = q.eq("contract_id", filter.contractId);
      if (filter?.propertyId) q = q.eq("property_id", filter.propertyId);
      const { data, error } = await q;
      if (error) throw toAppError(error);
      return data;
    },
  });
}

export function useRent(id: string | null) {
  return useQuery({
    queryKey: financeKeys.rent(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const s = getSupabase();
      const [rent, payments] = await Promise.all([
        s.from("rent_charges_overview").select("*").eq("id", id!).maybeSingle(),
        s.from("payments").select("*").eq("rent_charge_id", id!).order("created_at"),
      ]);
      for (const r of [rent, payments]) if (r.error) throw toAppError(r.error);
      return { rent: rent.data, payments: payments.data ?? [] };
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["finance"] }),
      qc.invalidateQueries({ queryKey: ["approvals"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(fn as never, args as never);
  if (error) throw toAppError(error);
  return data as T;
}

export function useCreateInvoice() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { data: Record<string, unknown>; justification?: string }) => {
      const { data, error } = await getSupabase().rpc("create_invoice", {
        p_data: v.data as never,
        p_justification: v.justification ?? "",
      });
      if (error) {
        const e = toAppError(error);
        (e as Error & { duplicate?: boolean }).duplicate =
          (error as { hint?: string }).hint === "duplicate_invoice";
        throw e;
      }
      return data as unknown as { invoice_id?: string; approval_request_id?: string; status?: string };
    },
    onSuccess: invalidate,
  });
}

export function useRequestInvoiceCorrection() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; data: Record<string, unknown>; justification: string }) =>
      rpc<ApprovalRequest>("request_invoice_correction", {
        p_invoice_id: v.id,
        p_data: v.data,
        p_justification: v.justification,
      }),
    onSuccess: invalidate,
  });
}

export function useRequestInvoiceCancel() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; justification: string }) =>
      rpc<ApprovalRequest>("request_invoice_cancel", {
        p_invoice_id: v.id,
        p_justification: v.justification,
      }),
    onSuccess: invalidate,
  });
}

export function useRequestRentCorrection() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; amount: string; justification: string }) =>
      rpc<ApprovalRequest>("request_rent_correction", {
        p_rent_id: v.id,
        p_amount: v.amount,
        p_justification: v.justification,
      }),
    onSuccess: invalidate,
  });
}

export function useRequestRentCancel() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; justification: string }) =>
      rpc<ApprovalRequest>("request_rent_cancel", { p_rent_id: v.id, p_justification: v.justification }),
    onSuccess: invalidate,
  });
}

export function useRequestPayment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { data: Record<string, unknown>; justification: string }) =>
      rpc<ApprovalRequest>("request_payment", { p_data: v.data, p_justification: v.justification }),
    onSuccess: invalidate,
  });
}

export interface FinanceStats {
  invoices_pending: number;
  invoices_overdue: number;
  invoices_open_amount: string;
  rents_open_amount: string;
  rents_overdue: number;
  series: { competence: string; rent: string; water: string; energy: string }[];
  by_property: { name: string; total: string }[];
  can_view: boolean;
}

export function useFinanceStats(months = 12, departmentId?: string) {
  return useQuery({
    queryKey: [...financeKeys.stats, months, departmentId ?? null],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("dashboard_finance_stats", {
        p_months: months,
        p_department_id: (departmentId ?? null) as string,
      });
      if (error) throw toAppError(error);
      return data as unknown as FinanceStats;
    },
  });
}
