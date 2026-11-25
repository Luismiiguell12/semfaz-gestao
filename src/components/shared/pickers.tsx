"use client";

import * as React from "react";
import { NativeSelect } from "@/components/ui/select";
import { toTree, useDepartments, DEPARTMENT_KIND_LABEL } from "@/modules/departments/api";
import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { toAppError } from "@/lib/errors";

/** Seletor de departamento em árvore. `rootId` limita às opções da subárvore. */
export function DepartmentSelect({
  rootId,
  emptyLabel = "Selecione",
  ...props
}: React.ComponentProps<typeof NativeSelect> & { rootId?: string | null; emptyLabel?: string }) {
  const departments = useDepartments();
  const tree = React.useMemo(() => {
    const all = toTree((departments.data ?? []).filter((d) => d.is_active));
    if (!rootId) return all;
    const root = all.find((d) => d.id === rootId);
    if (!root) return [];
    const start = all.indexOf(root);
    const out = [root];
    for (let i = start + 1; i < all.length && all[i]!.depth > root.depth; i++) out.push(all[i]!);
    return out;
  }, [departments.data, rootId]);
  return (
    <NativeSelect {...props}>
      <option value="">{emptyLabel}</option>
      {tree.map((d) => (
        <option key={d.id} value={d.id}>
          {"  ".repeat(d.depth)}
          {d.name} ({DEPARTMENT_KIND_LABEL[d.kind].toLowerCase()})
        </option>
      ))}
    </NativeSelect>
  );
}

/** Servidores ativos da organização (diretório mínimo, sem dados pessoais). */
export function useActiveColleagues() {
  return useQuery({
    queryKey: ["user-directory", "active"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("user_directory")
        .select("id, full_name, job_title")
        .eq("status", "active")
        .order("full_name");
      if (error) throw toAppError(error);
      return data;
    },
  });
}

export function UserSelect({
  emptyLabel = "Não informado",
  ...props
}: React.ComponentProps<typeof NativeSelect> & { emptyLabel?: string }) {
  const users = useActiveColleagues();
  return (
    <NativeSelect {...props}>
      <option value="">{emptyLabel}</option>
      {users.data?.map((u) => (
        <option key={u.id!} value={u.id!}>
          {u.full_name}
          {u.job_title ? ` (${u.job_title})` : ""}
        </option>
      ))}
    </NativeSelect>
  );
}
