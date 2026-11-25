"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { toAppError } from "@/lib/errors";
import type { Database } from "@/types/database";
import type { ApprovalRequest } from "@/modules/approvals/api";

export type Property = Database["public"]["Tables"]["properties"]["Row"];
export type PropertyStatus = Database["public"]["Enums"]["property_status"];

export const PROPERTY_STATUS_LABEL: Record<PropertyStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  vacated: "Desocupado",
};

export const propertyKeys = {
  all: ["properties"] as const,
  detail: (id: string) => ["properties", "detail", id] as const,
  landlords: (id: string) => ["properties", "landlords", id] as const,
};

export function useProperties() {
  return useQuery({
    queryKey: propertyKeys.all,
    queryFn: async () => {
      const { data, error } = await getSupabase().from("properties").select("*").order("name");
      if (error) throw toAppError(error);
      return data;
    },
  });
}

export function useProperty(id: string | null) {
  return useQuery({
    queryKey: propertyKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await getSupabase().from("properties").select("*").eq("id", id!).maybeSingle();
      if (error) throw toAppError(error);
      return data;
    },
  });
}

export function usePropertyLandlords(id: string | null) {
  return useQuery({
    queryKey: propertyKeys.landlords(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("property_landlords")
        .select("id, landlord_id, share_percent, landlords(id, name, person_type, document_masked)")
        .eq("property_id", id!);
      if (error) throw toAppError(error);
      return data;
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: propertyKeys.all }),
      qc.invalidateQueries({ queryKey: ["approvals"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(fn as never, args as never);
  if (error) throw toAppError(error);
  return data as T;
}

export function useRequestPropertyCreate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { data: Record<string, unknown>; justification: string }) =>
      rpc<ApprovalRequest>("request_property_create", { p_data: v.data, p_justification: v.justification }),
    onSuccess: invalidate,
  });
}

export function useRequestAddressChange() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; data: Record<string, unknown>; justification: string }) =>
      rpc<ApprovalRequest>("request_property_address_change", {
        p_property_id: v.id,
        p_data: v.data,
        p_justification: v.justification,
      }),
    onSuccess: invalidate,
  });
}

export function useRequestDepartmentChange() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: {
      id: string;
      department_id: string;
      unit_department_id: string | null;
      justification: string;
    }) =>
      rpc<ApprovalRequest>("request_property_department_change", {
        p_property_id: v.id,
        p_department_id: v.department_id,
        p_unit_department_id: v.unit_department_id,
        p_justification: v.justification,
      }),
    onSuccess: invalidate,
  });
}

export function useUpdatePropertyDetails() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; data: Record<string, unknown>; reason: string }) =>
      rpc<Property>("update_property_details", { p_property_id: v.id, p_data: v.data, p_reason: v.reason }),
    onSuccess: invalidate,
  });
}

export function useSetPropertyLandlords(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { items: { landlord_id: string; share_percent?: number }[]; reason: string }) =>
      rpc<void>("set_property_landlords", { p_property_id: id, p_items: v.items, p_reason: v.reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: propertyKeys.landlords(id) }),
  });
}
