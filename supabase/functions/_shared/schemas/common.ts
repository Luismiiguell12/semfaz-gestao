// Schemas compartilhados entre o frontend (Next.js) e as Edge Functions (Deno).
// Não usar APIs específicas de Node ou Deno neste diretório.
import { z } from "zod";

export const uuidSchema = z.uuid({ message: "Identificador inválido." });

export const reasonSchema = z
  .string({ message: "Informe a justificativa." })
  .trim()
  .min(10, "A justificativa deve ter pelo menos 10 caracteres.")
  .max(1000, "A justificativa deve ter no máximo 1000 caracteres.");

export const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}: máximo de ${max} caracteres.`)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));
