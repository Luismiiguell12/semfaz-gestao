import { z } from "zod";
import { reasonSchema, uuidSchema } from "./common.ts";

export const departmentKindSchema = z.enum(["secretariat", "directorate", "unit"], {
  message: "Nível inválido.",
});

export const departmentSchema = z
  .object({
    kind: departmentKindSchema,
    name: z
      .string()
      .trim()
      .min(2, "Informe o nome (mínimo de 2 caracteres).")
      .max(200, "Máximo de 200 caracteres."),
    acronym: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9/-]{1,19}$/, "Sigla: de 2 a 20 caracteres (letras, números, barra ou hífen).")
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : undefined)),
    parent_id: uuidSchema
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : undefined)),
    is_active: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "secretariat" && value.parent_id) {
      ctx.addIssue({
        code: "custom",
        path: ["parent_id"],
        message: "Uma secretaria não possui departamento superior.",
      });
    }
    if (value.kind !== "secretariat" && !value.parent_id) {
      ctx.addIssue({ code: "custom", path: ["parent_id"], message: "Selecione o departamento superior." });
    }
  });
export type DepartmentInput = z.input<typeof departmentSchema>;

export const deleteWithReasonSchema = z.object({ id: uuidSchema, reason: reasonSchema });

export const roleSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z][a-z0-9_]{2,40}$/,
      "Código: de 3 a 41 caracteres, começando por letra (letras minúsculas, números e sublinhado).",
    ),
  name: z
    .string()
    .trim()
    .min(3, "Informe o nome (mínimo de 3 caracteres).")
    .max(80, "Máximo de 80 caracteres."),
  description: z.string().trim().max(500, "Máximo de 500 caracteres.").optional(),
  permission_codes: z.array(z.string().regex(/^[a-z_]+(\.[a-z_]+)+$/)).default([]),
  reason: reasonSchema,
});
export type RoleInput = z.input<typeof roleSchema>;
