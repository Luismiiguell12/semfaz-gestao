"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search, Trash2, UserPlus } from "lucide-react";
import { FormField } from "@/components/shared/form-field";
import { InlineAlert } from "@/components/shared/states";
import { DepartmentSelect, UserSelect } from "@/components/shared/pickers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useContractLists } from "@/modules/contracts/api";
import { describeTerm, suggestGlobalValue } from "@/modules/contracts/suggest";
import { findLandlordByDocument, useLandlords, type FoundLandlord } from "@/modules/landlords/api";
import { LandlordDialog } from "@/modules/landlords/landlord-dialog";
import { useProperties, usePropertyLandlords } from "@/modules/properties/api";
import { SUPPLIER_KIND_LABEL, usePropertyUnits, useSuppliers } from "@/modules/consumer-units/api";
import { useDepartments } from "@/modules/departments/api";
import {
  findConsumerUnit,
  findSimilarProperties,
  type DraftUi,
  type DraftUnit,
  type FoundUnit,
  type SimilarProperties,
} from "@/modules/registration/api";
import type { StepErrors } from "@/modules/registration/package";
import { BR_STATES, formatCep, onlyDigits, parseBrlInput } from "@shared/schemas/br.ts";
import { formatCalendarDate, formatCurrency } from "@/lib/format";

export interface StepProps {
  ui: DraftUi;
  update: (fn: (ui: DraftUi) => DraftUi) => void;
  errors: StepErrors;
}

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Maceio" });

/** Endereço do imóvel escolhido/cadastrado (sugestão para a matrícula da Iguá). */
export function usePropertyAddress(ui: DraftUi): string {
  const props = useProperties();
  if (ui.property.mode === "new") {
    const d = ui.property.data;
    return [d.street, d.address_number, d.complement, d.district].filter((v) => v?.trim()).join(", ");
  }
  const p = props.data?.find((x) => x.id === ui.property.id);
  return p ? [p.street, p.address_number, p.complement, p.district].filter(Boolean).join(", ") : "";
}

// ============================================================== 1. Contrato
export function ContractStep({ ui, update, errors }: StepProps) {
  const lists = useContractLists();
  const c = ui.contract;
  const set =
    (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      update((u) => ({ ...u, contract: { ...u.contract, [k]: value } }));
    };
  const monthly = parseBrlInput(c.monthly_value ?? "");
  const suggestion = suggestGlobalValue(
    monthly === null ? null : Number(monthly),
    c.start_date ?? "",
    c.end_date ?? "",
  );
  const suggested = suggestion ? (suggestion.cents / 100).toFixed(2) : null;
  const currentGlobal = parseBrlInput(c.global_value ?? "");
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="w-number" label="Número do contrato" required error={errors.contract_number}>
          <Input value={c.contract_number} onChange={set("contract_number")} />
        </FormField>
        <FormField id="w-process" label="Processo administrativo" error={errors.process_number}>
          <Input value={c.process_number} onChange={set("process_number")} />
        </FormField>
        <FormField id="w-modality" label="Modalidade">
          <NativeSelect value={c.modality_id} onChange={set("modality_id")}>
            <option value="">Não informada</option>
            {lists.data?.modalities
              .filter((m) => m.is_active)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </NativeSelect>
        </FormField>
        <FormField id="w-signed" label="Data de assinatura" required error={errors.signed_on}>
          <Input type="date" value={c.signed_on} onChange={set("signed_on")} />
        </FormField>
        <FormField id="w-object" label="Objeto" required error={errors.object} className="sm:col-span-2">
          <Textarea rows={2} value={c.object} onChange={set("object")} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField id="w-start" label="Início da vigência" required error={errors.start_date}>
          <Input type="date" value={c.start_date} onChange={set("start_date")} />
        </FormField>
        <FormField id="w-end" label="Fim da vigência" required error={errors.end_date}>
          <Input type="date" value={c.end_date} onChange={set("end_date")} />
        </FormField>
        <FormField id="w-monthly" label="Valor mensal (R$)" required error={errors.monthly_value}>
          <Input
            inputMode="decimal"
            placeholder="0,00"
            value={c.monthly_value}
            onChange={set("monthly_value")}
          />
        </FormField>
        <FormField
          id="w-global"
          label="Valor global (R$)"
          required
          error={errors.global_value}
          hint={
            suggested && suggestion
              ? `Sugestão: ${formatCurrency(suggested)} (${describeTerm(suggestion.months, suggestion.days)} de vigência).`
              : "Sugerido a partir do valor mensal e da vigência."
          }
        >
          <Input
            inputMode="decimal"
            placeholder="0,00"
            value={c.global_value}
            onChange={set("global_value")}
          />
        </FormField>
        {suggested && currentGlobal !== suggested && (
          <div className="sm:col-span-2 lg:col-span-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                update((u) => ({
                  ...u,
                  contract: {
                    ...u.contract,
                    global_value: Number(suggested).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
                  },
                }))
              }
            >
              Usar a sugestão de valor global ({formatCurrency(suggested)})
            </Button>
          </div>
        )}
        <FormField id="w-index" label="Índice de reajuste">
          <NativeSelect value={c.adjustment_index_id} onChange={set("adjustment_index_id")}>
            <option value="">Não informado</option>
            {lists.data?.indexes
              .filter((i) => i.is_active)
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
          </NativeSelect>
        </FormField>
        <FormField
          id="w-base"
          label="Data-base"
          hint="Aniversário anual para reajuste (o sistema apenas alerta)."
        >
          <Input type="date" value={c.base_date} onChange={set("base_date")} />
        </FormField>
        <FormField id="w-manager" label="Gestor do contrato">
          <UserSelect value={c.manager_id} onChange={set("manager_id")} />
        </FormField>
        <FormField id="w-inspector" label="Fiscal do contrato">
          <UserSelect value={c.inspector_id} onChange={set("inspector_id")} />
        </FormField>
      </div>
      <FormField id="w-notes" label="Observações">
        <Textarea rows={2} value={c.notes} onChange={set("notes")} />
      </FormField>
      <InlineAlert tone="info" title="Arquivo digital do contrato">
        Depois do envio (etapa 5), anexe o PDF do contrato na própria solicitação. O arquivo fica disponível
        para o administrador que vai analisar o cadastro.
      </InlineAlert>
    </div>
  );
}

// ============================================================== 2. Locadores
export function LandlordsStep({ ui, update, errors }: StepProps) {
  const landlords = useLandlords();
  const [term, setTerm] = React.useState("");
  const [lookup, setLookup] = React.useState<{ digits: string; result: FoundLandlord | "none" } | null>(null);
  const [dialog, setDialog] = React.useState(false);
  const digits = onlyDigits(term);
  const isDoc = digits.length === 11 || digits.length === 14;

  React.useEffect(() => {
    if (!isDoc) return;
    let alive = true;
    findLandlordByDocument(digits)
      .then((f) => alive && setLookup({ digits, result: f ?? "none" }))
      .catch(() => alive && setLookup({ digits, result: "none" }));
    return () => {
      alive = false;
    };
  }, [digits, isDoc]);
  const byDoc = isDoc && lookup?.digits === digits ? lookup.result : null;

  const selected = new Set(ui.landlords.map((l) => l.landlord_id));
  const add = (l: FoundLandlord) => {
    if (selected.has(l.id)) return;
    update((u) => ({
      ...u,
      landlords: [
        ...u.landlords,
        { landlord_id: l.id, name: l.name, document_masked: l.document_masked, share: "" },
      ],
    }));
    setTerm("");
  };
  const results = isDoc
    ? byDoc && byDoc !== "none"
      ? [byDoc]
      : []
    : term.trim().length >= 2
      ? (landlords.data ?? [])
          .filter((l) => l.name.toLocaleLowerCase("pt-BR").includes(term.trim().toLocaleLowerCase("pt-BR")))
          .slice(0, 8)
      : [];

  return (
    <div className="space-y-6">
      {errors._ && <InlineAlert tone="danger">{errors._}</InlineAlert>}
      <div>
        <FormField id="w-ll-search" label="Pesquisar locador" hint="Digite o nome ou o CPF/CNPJ completo.">
          <Input value={term} onChange={(e) => setTerm(e.target.value)} autoComplete="off" />
        </FormField>
        {results.length > 0 && (
          <ul className="mt-2 divide-y rounded-md border" aria-label="Resultados da pesquisa">
            {results.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
              >
                <span>
                  <span className="font-semibold">{l.name}</span>{" "}
                  <span className="tabular text-muted-foreground">{l.document_masked}</span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={selected.has(l.id)}
                  onClick={() => add(l)}
                >
                  {selected.has(l.id) ? "Selecionado" : "Selecionar"}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {(isDoc ? byDoc === "none" : term.trim().length >= 2 && results.length === 0) && (
          <p className="text-muted-foreground mt-2 text-sm">
            Nenhum locador encontrado. Cadastre um novo abaixo.
          </p>
        )}
        <Button type="button" variant="outline" className="mt-3" onClick={() => setDialog(true)}>
          <UserPlus aria-hidden="true" /> Cadastrar novo locador
        </Button>
      </div>

      <div>
        <h3 className="text-foreground mb-2 text-sm font-semibold">Locadores do contrato</h3>
        {ui.landlords.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm">
            Nenhum locador selecionado.
          </p>
        ) : (
          <ul className="space-y-3">
            {ui.landlords.map((l, idx) => (
              <li
                key={l.landlord_id}
                className="grid items-end gap-3 rounded-md border p-3 sm:grid-cols-[1fr_9rem_auto]"
              >
                <div className="text-sm">
                  <Link
                    href={`/locadores/detalhe/?id=${l.landlord_id}`}
                    className="font-semibold hover:underline"
                  >
                    {l.name}
                  </Link>
                  <span className="tabular text-muted-foreground block">{l.document_masked}</span>
                </div>
                <FormField id={`w-ll-share-${idx}`} label="Participação (%)">
                  <Input
                    inputMode="decimal"
                    value={l.share}
                    placeholder={ui.landlords.length === 1 ? "100" : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      update((u) => ({
                        ...u,
                        landlords: u.landlords.map((x, i) => (i === idx ? { ...x, share: v } : x)),
                      }));
                    }}
                  />
                </FormField>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    update((u) => ({ ...u, landlords: u.landlords.filter((_, i) => i !== idx) }))
                  }
                  aria-label={`Remover ${l.name}`}
                >
                  <Trash2 aria-hidden="true" /> Remover
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted-foreground mt-2 text-xs">
          Com mais de um locador, informe o percentual de cada um (soma 100%). Os locadores também ficam
          vinculados ao imóvel.
        </p>
      </div>
      {dialog && (
        <LandlordDialog
          editing={null}
          open
          onOpenChange={(v) => !v && setDialog(false)}
          onSaved={add}
          onUseExisting={add}
        />
      )}
    </div>
  );
}

// ============================================================== 3. Imóvel
export function PropertyStep({ ui, update, errors }: StepProps) {
  const props = useProperties();
  const deps = useDepartments();
  const p = ui.property;
  const existing = props.data?.find((x) => x.id === p.id);
  const currentLandlords = usePropertyLandlords(p.mode === "existing" && p.id ? p.id : null);
  const [similarState, setSimilar] = React.useState<{ key: string; result: SimilarProperties } | null>(null);
  const d = p.data;
  const setData = (k: string, value: string) =>
    update((u) => ({ ...u, property: { ...u.property, data: { ...u.property.data, [k]: value } } }));
  const bind = (k: string) => ({
    value: d[k] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setData(k, e.target.value),
  });

  // Aviso de possível duplicidade: mesmo CEP e número.
  const cep = d.postal_code ?? "";
  const num = (d.address_number ?? "").trim();
  const similarKey = p.mode === "new" && /^\d{5}-\d{3}$/.test(cep) && num ? `${cep}|${num}` : null;
  React.useEffect(() => {
    if (!similarKey) return;
    let alive = true;
    const t = setTimeout(() => {
      findSimilarProperties(cep, num)
        .then((r) => alive && setSimilar({ key: similarKey, result: r }))
        .catch(() => undefined);
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [similarKey, cep, num]);
  const similar = similarKey && similarState?.key === similarKey ? similarState.result : null;

  const choose = (mode: "existing" | "new") =>
    update((u) => ({
      ...u,
      property: {
        ...u.property,
        mode,
        data:
          mode === "new" && !u.property.data.city
            ? { ...u.property.data, city: "Lagarto", state: "SE", status: "active" }
            : u.property.data,
      },
    }));
  const pickExisting = (id: string, name: string) =>
    update((u) => ({ ...u, property: { ...u.property, mode: "existing", id, name } }));
  const deptName = (id: string | null | undefined) => deps.data?.find((x) => x.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      {errors._ && <InlineAlert tone="danger">{errors._}</InlineAlert>}
      <fieldset>
        <legend className="text-foreground mb-2 text-sm font-semibold">O imóvel do contrato</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["existing", "Imóvel já cadastrado", "Por exemplo, renovação de contrato."],
              ["new", "Cadastrar novo imóvel", "O imóvel passa a existir após a aprovação do pacote."],
            ] as const
          ).map(([mode, title, text]) => (
            <label
              key={mode}
              className={`flex cursor-pointer gap-3 rounded-md border p-4 ${p.mode === mode ? "border-primary bg-primary-soft" : ""}`}
            >
              <input
                type="radio"
                name="property-mode"
                className="accent-primary mt-1"
                checked={p.mode === mode}
                onChange={() => choose(mode)}
              />
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="text-muted-foreground block text-sm">{text}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {p.mode === "existing" && (
        <div className="space-y-4">
          <FormField id="w-prop" label="Imóvel" required>
            <NativeSelect
              value={p.id}
              onChange={(e) => {
                const found = props.data?.find((x) => x.id === e.target.value);
                pickExisting(e.target.value, found?.name ?? "");
              }}
            >
              <option value="">Selecione</option>
              {props.data
                ?.filter((x) => !x.deleted_at)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </NativeSelect>
          </FormField>
          {existing && (
            <div className="bg-surface rounded-md border p-4 text-sm">
              <p>
                <Link href={`/imoveis/detalhe/?id=${existing.id}`} className="font-semibold hover:underline">
                  {existing.name}
                </Link>
              </p>
              <p className="text-muted-foreground">
                {[existing.street, existing.address_number, existing.complement, existing.district]
                  .filter(Boolean)
                  .join(", ")}{" "}
                · {existing.city}/{existing.state} · CEP {existing.postal_code}
              </p>
              <p className="text-muted-foreground">
                Secretaria responsável: {deptName(existing.department_id)}
              </p>
              {currentLandlords.data && currentLandlords.data.length > 0 && (
                <p className="mt-2">
                  Locadores atuais do imóvel:{" "}
                  {currentLandlords.data.map((l) => l.landlords?.name ?? "acesso restrito").join(", ")}. Após
                  a aprovação, os locadores do imóvel passam a ser os do novo contrato.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {p.mode === "new" && (
        <div className="space-y-6">
          {similar && (similar.matches.length > 0 || similar.restricted_count > 0) && (
            <InlineAlert tone="warning" title="Possível imóvel já cadastrado">
              <p>Existe imóvel com o mesmo CEP e número:</p>
              <ul className="mt-2 space-y-2">
                {similar.matches.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      <strong>{m.name}</strong> — {m.address}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => pickExisting(m.id, m.name)}
                    >
                      Usar este imóvel
                    </Button>
                  </li>
                ))}
              </ul>
              {similar.restricted_count > 0 && (
                <p className="mt-2">
                  {similar.restricted_count === 1 ? "Há 1 imóvel" : `Há ${similar.restricted_count} imóveis`}{" "}
                  com este endereço fora do seu escopo. Confirme com o administrador antes de prosseguir.
                </p>
              )}
            </InlineAlert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="w-p-name" label="Nome ou identificação" required error={errors.name}>
              <Input {...bind("name")} placeholder="Ex.: Sede da Secretaria" />
            </FormField>
            <FormField id="w-p-purpose" label="Finalidade" required error={errors.purpose}>
              <Input {...bind("purpose")} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-6">
            <FormField id="w-p-cep" label="CEP" required error={errors.postal_code} className="sm:col-span-2">
              <Input
                inputMode="numeric"
                value={d.postal_code ?? ""}
                onChange={(e) => setData("postal_code", formatCep(e.target.value))}
              />
            </FormField>
            <FormField
              id="w-p-street"
              label="Logradouro"
              required
              error={errors.street}
              className="sm:col-span-4"
            >
              <Input {...bind("street")} />
            </FormField>
            <FormField
              id="w-p-number"
              label="Número"
              required
              error={errors.address_number}
              className="sm:col-span-2"
            >
              <Input {...bind("address_number")} />
            </FormField>
            <FormField id="w-p-compl" label="Complemento" error={errors.complement} className="sm:col-span-4">
              <Input {...bind("complement")} />
            </FormField>
            <FormField
              id="w-p-district"
              label="Bairro"
              required
              error={errors.district}
              className="sm:col-span-2"
            >
              <Input {...bind("district")} />
            </FormField>
            <FormField id="w-p-city" label="Município" required error={errors.city} className="sm:col-span-3">
              <Input {...bind("city")} />
            </FormField>
            <FormField id="w-p-state" label="UF" required error={errors.state} className="sm:col-span-1">
              <NativeSelect {...bind("state")}>
                <option value="">UF</option>
                {BR_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="w-p-dept"
              label="Secretaria responsável"
              required
              error={errors.department_id}
              hint="Define quem tem acesso ao imóvel."
            >
              <DepartmentSelect
                value={d.department_id ?? ""}
                onChange={(e) =>
                  update((u) => ({
                    ...u,
                    property: {
                      ...u.property,
                      data: { ...u.property.data, department_id: e.target.value, unit_department_id: "" },
                    },
                  }))
                }
              />
            </FormField>
            <FormField
              id="w-p-unit"
              label="Unidade administrativa"
              hint="Opcional. Dentro da estrutura da secretaria."
            >
              <DepartmentSelect
                rootId={d.department_id || null}
                emptyLabel="Não informada"
                disabled={!d.department_id}
                {...bind("unit_department_id")}
              />
            </FormField>
            <FormField id="w-p-resp" label="Responsável interno">
              <UserSelect {...bind("internal_responsible_id")} />
            </FormField>
            <FormField id="w-p-occ" label="Data de ocupação">
              <Input type="date" {...bind("occupation_date")} />
            </FormField>
            <FormField id="w-p-status" label="Situação" required>
              <NativeSelect {...bind("status")}>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="vacated">Desocupado</option>
              </NativeSelect>
            </FormField>
          </div>
          <FormField id="w-p-notes" label="Observações" error={errors.notes}>
            <Textarea rows={2} {...bind("notes")} />
          </FormField>
        </div>
      )}
    </div>
  );
}

// ============================================================== 4. Unidades consumidoras
type Lookup =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "new" }
  | { state: "found"; unit: FoundUnit }
  | { state: "error"; message: string };

export function UnitsStep({ ui, update, errors }: StepProps) {
  const suppliers = useSuppliers();
  const address = usePropertyAddress(ui);
  const propertyId = ui.property.mode === "existing" ? ui.property.id : null;
  const linked = usePropertyUnits(propertyId);
  const defaultStart = ui.contract.start_date || today();
  const [supplierId, setSupplierId] = React.useState("");
  const [identifier, setIdentifier] = React.useState("");
  const [lookup, setLookup] = React.useState<Lookup>({ state: "idle" });
  const [extra, setExtra] = React.useState({
    holder_name: "",
    meter_number: "",
    complement: "",
    address: "",
    start_date: defaultStart,
  });
  const supplier = suppliers.data?.find((s) => s.id === supplierId);

  function resetForm() {
    setIdentifier("");
    setLookup({ state: "idle" });
    setExtra({ holder_name: "", meter_number: "", complement: "", address: "", start_date: defaultStart });
  }

  async function check() {
    if (!supplier || !identifier.trim()) {
      setLookup({
        state: "error",
        message: "Selecione o fornecedor e informe o número da UC ou a matrícula.",
      });
      return;
    }
    if (
      ui.units.some(
        (u) =>
          u.identifier.trim().toUpperCase() === identifier.trim().toUpperCase() &&
          u.supplier_name === supplier.name,
      )
    ) {
      setLookup({ state: "error", message: "Esta unidade já está na lista deste cadastro." });
      return;
    }
    setLookup({ state: "loading" });
    try {
      const found = await findConsumerUnit(supplier.id, identifier);
      if (!found) {
        setLookup({ state: "new" });
        setExtra((x) => ({ ...x, address: supplier.kind === "water" && !x.address ? address : x.address }));
      } else if (!found.accessible) {
        setLookup({
          state: "error",
          message:
            "Esta unidade já existe e está vinculada a um imóvel fora do seu escopo. Peça a um administrador para transferi-la.",
        });
      } else if (propertyId && found.current_property_id === propertyId) {
        setLookup({ state: "error", message: "Esta unidade já está vinculada a este imóvel." });
      } else {
        setLookup({ state: "found", unit: found });
      }
    } catch (e) {
      setLookup({ state: "error", message: (e as Error).message });
    }
  }

  function addUnit(u: DraftUnit) {
    update((x) => ({ ...x, units: [...x.units, u], unitsSkipped: false }));
    resetForm();
  }

  return (
    <div className="space-y-6">
      <InlineAlert tone="info">
        Etapa opcional: as unidades também podem ser cadastradas depois, em Gestão &gt; Unidades consumidoras.
      </InlineAlert>
      {propertyId && (
        <div>
          <h3 className="text-foreground mb-2 text-sm font-semibold">Unidades já vinculadas a este imóvel</h3>
          {linked.data && linked.data.filter((a) => !a.end_date).length > 0 ? (
            <ul className="divide-y rounded-md border text-sm">
              {linked.data
                .filter((a) => !a.end_date)
                .map((a) => (
                  <li key={a.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
                    <Link
                      href={`/unidades/detalhe/?id=${a.unit_id}`}
                      className="font-semibold hover:underline"
                    >
                      {a.consumer_units?.suppliers?.name} {a.consumer_units?.identifier}
                    </Link>
                    <span className="text-muted-foreground">desde {formatCalendarDate(a.start_date)}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhuma unidade vinculada no momento.</p>
          )}
        </div>
      )}

      <div className="rounded-md border p-4">
        <h3 className="text-foreground mb-3 text-sm font-semibold">Adicionar unidade (Energisa ou Iguá)</h3>
        <div className="grid items-end gap-3 sm:grid-cols-[12rem_1fr_auto]">
          <FormField id="w-u-sup" label="Fornecedor">
            <NativeSelect
              value={supplierId}
              onChange={(e) => {
                setSupplierId(e.target.value);
                setLookup({ state: "idle" });
              }}
            >
              <option value="">Selecione</option>
              {suppliers.data
                ?.filter((s) => s.is_active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({SUPPLIER_KIND_LABEL[s.kind].toLowerCase()})
                  </option>
                ))}
            </NativeSelect>
          </FormField>
          <FormField id="w-u-id" label={supplier?.kind === "water" ? "Matrícula" : "Número da UC"}>
            <Input
              value={identifier}
              autoComplete="off"
              onChange={(e) => {
                setIdentifier(e.target.value);
                setLookup({ state: "idle" });
              }}
            />
          </FormField>
          <Button type="button" variant="outline" onClick={check} loading={lookup.state === "loading"}>
            <Search aria-hidden="true" /> Verificar
          </Button>
        </div>

        {lookup.state === "error" && (
          <InlineAlert tone="danger" className="mt-3">
            {lookup.message}
          </InlineAlert>
        )}

        {lookup.state === "found" && supplier && (
          <div className="mt-4 space-y-3">
            <InlineAlert tone="warning" title="Unidade já cadastrada">
              {lookup.unit.current_property_id ? (
                <>
                  Vinculada atualmente a{" "}
                  <Link
                    href={`/imoveis/detalhe/?id=${lookup.unit.current_property_id}`}
                    className="font-semibold underline"
                  >
                    {lookup.unit.current_property_name ?? "imóvel de acesso restrito"}
                  </Link>{" "}
                  desde {formatCalendarDate(lookup.unit.current_start_date ?? null)}. A transferência encerra
                  esse vínculo na véspera da nova data e preserva o histórico.
                </>
              ) : (
                "A unidade existe e está sem vínculo. Ela será vinculada a este imóvel."
              )}
            </InlineAlert>
            <div className="grid items-end gap-3 sm:grid-cols-[14rem_auto]">
              <FormField id="w-u-start-x" label="Data de vinculação">
                <Input
                  type="date"
                  value={extra.start_date}
                  onChange={(e) => setExtra({ ...extra, start_date: e.target.value })}
                />
              </FormField>
              <Button
                type="button"
                onClick={() =>
                  addUnit({
                    key: crypto.randomUUID(),
                    mode: "existing",
                    unit_id: lookup.unit.id!,
                    supplier_name: supplier.name,
                    identifier: lookup.unit.identifier ?? identifier.trim().toUpperCase(),
                    holder_name: lookup.unit.holder_name ?? "",
                    current_property_name: lookup.unit.current_property_name ?? null,
                    current_start_date: lookup.unit.current_start_date ?? null,
                    start_date: extra.start_date,
                  })
                }
              >
                {lookup.unit.current_property_id ? "Transferir para este imóvel" : "Vincular a este imóvel"}
              </Button>
            </div>
          </div>
        )}

        {lookup.state === "new" && supplier && (
          <div className="mt-4 space-y-3">
            <p className="text-muted-foreground text-sm">Unidade não cadastrada. Complete os dados:</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="w-u-holder" label="Titular" required className="sm:col-span-2">
                <Input
                  value={extra.holder_name}
                  onChange={(e) => setExtra({ ...extra, holder_name: e.target.value })}
                />
              </FormField>
              {supplier.kind === "energy" ? (
                <FormField id="w-u-meter" label="Medidor">
                  <Input
                    value={extra.meter_number}
                    onChange={(e) => setExtra({ ...extra, meter_number: e.target.value })}
                  />
                </FormField>
              ) : (
                <>
                  <FormField id="w-u-compl" label="Complemento">
                    <Input
                      value={extra.complement}
                      onChange={(e) => setExtra({ ...extra, complement: e.target.value })}
                    />
                  </FormField>
                  <FormField
                    id="w-u-addr"
                    label="Endereço"
                    hint="Sugerido a partir do endereço do imóvel."
                    className="sm:col-span-2"
                  >
                    <Input
                      value={extra.address}
                      onChange={(e) => setExtra({ ...extra, address: e.target.value })}
                    />
                  </FormField>
                </>
              )}
              <FormField
                id="w-u-start"
                label="Data de vinculação"
                required
                hint="Sugerida: início da vigência do contrato."
              >
                <Input
                  type="date"
                  value={extra.start_date}
                  onChange={(e) => setExtra({ ...extra, start_date: e.target.value })}
                />
              </FormField>
            </div>
            <Button
              type="button"
              onClick={() =>
                addUnit({
                  key: crypto.randomUUID(),
                  mode: "new",
                  supplier_id: supplier.id,
                  supplier_name: supplier.name,
                  supplier_kind: supplier.kind,
                  identifier: identifier.trim().toUpperCase(),
                  holder_name: extra.holder_name,
                  meter_number: extra.meter_number,
                  complement: extra.complement,
                  address: extra.address,
                  start_date: extra.start_date,
                })
              }
            >
              <Plus aria-hidden="true" /> Adicionar unidade
            </Button>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-foreground mb-2 text-sm font-semibold">Unidades deste cadastro</h3>
        {ui.units.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm">
            Nenhuma unidade adicionada.
          </p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {ui.units.map((u, idx) => (
              <li key={u.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span>
                  <span className="font-semibold">
                    {u.supplier_name} {u.identifier}
                  </span>{" "}
                  {u.mode === "new" ? (
                    <Badge tone="info">Nova</Badge>
                  ) : (
                    <Badge tone="warning">{u.current_property_name ? "Transferência" : "Vínculo"}</Badge>
                  )}
                  <span className="text-muted-foreground block">
                    {u.holder_name} · vinculação em {formatCalendarDate(u.start_date)}
                  </span>
                  {(errors[`${idx}.identifier`] ||
                    errors[`${idx}.start_date`] ||
                    errors[`${idx}.holder_name`]) && (
                    <span className="text-danger block">
                      {errors[`${idx}.identifier`] ??
                        errors[`${idx}.start_date`] ??
                        errors[`${idx}.holder_name`]}
                    </span>
                  )}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => update((x) => ({ ...x, units: x.units.filter((_, i) => i !== idx) }))}
                  aria-label={`Remover ${u.supplier_name} ${u.identifier}`}
                >
                  <Trash2 aria-hidden="true" /> Remover
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
