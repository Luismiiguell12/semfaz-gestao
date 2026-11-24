"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { toAppError } from "@/lib/errors";
import type { Database } from "@/types/database";
import { departmentSchema, type DepartmentInput } from "@shared/schemas/organization.ts";

export type Department = Database["public"]["Tables"]["departments"]["Row"];
export type DepartmentKind = Database["public"]["Enums"]["department_kind"];

export const DEPARTMENT_KIND_LABEL: Record<DepartmentKind, string> = {
  secretariat: "Secretaria",
  directorate: "Diretoria",
  unit: "Unidade",
};

export const departmentKeys = { all: ["departments"] as const };

export function useDepartments() {
  return useQuery({
    queryKey: departmentKeys.all,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("departments")
        .select("*")
        .is("deleted_at", null)
        .order("name");
      if (error) throw toAppError(error);
      return data;
    },
  });
}

export interface DepartmentNode extends Department {
  depth: number;
  path: string;
}

/** Ordena em árvore (secretaria → diretoria → unidade) para exibição. */
export function toTree(departments: Department[]): DepartmentNode[] {
  const byParent = new Map<string | null, Department[]>();
  for (const d of departments) {
    const key = d.parent_id ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), d]);
  }
  const out: DepartmentNode[] = [];
  const walk = (parent: string | null, depth: number, path: string) => {
    for (const d of (byParent.get(parent) ?? []).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))) {
      const p = path ? `${path} › ${d.acronym ?? d.name}` : (d.acronym ?? d.name);
      out.push({ ...d, depth, path: p });
      walk(d.id, depth + 1, p);
    }
  };
  walk(null, 0, "");
  return out;
}

export function useSaveDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: DepartmentInput }) => {
      const parsed = departmentSchema.parse(values);
      const supabase = getSupabase();
      const row = {
        kind: parsed.kind,
        name: parsed.name,
        acronym: parsed.acronym ?? null,
        parent_id: parsed.parent_id ?? null,
        is_active: parsed.is_active,
      };
      if (id) {
        const { error } = await supabase.from("departments").update(row).eq("id", id);
        if (error) throw toAppError(error);
      } else {
        const { data: access } = await supabase.rpc("get_my_access");
        const orgId = (access as { profile?: { organization_id?: string } } | null)?.profile?.organization_id;
        const { error } = await supabase.from("departments").insert({ ...row, organization_id: orgId! });
        if (error) throw toAppError(error);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: departmentKeys.all }),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await getSupabase().rpc("soft_delete_department", { p_department_id: id, p_reason: reason });
      if (error) throw toAppError(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: departmentKeys.all }),
  });
}
