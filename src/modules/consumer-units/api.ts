"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { toAppError } from "@/lib/errors";
import type { Database } from "@/types/database";

export type ConsumerUnit = Database["public"]["Tables"]["consumer_units"]["Row"];
export type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
export type Assignment = Database["public"]["Tables"]["unit_assignments"]["Row"] & {
  properties: { name: string; department_id?: string } | null;
};

/**
 * Imóvel da unidade numa competência (mesma regra do banco): o vínculo vigente
 * no último dia do mês; se não houver, o vigente no primeiro dia.
 */
export function assignmentAt(assignments: Assignment[], competence: string): Assignment | null {
  if (!/^\d{4}-\d{2}$/.test(competence)) return null;
  const [y, m] = competence.split("-").map(Number) as [number, number];
  const first = `${competence}-01`;
  const last = `${competence}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  const at = (d: string) =>
    assignments.find((a) => a.start_date <= d && (a.end_date === null || a.end_date >= d));
  return at(last) ?? at(first) ?? null;
}

export const SUPPLIER_KIND_LABEL: Record<Database["public"]["Enums"]["supplier_kind"], string> = {
  energy: "Energia",
  water: "Água",
};

export const utilityKeys = {
  units: ["consumer-units", "units"] as const,
  unit: (id: string) => ["consumer-units", "unit", id] as const,
  suppliers: ["consumer-units", "suppliers"] as const,
  byProperty: (id: string) => ["consumer-units", "property", id] as const,
};

export function useSuppliers() {
  return useQuery({
    queryKey: utilityKeys.suppliers,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabase().from("suppliers").select("*").order("name");
      if (error) throw toAppError(error);
      return data;
    },
  });
}

/** Unidades com o vínculo aberto (imóvel atual), se houver. */
export function useConsumerUnits() {
  return useQuery({
    queryKey: utilityKeys.units,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("consumer_units")
        .select(
          "*, suppliers(name, kind), unit_assignments(id, property_id, start_date, end_date, properties(name, department_id))",
        )
        .order("identifier");
      if (error) throw toAppError(error);
      return (data ?? []).map((u) => ({
        ...u,
        current: (u.unit_assignments as unknown as Assignment[]).find((a) => a.end_date === null) ?? null,
      }));
    },
  });
}

export function useConsumerUnit(id: string | null) {
  return useQuery({
    queryKey: utilityKeys.unit(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const s = getSupabase();
      const [unit, assignments, consumption] = await Promise.all([
        s.from("consumer_units").select("*, suppliers(name, kind)").eq("id", id!).maybeSingle(),
        s
          .from("unit_assignments")
          .select("*, properties(name, department_id)")
          .eq("unit_id", id!)
          .order("start_date", { ascending: false }),
        s
          .from("consumption_records")
          .select("*")
          .eq("unit_id", id!)
          .order("competence", { ascending: false })
          .limit(24),
      ]);
      for (const r of [unit, assignments, consumption]) if (r.error) throw toAppError(r.error);
      return {
        unit: unit.data,
        assignments: (assignments.data ?? []) as unknown as Assignment[],
        consumption: consumption.data ?? [],
      };
    },
  });
}

export function usePropertyUnits(propertyId: string | null) {
  return useQuery({
    queryKey: utilityKeys.byProperty(propertyId ?? ""),
    enabled: Boolean(propertyId),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("unit_assignments")
        .select("*, consumer_units(id, identifier, holder_name, suppliers(name, kind))")
        .eq("property_id", propertyId!)
        .order("start_date", { ascending: false });
      if (error) throw toAppError(error);
      return data;
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["consumer-units"] });
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(fn as never, args as never);
  if (error) throw toAppError(error);
  return data as T;
}

export function useSaveUnit() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string | null; data: Record<string, unknown>; reason?: string }) =>
      rpc<string>("save_consumer_unit", { p_unit_id: v.id, p_data: v.data, p_reason: v.reason ?? "" }),
    onSuccess: invalidate,
  });
}

export function useAssignUnit() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { unitId: string; propertyId: string; startDate: string; reason: string }) =>
      rpc<string>("assign_consumer_unit", {
        p_unit_id: v.unitId,
        p_property_id: v.propertyId,
        p_start_date: v.startDate,
        p_reason: v.reason,
      }),
    onSuccess: invalidate,
  });
}

export function useEndAssignment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { unitId: string; endDate: string; reason: string }) =>
      rpc<void>("end_consumer_unit_assignment", {
        p_unit_id: v.unitId,
        p_end_date: v.endDate,
        p_reason: v.reason,
      }),
    onSuccess: invalidate,
  });
}
