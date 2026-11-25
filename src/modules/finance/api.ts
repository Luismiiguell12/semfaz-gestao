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

/** Filtros aplicados no servidor (lista e detalhamento dos relatórios). */
export interface ListQuery {
  propertyId?: string;
  unitId?: string;
  contractId?: string;
  from?: string; // AAAA-MM
  to?: string;
  departmentIds?: string[];
  statuses?: string[];
  kinds?: string[];
  supplierId?: string;
  contractIds?: string[];
}

export function useInvoices(filter?: ListQuery, enabled = true) {
  return useQuery({
    queryKey: [...financeKeys.invoices, filter ?? {}],
    enabled,
    queryFn: async () => {
      let q = getSupabase()
        .from("invoices_overview")
        .select("*")
        .order("competence", { ascending: false })
        .limit(1000);
      if (filter?.propertyId) q = q.eq("property_id", filter.propertyId);
      if (filter?.unitId) q = q.eq("unit_id", filter.unitId);
      if (filter?.from) q = q.gte("competence", `${filter.from}-01`);
      if (filter?.to) q = q.lte("competence", `${filter.to}-01`);
      if (filter?.departmentIds) q = q.in("department_id", filter.departmentIds);
      if (filter?.statuses?.length) q = q.in("status", filter.statuses);
      if (filter?.kinds?.length) q = q.in("supplier_kind", filter.kinds as ("water" | "energy")[]);
      if (filter?.supplierId) q = q.eq("supplier_id", filter.supplierId);
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

export function useRents(filter?: ListQuery, enabled = true) {
  return useQuery({
    queryKey: [...financeKeys.rents, filter ?? {}],
    enabled,
    queryFn: async () => {
      let q = getSupabase()
        .from("rent_charges_overview")
        .select("*")
        .order("competence", { ascending: false })
        .limit(1000);
      if (filter?.contractId) q = q.eq("contract_id", filter.contractId);
      if (filter?.propertyId) q = q.eq("property_id", filter.propertyId);
      if (filter?.from) q = q.gte("competence", `${filter.from}-01`);
      if (filter?.to) q = q.lte("competence", `${filter.to}-01`);
      if (filter?.departmentIds) q = q.in("department_id", filter.departmentIds);
      if (filter?.statuses?.length) q = q.in("status", filter.statuses);
      if (filter?.contractIds) q = q.in("contract_id", filter.contractIds);
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
  by_property: { id?: string; name: string; total: string }[];
  can_view: boolean;
  can_view_reports?: boolean;
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

// ---------------------------------------------------------------- Relatórios de despesas
export type ExpenseKind = "rent" | "water" | "energy";
export const EXPENSE_KIND_LABEL: Record<ExpenseKind, string> = {
  rent: "Aluguel",
  water: "Água",
  energy: "Energia",
};
export type ExpenseStatus = "paid" | "pending" | "partially_paid" | "overdue";

export interface ExpenseFilters {
  start: string; // AAAA-MM-01
  end: string;
  basis: "competence" | "payment";
  kinds: ExpenseKind[];
  statuses: ExpenseStatus[];
  department_id?: string;
  property_id?: string;
  counterpart_id?: string;
}

interface Totals {
  total: string;
  paid: string;
  pending: string;
  overdue: string;
}

export interface ExpenseReport {
  filters: { start: string; end: string; basis: string };
  summary: Totals & { items: number };
  by_kind: (Totals & { kind: ExpenseKind })[];
  by_property: (Totals & { id: string; name: string | null })[];
  by_department: (Totals & { id: string; name: string | null })[];
  by_counterpart: { id: string | null; type: "supplier" | "landlord"; name: string | null; total: string }[];
  monthly: { period: string; rent: string; water: string; energy: string; total: string }[];
  comparison: {
    available: boolean;
    previous_start: string;
    previous_end: string;
    total_current: string;
    total_previous: string;
    by_kind: { kind: ExpenseKind; current: string; previous: string; diff: string; percent: string | null }[];
  };
  consumption: {
    property_id: string;
    property_name: string | null;
    period: string;
    kind: "water" | "energy";
    measure_unit: string;
    consumption: string;
    amount: string;
  }[];
}

export function useExpenseReport(filters: ExpenseFilters) {
  return useQuery({
    queryKey: ["finance", "expense-report", filters],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("expense_report", { p_filters: filters as never });
      if (error) throw toAppError(error);
      return data as unknown as ExpenseReport;
    },
  });
}

// ---------------------------------------------------------------- Pagamentos
export interface PaymentRow {
  id: string;
  kind: "payment" | "reversal";
  amount: number | string;
  paid_on: string;
  created_at: string;
  notes: string | null;
  reversal_of: string | null;
  invoice_id: string | null;
  rent_charge_id: string | null;
}

export function usePayments() {
  return useQuery({
    queryKey: ["finance", "payments"],
    queryFn: async () => {
      const s = getSupabase();
      const pays = await s
        .from("payments")
        .select("id, kind, amount, paid_on, created_at, notes, reversal_of, invoice_id, rent_charge_id")
        .order("paid_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1000);
      if (pays.error) throw toAppError(pays.error);
      const invoiceIds = [...new Set(pays.data.map((p) => p.invoice_id).filter(Boolean))] as string[];
      const rentIds = [...new Set(pays.data.map((p) => p.rent_charge_id).filter(Boolean))] as string[];
      const [inv, rent] = await Promise.all([
        invoiceIds.length
          ? s
              .from("invoices_overview")
              .select(
                "id, competence, property_id, property_name, department_id, supplier_name, supplier_kind, unit_identifier, supplier_id",
              )
              .in("id", invoiceIds)
          : Promise.resolve({ data: [], error: null }),
        rentIds.length
          ? s
              .from("rent_charges_overview")
              .select(
                "id, competence, property_id, property_name, department_id, contract_id, contract_number",
              )
              .in("id", rentIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (inv.error) throw toAppError(inv.error);
      if (rent.error) throw toAppError(rent.error);
      const invMap = new Map((inv.data ?? []).map((i) => [i.id!, i]));
      const rentMap = new Map((rent.data ?? []).map((r) => [r.id!, r]));
      return pays.data.map((p) => {
        const i = p.invoice_id ? invMap.get(p.invoice_id) : undefined;
        const r = p.rent_charge_id ? rentMap.get(p.rent_charge_id) : undefined;
        return {
          ...(p as PaymentRow),
          kind_of_expense: (i ? i.supplier_kind : "rent") as ExpenseKind,
          competence: (i?.competence ?? r?.competence ?? null) as string | null,
          property_id: (i?.property_id ?? r?.property_id ?? null) as string | null,
          property_name: (i?.property_name ?? r?.property_name ?? null) as string | null,
          department_id: (i?.department_id ?? r?.department_id ?? null) as string | null,
          supplier_id: (i?.supplier_id ?? null) as string | null,
          contract_id: (r?.contract_id ?? null) as string | null,
          description: i
            ? `${i.supplier_name} ${i.unit_identifier}`
            : r
              ? `Aluguel do contrato ${r.contract_number}`
              : "Lançamento",
          href: p.invoice_id
            ? `/financeiro/faturas/detalhe/?id=${p.invoice_id}`
            : `/financeiro/alugueis/detalhe/?id=${p.rent_charge_id}`,
        };
      });
    },
  });
}
export type PaymentListRow = NonNullable<ReturnType<typeof usePayments>["data"]>[number];

export type ExpenseItem = Database["public"]["Views"]["expense_items"]["Row"];

/** Faturas e aluguéis que compõem um total dos relatórios (base competência). */
export function useExpenseItems(filter: ListQuery, enabled = true) {
  return useQuery({
    queryKey: ["finance", "expense-items", filter],
    enabled,
    queryFn: async () => {
      let q = getSupabase()
        .from("expense_items")
        .select("*")
        .neq("status", "cancelled")
        .order("competence", { ascending: false })
        .limit(2000);
      if (filter.from) q = q.gte("competence", `${filter.from}-01`);
      if (filter.to) q = q.lte("competence", `${filter.to}-01`);
      if (filter.propertyId) q = q.eq("property_id", filter.propertyId);
      if (filter.departmentIds) q = q.in("department_id", filter.departmentIds);
      if (filter.statuses?.length) q = q.in("status", filter.statuses);
      if (filter.kinds?.length) q = q.in("kind", filter.kinds);
      if (filter.supplierId) q = q.eq("supplier_id", filter.supplierId);
      if (filter.contractIds) q = q.in("contract_id", filter.contractIds);
      const { data, error } = await q;
      if (error) throw toAppError(error);
      return data;
    },
  });
}
