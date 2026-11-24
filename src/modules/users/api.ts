"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { invokeFunction } from "@/lib/supabase/functions";
import { toAppError } from "@/lib/errors";
import type { Database } from "@/types/database";
import {
  inviteUserSchema,
  setUserAccessSchema,
  setUserStatusSchema,
  updateUserSchema,
  type InviteUserInput,
  type SetUserAccessInput,
  type SetUserStatusInput,
  type UpdateUserInput,
} from "@shared/schemas/users.ts";

export type AdminUser = Database["public"]["Functions"]["admin_list_users"]["Returns"][number] & {
  roles: { id: string; code: string; name: string }[];
  department_access: { id: string; name: string; kind: string }[];
};
export type UserStatus = Database["public"]["Enums"]["user_status"];

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  blocked: "Bloqueado",
};

export const userKeys = { all: ["users"] as const, directory: ["user-directory"] as const };

export function useAdminUsers() {
  return useQuery({
    queryKey: userKeys.all,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("admin_list_users");
      if (error) throw toAppError(error);
      return data as unknown as AdminUser[];
    },
  });
}

/** Diretório mínimo (nome e usuário) para exibir autores, sem dados pessoais. */
export function useUserDirectory() {
  return useQuery({
    queryKey: userKeys.directory,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabase().from("user_directory").select("id, full_name, username");
      if (error) throw toAppError(error);
      return new Map((data ?? []).map((u) => [u.id!, u]));
    },
  });
}

function useInvalidateUsers() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["users"] });
}

export function useInviteUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async (values: InviteUserInput) => {
      const payload = inviteUserSchema.parse(values);
      return invokeFunction<{ user_id: string }>("admin-users", { action: "invite", payload });
    },
    onSuccess: invalidate,
  });
}

export function useResendInvite() {
  return useMutation({
    mutationFn: async (userId: string) =>
      invokeFunction<{ ok: true }>("admin-users", { action: "resend_invite", payload: { user_id: userId } }),
  });
}

export function useSetUserStatus() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async (values: SetUserStatusInput) => {
      const payload = setUserStatusSchema.parse(values);
      return invokeFunction<{ ok?: true; warning?: string }>("admin-users", {
        action: "set_status",
        payload,
      });
    },
    onSuccess: invalidate,
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async (values: UpdateUserInput) => {
      const v = updateUserSchema.parse(values);
      const { error } = await getSupabase().rpc("admin_update_profile", {
        p_user_id: v.user_id,
        p_full_name: v.full_name,
        p_username: v.username,
        p_employee_number: v.employee_number ?? "",
        p_job_title: v.job_title ?? "",
        p_department_id: (v.department_id ?? null) as string,
        p_reason: v.reason,
      });
      if (error) throw toAppError(error);
    },
    onSuccess: invalidate,
  });
}

export function useSetUserAccess() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async (values: SetUserAccessInput) => {
      const v = setUserAccessSchema.parse(values);
      const { error } = await getSupabase().rpc("admin_set_user_access", {
        p_user_id: v.user_id,
        p_role_ids: v.role_ids,
        p_department_ids: v.department_ids,
        p_organization_wide_access: v.organization_wide_access,
        p_reason: v.reason,
      });
      if (error) throw toAppError(error);
    },
    onSuccess: invalidate,
  });
}
