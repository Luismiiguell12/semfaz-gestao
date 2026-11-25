import { z } from "zod";
import { reasonSchema, uuidSchema } from "./common.ts";
import { parseBrlInput } from "./br.ts";
import { landlordSharesSchema } from "./properties.ts";

const optionalUuid = uuidSchema
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));
const isoDate = (label: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `Informe ${label}.`);
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

/** Valor monetário digitado em pt-BR → string decimal ("1234.56"). */
export const moneySchema = (label: string) =>
  z.string({ message: `Informe ${label}.` }).transform((v, ctx) => {
    const parsed = parseBrlInput(v);
    if (parsed === null) {
      ctx.addIssue({ code: "custom", message: `${label}: valor inválido (ex.: 1.234,56).` });
      return z.NEVER;
    }
    return parsed;
  });

/** Campos do contrato (sem imóvel e justificativa), usados também no cadastro guiado. */
export const contractFieldsObject = z.object({
  contract_number: z.string().trim().min(1, "Informe o número do contrato.").max(60),
  process_number: z.string().trim().max(60).optional(),
  modality_id: optionalUuid,
  object: z.string().trim().min(5, "Descreva o objeto (mínimo de 5 caracteres).").max(2000),
  signed_on: isoDate("a data de assinatura"),
  start_date: isoDate("o início da vigência"),
  end_date: isoDate("o fim da vigência"),
  global_value: moneySchema("o valor global"),
  monthly_value: moneySchema("o valor mensal"),
  adjustment_index_id: optionalUuid,
  base_date: optionalDate,
  inspector_id: optionalUuid,
  manager_id: optionalUuid,
  notes: z.string().trim().max(4000).optional(),
});

function refineContractDates(
  v: { start_date: string; end_date: string; signed_on: string },
  ctx: z.RefinementCtx,
) {
  if (v.end_date < v.start_date)
    ctx.addIssue({
      code: "custom",
      path: ["end_date"],
      message: "O fim da vigência deve ser posterior ao início.",
    });
  if (v.signed_on > v.end_date)
    ctx.addIssue({
      code: "custom",
      path: ["signed_on"],
      message: "A assinatura não pode ser posterior ao fim da vigência.",
    });
}

export const contractCreateSchema = contractFieldsObject
  .extend({
    property_id: uuidSchema,
    landlords: landlordSharesSchema,
    justification: reasonSchema,
  })
  .superRefine(refineContractDates);

/** Etapa "Dados do contrato" do cadastro guiado. */
export const registrationContractSchema = contractFieldsObject.superRefine(refineContractDates);
export type RegistrationContractInput = z.input<typeof registrationContractSchema>;

export type ContractCreateInput = z.input<typeof contractCreateSchema>;

export const amendmentKindSchema = z.enum(["term", "value", "term_and_value", "other"], {
  message: "Selecione o tipo.",
});

export const amendmentCreateSchema = z
  .object({
    contract_id: uuidSchema,
    amendment_number: z.string().trim().min(1, "Informe o número do aditivo.").max(60),
    kind: amendmentKindSchema,
    signed_on: isoDate("a data de assinatura"),
    new_end_date: optionalDate,
    new_monthly_value: z.string().optional(),
    value_effective_from: optionalDate,
    description: z.string().trim().min(5, "Descreva o aditivo (mínimo de 5 caracteres).").max(2000),
    justification: reasonSchema,
  })
  .superRefine((v, ctx) => {
    const term = v.kind === "term" || v.kind === "term_and_value";
    const value = v.kind === "value" || v.kind === "term_and_value";
    if (term && !v.new_end_date)
      ctx.addIssue({
        code: "custom",
        path: ["new_end_date"],
        message: "Informe a nova data de fim da vigência.",
      });
    if (value) {
      if (!v.new_monthly_value || parseBrlInput(v.new_monthly_value) === null) {
        ctx.addIssue({
          code: "custom",
          path: ["new_monthly_value"],
          message: "Informe o novo valor mensal (ex.: 1.234,56).",
        });
      }
      if (!v.value_effective_from)
        ctx.addIssue({
          code: "custom",
          path: ["value_effective_from"],
          message: "Informe a partir de quando vale o novo valor.",
        });
    }
  });
export type AmendmentCreateInput = z.input<typeof amendmentCreateSchema>;

export const decisionSchema = z
  .object({ decision: z.enum(["approved", "rejected"]), comment: z.string().trim().max(1000).optional() })
  .superRefine((v, ctx) => {
    if (v.decision === "rejected" && (v.comment ?? "").length < 10) {
      ctx.addIssue({
        code: "custom",
        path: ["comment"],
        message: "Informe o motivo da rejeição (mínimo de 10 caracteres).",
      });
    }
  });
