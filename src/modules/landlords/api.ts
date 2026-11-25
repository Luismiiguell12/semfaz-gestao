"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { toAppError } from "@/lib/errors";
import { onlyDigits } from "@shared/schemas/br.ts";
import { landlordSchema, type LandlordInput } from "@shared/schemas/properties.ts";

// Colunas legíveis: CPF/CNPJ e telefone somente mascarados (privilégio de coluna no banco).
export const LANDLORD_COLUMNS =
  "id, person_type, name, document_masked, phone_masked, email, address, notes, created_at";

export interface Landlord {
  id: string;
  person_type: "individual" | "company";
  name: string;
  document_masked: string;
  phone_masked: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export const landlordKeys = { all: ["landlords"] as const };

export interface FoundLandlord {
  id: string;
  name: string;
  person_type: "individual" | "company";
  document_masked: string;
}

/** Locador já cadastrado com o CPF/CNPJ informado (devolve o documento mascarado). */
export async function findLandlordByDocument(document: string): Promise<FoundLandlord | null> {
  const digits = onlyDigits(document);
  if (digits.length !== 11 && digits.length !== 14) return null;
  const { data, error } = await getSupabase().rpc("find_landlord_by_document", { p_document: digits });
  if (error) throw toAppError(error);
  return ((data as FoundLandlord[] | null) ?? [])[0] ?? null;
}

export function useLandlords() {
  return useQuery({
    queryKey: landlordKeys.all,
    queryFn: async () => {
      const { data, error } = await getSupabase().from("landlords").select(LANDLORD_COLUMNS).order("name");
      if (error) throw toAppError(error);
      return data as unknown as Landlord[];
    },
  });
}

export function useSaveLandlord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
      reason,
    }: {
      id: string | null;
      values: LandlordInput;
      reason?: string;
    }) => {
      const v = landlordSchema.parse(values);
      const { data, error } = await getSupabase().rpc("save_landlord", {
        p_landlord_id: id as string,
        p_data: { ...v, document: onlyDigits(v.document), phone: v.phone ? onlyDigits(v.phone) : "" },
        p_reason: reason ?? "",
      });
      if (error) throw toAppError(error);
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: landlordKeys.all }),
  });
}

/** Dados completos (CPF/CNPJ e telefone): exige landlords.view_sensitive e é auditado. */
export async function fetchLandlordSensitive(
  id: string,
): Promise<{ document: string; phone: string | null }> {
  const { data, error } = await getSupabase().rpc("get_landlord_sensitive", { p_landlord_id: id });
  if (error) throw toAppError(error);
  return data as unknown as { document: string; phone: string | null };
}

/** Ficha do locador: dados mascarados, imóveis e contratos vinculados (no escopo do usuário). */
export function useLandlord(id: string | null) {
  return useQuery({
    queryKey: [...landlordKeys.all, "detail", id ?? ""],
    enabled: Boolean(id),
    queryFn: async () => {
      const s = getSupabase();
      const [l, props, contracts] = await Promise.all([
        s.from("landlords").select(LANDLORD_COLUMNS).eq("id", id!).maybeSingle(),
        s
          .from("property_landlords")
          .select("id, property_id, share_percent, deleted_at, properties(id, name, city, state)")
          .eq("landlord_id", id!)
          .order("created_at", { ascending: false }),
        s
          .from("contract_landlords")
          .select(
            "id, contract_id, share_percent, contracts(id, contract_number, start_date, end_date, property_id, properties(name))",
          )
          .eq("landlord_id", id!)
          .is("deleted_at", null),
      ]);
      for (const r of [l, props, contracts]) if (r.error) throw toAppError(r.error);
      return {
        landlord: l.data as unknown as Landlord | null,
        properties: props.data ?? [],
        contracts: contracts.data ?? [],
      };
    },
  });
}
