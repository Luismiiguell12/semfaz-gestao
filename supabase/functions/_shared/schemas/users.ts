import { z } from "zod";
import { optionalText, reasonSchema, uuidSchema } from "./common.ts";

// Mesmas regras das constraints da tabela public.profiles.
export const usernameSchema = z
  .string({ message: "Informe o nome de usuário." })
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9][a-z0-9._-]{2,39}$/,
    "Use de 3 a 40 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.",
  );

export const fullNameSchema = z
  .string({ message: "Informe o nome completo." })
  .trim()
  .min(3, "O nome deve ter pelo menos 3 caracteres.")
  .max(150, "O nome deve ter no máximo 150 caracteres.");

export const institutionalEmailSchema = z
  .string({ message: "Informe o e-mail institucional." })
  .trim()
  .toLowerCase()
  .max(254, "E-mail muito longo.")
  .pipe(z.email({ message: "E-mail inválido." }));

export const employeeNumberSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9A-Za-z./-]{1,30}$/,
    "Matrícula inválida (até 30 caracteres: letras, números, ponto, barra ou hífen).",
  )
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

export const userStatusSchema = z.enum(["active", "inactive", "blocked"], { message: "Situação inválida." });

const profileFields = {
  full_name: fullNameSchema,
  username: usernameSchema,
  employee_number: employeeNumberSchema,
  job_title: optionalText(120, "Cargo"),
  department_id: uuidSchema
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
};

export const inviteUserSchema = z.object({
  ...profileFields,
  email: institutionalEmailSchema,
  role_ids: z.array(uuidSchema).min(1, "Selecione pelo menos um perfil de acesso."),
  department_ids: z.array(uuidSchema).default([]),
  organization_wide_access: z.boolean().default(false),
});
export type InviteUserInput = z.input<typeof inviteUserSchema>;

export const updateUserSchema = z.object({
  ...profileFields,
  user_id: uuidSchema,
  reason: reasonSchema,
});
export type UpdateUserInput = z.input<typeof updateUserSchema>;

export const setUserStatusSchema = z.object({
  user_id: uuidSchema,
  status: userStatusSchema,
  reason: reasonSchema,
});
export type SetUserStatusInput = z.input<typeof setUserStatusSchema>;

export const setUserAccessSchema = z.object({
  user_id: uuidSchema,
  role_ids: z.array(uuidSchema).min(1, "Selecione pelo menos um perfil de acesso."),
  department_ids: z.array(uuidSchema).default([]),
  organization_wide_access: z.boolean().default(false),
  reason: reasonSchema,
});
export type SetUserAccessInput = z.input<typeof setUserAccessSchema>;

export const adminUsersRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("invite"), payload: inviteUserSchema }),
  z.object({ action: z.literal("set_status"), payload: setUserStatusSchema }),
  z.object({ action: z.literal("resend_invite"), payload: z.object({ user_id: uuidSchema }) }),
]);
export type AdminUsersRequest = z.input<typeof adminUsersRequestSchema>;
