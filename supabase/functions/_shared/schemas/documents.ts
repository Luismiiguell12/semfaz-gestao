import { z } from "zod";
import { uuidSchema } from "./common.ts";

export const documentEntityTypes = [
  "department",
  "property",
  "contract",
  "amendment",
  "approval_request",
  "invoice",
  "rent_charge",
  "payment",
  "consumer_unit",
  "task",
] as const;

export const documentUploadFieldsSchema = z.object({
  entity_type: z.enum(documentEntityTypes, { message: "Tipo de registro não suportado para anexos." }),
  entity_id: uuidSchema,
  description: z.string().trim().max(500, "Descrição: máximo de 500 caracteres.").optional(),
  replaces_document_id: uuidSchema.optional(),
});
