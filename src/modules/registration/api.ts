"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { toAppError } from "@/lib/errors";
import type { ApprovalRequest } from "@/modules/approvals/api";

/**
 * Cadastro guiado a partir do contrato (Alteração 01).
 * O rascunho fica no banco (registration_drafts), visível só para o autor.
 * `data.ui` guarda o que foi digitado em cada etapa; `data.property`,
 * `data.contract` e `data.units` guardam o pacote já normalizado, que o banco
 * valida e envia para aprovação como uma única solicitação.
 */

export interface DraftLandlord {
  landlord_id: string;
  name: string;
  document_masked: string;
  share: string; // texto digitado ("60", "33,34"); vazio = locador único
}

export interface DraftUnitNew {
  key: string;
  mode: "new";
  supplier_id: string;
  supplier_name: string;
  supplier_kind: "energy" | "water";
  identifier: string;
  holder_name: string;
  meter_number: string;
  complement: string;
  address: string;
  start_date: string;
}

export interface DraftUnitExisting {
  key: string;
  mode: "existing";
  unit_id: string;
  supplier_name: string;
  identifier: string;
  holder_name: string;
  current_property_name: string | null;
  current_start_date: string | null;
  start_date: string;
}

export type DraftUnit = DraftUnitNew | DraftUnitExisting;

export interface DraftProperty {
  mode: "existing" | "new" | "";
  id: string;
  name: string;
  data: Record<string, string>;
}

export interface DraftUi {
  contract: Record<string, string>;
  landlords: DraftLandlord[];
  property: DraftProperty;
  units: DraftUnit[];
  unitsSkipped: boolean;
  justification: string;
}

export const EMPTY_UI: DraftUi = {
  contract: {
    contract_number: "",
    process_number: "",
    modality_id: "",
    object: "",
    signed_on: "",
    start_date: "",
    end_date: "",
    monthly_value: "",
    global_value: "",
    adjustment_index_id: "",
    base_date: "",
    inspector_id: "",
    manager_id: "",
    notes: "",
  },
  landlords: [],
  property: { mode: "", id: "", name: "", data: {} },
  units: [],
  unitsSkipped: false,
  justification: "",
};

export interface Draft {
  id: string;
  title: string | null;
  current_step: number;
  status: "draft" | "submitted" | "discarded";
  approval_request_id: string | null;
  created_at: string;
  updated_at: string;
  data: { ui?: DraftUi } & Record<string, unknown>;
  approval_requests?: {
    status: string;
    decision_comment: string | null;
    failure_reason: string | null;
  } | null;
}

const keys = {
  all: ["registration-drafts"] as const,
  one: (id: string) => ["registration-drafts", id] as const,
};

const SELECT =
  "id, title, current_step, status, approval_request_id, created_at, updated_at, data, approval_requests(status, decision_comment, failure_reason)";

export function useDrafts() {
  return useQuery({
    queryKey: keys.all,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("registration_drafts")
        .select(SELECT)
        .neq("status", "discarded")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw toAppError(error);
      return data as unknown as Draft[];
    },
  });
}

export function useDraft(id: string | null) {
  return useQuery({
    queryKey: keys.one(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("registration_drafts")
        .select(SELECT)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw toAppError(error);
      return data as unknown as Draft | null;
    },
  });
}

export function useCreateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { organizationId: string; userId: string }) => {
      const { data, error } = await getSupabase()
        .from("registration_drafts")
        .insert({
          organization_id: v.organizationId,
          user_id: v.userId,
          data: { ui: EMPTY_UI } as never,
        })
        .select("id")
        .single();
      if (error) throw toAppError(error);
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useSaveDraft(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { step: number; title: string | null; data: Record<string, unknown> }) => {
      const { data, error } = await getSupabase()
        .from("registration_drafts")
        .update({ current_step: v.step, title: v.title, data: v.data as never })
        .eq("id", id)
        .select("id");
      if (error) throw toAppError(error);
      if (!data?.length) throw toAppError({ message: "Este rascunho não pode mais ser alterado." });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useDiscardDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase()
        .from("registration_drafts")
        .update({ status: "discarded" })
        .eq("id", id);
      if (error) throw toAppError(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useSubmitPackage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (justification: string) => {
      const { data, error } = await getSupabase().rpc("submit_registration_package", {
        p_draft_id: id,
        p_justification: justification,
      });
      if (error) throw toAppError(error);
      return data as unknown as ApprovalRequest;
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: keys.all }),
        qc.invalidateQueries({ queryKey: ["approvals"] }),
        qc.invalidateQueries({ queryKey: ["landlords"] }),
      ]),
  });
}

export function useReopenDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().rpc("reopen_registration_draft", { p_draft_id: id });
      if (error) throw toAppError(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export interface SimilarProperties {
  matches: { id: string; name: string; address: string }[];
  restricted_count: number;
}

export async function findSimilarProperties(postalCode: string, number: string): Promise<SimilarProperties> {
  const { data, error } = await getSupabase().rpc("find_similar_properties", {
    p_postal_code: postalCode,
    p_address_number: number,
  });
  if (error) throw toAppError(error);
  return data as unknown as SimilarProperties;
}

export interface FoundUnit {
  exists: true;
  accessible: boolean;
  id?: string;
  identifier?: string;
  holder_name?: string;
  current_property_id?: string | null;
  current_property_name?: string | null;
  current_start_date?: string | null;
}

export async function findConsumerUnit(supplierId: string, identifier: string): Promise<FoundUnit | null> {
  const { data, error } = await getSupabase().rpc("find_consumer_unit", {
    p_supplier_id: supplierId,
    p_identifier: identifier,
  });
  if (error) throw toAppError(error);
  return (data as unknown as FoundUnit | null) ?? null;
}
