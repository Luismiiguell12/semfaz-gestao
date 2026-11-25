import { registrationContractSchema } from "@shared/schemas/contracts.ts";
import { landlordSharesSchema, propertyCreateSchema } from "@shared/schemas/properties.ts";
import { reasonSchema } from "@shared/schemas/common.ts";
import type { DraftUi } from "./api";

/** Validação por etapa (mesmas regras do banco) e montagem do pacote enviado para aprovação. */

export type StepErrors = Record<string, string>;

const propertyNewSchema = propertyCreateSchema.omit({ justification: true });
const UNIT_ID = /^[0-9A-Za-z./-]{1,40}$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function issues(err: { issues: { path: PropertyKey[]; message: string }[] }): StepErrors {
  const out: StepErrors = {};
  for (const i of err.issues) {
    const k = i.path.length ? String(i.path[0]) : "_";
    out[k] ??= i.message;
  }
  return out;
}

export function parseShare(v: string): number | undefined {
  const t = v.trim().replace(",", ".");
  return t ? Number(t) : undefined;
}

export function validateContract(ui: DraftUi) {
  const r = registrationContractSchema.safeParse(ui.contract);
  return r.success ? { ok: true as const, data: r.data } : { ok: false as const, errors: issues(r.error) };
}

export function validateLandlords(ui: DraftUi) {
  const r = landlordSharesSchema.safeParse(
    ui.landlords.map((l) => ({ landlord_id: l.landlord_id, share_percent: parseShare(l.share) })),
  );
  return r.success
    ? { ok: true as const, data: r.data }
    : { ok: false as const, errors: { _: r.error.issues[0]?.message ?? "Revise os locadores." } };
}

export function validateProperty(ui: DraftUi) {
  const p = ui.property;
  if (p.mode === "existing") {
    return p.id
      ? { ok: true as const, data: { mode: "existing" as const, id: p.id } }
      : { ok: false as const, errors: { _: "Selecione o imóvel." } };
  }
  if (p.mode === "new") {
    const r = propertyNewSchema.safeParse(p.data);
    if (!r.success) return { ok: false as const, errors: issues(r.error) };
    // Campos opcionais vazios não são enviados.
    const data = Object.fromEntries(Object.entries(r.data).filter(([, v]) => v !== undefined && v !== ""));
    return { ok: true as const, data: { mode: "new" as const, data } };
  }
  return { ok: false as const, errors: { _: "Escolha um imóvel já cadastrado ou cadastre um novo." } };
}

export function validateUnits(ui: DraftUi) {
  const errors: StepErrors = {};
  const seen = new Set<string>();
  ui.units.forEach((u, idx) => {
    if (!ISO.test(u.start_date)) errors[`${idx}.start_date`] = "Informe a data de vinculação.";
    if (u.mode === "new") {
      if (!UNIT_ID.test(u.identifier.trim()))
        errors[`${idx}.identifier`] = "Use letras, números, ponto, barra ou hífen (até 40).";
      if (u.holder_name.trim().length < 2) errors[`${idx}.holder_name`] = "Informe o titular.";
      const k = `${u.supplier_id}:${u.identifier.trim().toUpperCase()}`;
      if (seen.has(k)) errors[`${idx}.identifier`] = "Unidade repetida no cadastro.";
      seen.add(k);
    } else {
      if (seen.has(u.unit_id)) errors[`${idx}.identifier`] = "Unidade repetida no cadastro.";
      seen.add(u.unit_id);
      if (u.current_start_date && u.start_date && u.start_date <= u.current_start_date)
        errors[`${idx}.start_date`] = "A transferência deve começar depois do início do vínculo atual.";
    }
  });
  return Object.keys(errors).length ? { ok: false as const, errors } : { ok: true as const };
}

export function validateJustification(ui: DraftUi) {
  const r = reasonSchema.safeParse(ui.justification);
  return r.success
    ? { ok: true as const }
    : { ok: false as const, errors: { _: r.error.issues[0]!.message } };
}

/**
 * Pacote normalizado gravado no rascunho junto com a interface. Partes ainda
 * inválidas ficam de fora (o envio exige todas as etapas válidas).
 */
export function buildPackage(ui: DraftUi): Record<string, unknown> {
  const out: Record<string, unknown> = { ui };
  const c = validateContract(ui);
  const l = validateLandlords(ui);
  const p = validateProperty(ui);
  if (c.ok && l.ok) out.contract = { ...c.data, landlords: l.data };
  if (p.ok) out.property = p.data;
  out.units = ui.units.map((u) =>
    u.mode === "new"
      ? {
          mode: "new",
          start_date: u.start_date,
          data: {
            supplier_id: u.supplier_id,
            identifier: u.identifier.trim(),
            holder_name: u.holder_name.trim(),
            meter_number: u.supplier_kind === "energy" ? u.meter_number.trim() : "",
            complement: u.supplier_kind === "water" ? u.complement.trim() : "",
            address: u.supplier_kind === "water" ? u.address.trim() : "",
          },
        }
      : { mode: "existing", unit_id: u.unit_id, start_date: u.start_date },
  );
  return out;
}

export function draftTitle(ui: DraftUi): string | null {
  const n = ui.contract.contract_number?.trim();
  const prop = ui.property.mode === "existing" ? ui.property.name : ui.property.data.name;
  const parts = [n ? `Contrato ${n}` : null, prop?.trim() || null].filter(Boolean);
  return parts.length ? parts.join(" · ").slice(0, 200) : null;
}
