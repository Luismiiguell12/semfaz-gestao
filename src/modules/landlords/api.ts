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
