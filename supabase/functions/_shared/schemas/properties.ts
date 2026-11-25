import { z } from "zod";
import { reasonSchema, uuidSchema } from "./common.ts";
import { BR_STATES, isValidCnpj, isValidCpf, onlyDigits } from "./br.ts";

const optionalUuid = uuidSchema
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));
const text = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label}: informe pelo menos ${min} caracteres.`)
    .max(max, `${label}: máximo de ${max} caracteres.`);

export const addressSchema = z.object({
  street: text(2, 200, "Logradouro"),
  address_number: text(1, 20, "Número"),
  complement: z.string().trim().max(120, "Complemento: máximo de 120 caracteres.").optional(),
  district: text(2, 120, "Bairro"),
  postal_code: z
    .string()
    .trim()
    .regex(/^\d{5}-\d{3}$/, "CEP no formato 00000-000."),
  city: text(2, 120, "Município"),
  state: z.enum(BR_STATES, { message: "Selecione a UF." }),
});
export type AddressInput = z.input<typeof addressSchema>;

export const propertyStatusSchema = z.enum(["active", "inactive", "vacated"], {
  message: "Situação inválida.",
});

export const propertyDetailsSchema = z.object({
  name: text(3, 200, "Identificação"),
  purpose: text(3, 300, "Finalidade"),
  internal_responsible_id: optionalUuid,
  occupation_date: z.string().optional(),
  status: propertyStatusSchema,
  notes: z.string().trim().max(4000, "Observações: máximo de 4000 caracteres.").optional(),
});

export const propertyCreateSchema = addressSchema.extend(propertyDetailsSchema.shape).extend({
  department_id: uuidSchema,
  unit_department_id: optionalUuid,
  justification: reasonSchema,
});
export type PropertyCreateInput = z.input<typeof propertyCreateSchema>;

export const landlordSchema = z
  .object({
    person_type: z.enum(["individual", "company"], { message: "Selecione o tipo de pessoa." }),
    name: text(3, 200, "Nome ou razão social"),
    document: z.string().trim(),
    phone: z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d{10,11}$/.test(onlyDigits(v)), "Telefone com DDD (10 ou 11 dígitos).")
      .optional(),
    email: z
      .string()
      .trim()
      .pipe(z.email({ message: "E-mail inválido." }))
      .optional()
      .or(z.literal("")),
    address: z.string().trim().max(400, "Endereço: máximo de 400 caracteres.").optional(),
    notes: z.string().trim().max(2000, "Observações: máximo de 2000 caracteres.").optional(),
  })
  .superRefine((v, ctx) => {
    const ok = v.person_type === "individual" ? isValidCpf(v.document) : isValidCnpj(v.document);
    if (!ok) {
      ctx.addIssue({
        code: "custom",
        path: ["document"],
        message: v.person_type === "individual" ? "CPF inválido." : "CNPJ inválido.",
      });
    }
  });
export type LandlordInput = z.input<typeof landlordSchema>;

/** Locadores com percentuais: com mais de um, todos informados e soma 100%. */
export const landlordSharesSchema = z
  .array(z.object({ landlord_id: uuidSchema, share_percent: z.number().positive().max(100).optional() }))
  .min(1, "Informe pelo menos um locador.")
  .superRefine((items, ctx) => {
    const ids = new Set(items.map((i) => i.landlord_id));
    if (ids.size !== items.length) ctx.addIssue({ code: "custom", message: "Locador repetido." });
    if (items.length > 1) {
      if (items.some((i) => i.share_percent === undefined)) {
        ctx.addIssue({ code: "custom", message: "Com mais de um locador, informe o percentual de cada um." });
        return;
      }
      // Soma em centésimos (inteiros) para evitar erro de ponto flutuante.
      const sum = items.reduce((acc, i) => acc + Math.round((i.share_percent ?? 0) * 100), 0);
      if (sum !== 10000) ctx.addIssue({ code: "custom", message: "A soma dos percentuais deve ser 100%." });
    } else if (items[0]?.share_percent !== undefined && Math.round(items[0].share_percent * 100) !== 10000) {
      ctx.addIssue({
        code: "custom",
        message: "Com um único locador, o percentual deve ser 100% (ou não informado).",
      });
    }
  });
