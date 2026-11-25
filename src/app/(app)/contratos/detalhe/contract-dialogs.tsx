"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/form-field";
import { InlineAlert } from "@/components/shared/states";
import { UserSelect } from "@/components/shared/pickers";
import {
  useContractLists,
  useRequestAmendment,
  useRequestTermChange,
  useRequestValueChange,
  useUpdateContractDetails,
  type ContractOverview,
} from "@/modules/contracts/api";
import { amendmentCreateSchema } from "@shared/schemas/contracts.ts";
import { parseBrlInput } from "@shared/schemas/br.ts";

type Props = { contract: ContractOverview; open: boolean; onOpenChange: (v: boolean) => void };

const toBrl = (v: number | string | null) =>
  v === null ? "" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function DialogShell({
  open,
  onOpenChange,
  title,
  description,
  error,
  children,
  onSubmit,
  submitLabel,
  pending,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  error?: string;
  children: React.ReactNode;
  onSubmit: () => void;
  submitLabel: string;
  pending: boolean;
  size?: "md" | "lg";
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent size={size}>
        <form
          noValidate
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {error && <InlineAlert tone="danger">{error}</InlineAlert>}
            {children}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ValueChangeDialog({ contract, open, onOpenChange }: Props) {
  const router = useRouter();
  const req = useRequestValueChange();
  const [monthly, setMonthly] = React.useState(toBrl(contract.monthly_value));
  const [global, setGlobal] = React.useState(toBrl(contract.global_value));
  const [just, setJust] = React.useState("");
  const [error, setError] = React.useState<string>();
  async function submit() {
    const m = parseBrlInput(monthly);
    const g = parseBrlInput(global);
    if (!m || !g) return setError("Informe valores válidos (ex.: 1.234,56).");
    if (just.trim().length < 10) return setError("Informe a justificativa (mínimo de 10 caracteres).");
    try {
      const r = await req.mutateAsync({
        id: contract.id!,
        monthly: m,
        global: g,
        justification: just.trim(),
      });
      toast.success("Alteração de valor enviada para aprovação.");
      router.push(`/aprovacoes/detalhe/?id=${r.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Solicitar alteração de valor"
      error={error}
      pending={req.isPending}
      description="Corrige os valores originais do contrato. Para reajustes e repactuações, prefira registrar um aditivo de valor."
      onSubmit={submit}
      submitLabel="Enviar para aprovação"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="vc-m" label="Valor mensal (R$)" required>
          <Input inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
        </FormField>
        <FormField id="vc-g" label="Valor global (R$)" required>
          <Input inputMode="decimal" value={global} onChange={(e) => setGlobal(e.target.value)} />
        </FormField>
      </div>
      <FormField id="vc-j" label="Justificativa" required>
        <Textarea rows={2} value={just} onChange={(e) => setJust(e.target.value)} />
      </FormField>
    </DialogShell>
  );
}

export function TermChangeDialog({ contract, open, onOpenChange }: Props) {
  const router = useRouter();
  const req = useRequestTermChange();
  const [start, setStart] = React.useState(contract.start_date ?? "");
  const [end, setEnd] = React.useState(contract.end_date ?? "");
  const [just, setJust] = React.useState("");
  const [error, setError] = React.useState<string>();
  async function submit() {
    if (!start || !end) return setError("Informe início e fim da vigência.");
    if (end < start) return setError("O fim da vigência deve ser posterior ao início.");
    if (just.trim().length < 10) return setError("Informe a justificativa (mínimo de 10 caracteres).");
    try {
      const r = await req.mutateAsync({ id: contract.id!, start, end, justification: just.trim() });
      toast.success("Alteração de vigência enviada para aprovação.");
      router.push(`/aprovacoes/detalhe/?id=${r.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Solicitar alteração de vigência"
      error={error}
      pending={req.isPending}
      description="Corrige as datas originais do contrato. Prorrogações devem ser registradas como aditivo de prazo."
      onSubmit={submit}
      submitLabel="Enviar para aprovação"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="tc-s" label="Início da vigência" required>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </FormField>
        <FormField id="tc-e" label="Fim da vigência" required>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </FormField>
      </div>
      <FormField id="tc-j" label="Justificativa" required>
        <Textarea rows={2} value={just} onChange={(e) => setJust(e.target.value)} />
      </FormField>
    </DialogShell>
  );
}

export function AmendmentDialog({ contract, open, onOpenChange }: Props) {
  const router = useRouter();
  const req = useRequestAmendment();
  const [v, setV] = React.useState({
    amendment_number: "",
    kind: "term",
    signed_on: "",
    new_end_date: "",
    new_monthly_value: "",
    value_effective_from: "",
    description: "",
    justification: "",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string>();
  const set =
    (k: keyof typeof v) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setV({ ...v, [k]: e.target.value });
  const term = v.kind === "term" || v.kind === "term_and_value";
  const value = v.kind === "value" || v.kind === "term_and_value";

  async function submit() {
    setError(undefined);
    const parsed = amendmentCreateSchema.safeParse({ ...v, contract_id: contract.id });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    const { justification, ...data } = parsed.data;
    try {
      const r = await req.mutateAsync({
        data: {
          ...data,
          new_end_date: term ? data.new_end_date : "",
          new_monthly_value: value ? parseBrlInput(data.new_monthly_value ?? "") : "",
          value_effective_from: value ? data.value_effective_from : "",
        },
        justification,
      });
      toast.success("Aditivo enviado para aprovação.");
      router.push(`/aprovacoes/detalhe/?id=${r.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Solicitar aditivo"
      error={error}
      pending={req.isPending}
      size="lg"
      description="O aditivo só passa a valer depois de aprovado e nunca altera os dados originais do contrato."
      onSubmit={submit}
      submitLabel="Enviar para aprovação"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="am-n" label="Número do aditivo" required error={errors.amendment_number}>
          <Input value={v.amendment_number} onChange={set("amendment_number")} />
        </FormField>
        <FormField id="am-k" label="Tipo" required>
          <NativeSelect value={v.kind} onChange={set("kind")}>
            <option value="term">Prazo</option>
            <option value="value">Valor</option>
            <option value="term_and_value">Prazo e valor</option>
            <option value="other">Outro</option>
          </NativeSelect>
        </FormField>
        <FormField id="am-s" label="Data de assinatura" required error={errors.signed_on}>
          <Input type="date" value={v.signed_on} onChange={set("signed_on")} />
        </FormField>
        {term && (
          <FormField id="am-e" label="Nova vigência (fim)" required error={errors.new_end_date}>
            <Input type="date" value={v.new_end_date} onChange={set("new_end_date")} />
          </FormField>
        )}
        {value && (
          <>
            <FormField id="am-v" label="Novo valor mensal (R$)" required error={errors.new_monthly_value}>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={v.new_monthly_value}
                onChange={set("new_monthly_value")}
              />
            </FormField>
            <FormField id="am-f" label="Novo valor a partir de" required error={errors.value_effective_from}>
              <Input type="date" value={v.value_effective_from} onChange={set("value_effective_from")} />
            </FormField>
          </>
        )}
      </div>
      <FormField id="am-d" label="Descrição" required error={errors.description}>
        <Textarea rows={2} value={v.description} onChange={set("description")} />
      </FormField>
      <FormField id="am-j" label="Justificativa" required error={errors.justification}>
        <Textarea rows={2} value={v.justification} onChange={set("justification")} />
      </FormField>
    </DialogShell>
  );
}

export function ContractDetailsDialog({ contract, open, onOpenChange }: Props) {
  const update = useUpdateContractDetails();
  const lists = useContractLists();
  const [v, setV] = React.useState({
    contract_number: contract.contract_number ?? "",
    process_number: contract.process_number ?? "",
    modality_id: contract.modality_id ?? "",
    object: contract.object ?? "",
    signed_on: contract.signed_on ?? "",
    adjustment_index_id: contract.adjustment_index_id ?? "",
    base_date: contract.base_date ?? "",
    inspector_id: contract.inspector_id ?? "",
    manager_id: contract.manager_id ?? "",
    admin_status: contract.admin_status ?? "active",
    notes: contract.notes ?? "",
    reason: "",
  });
  const [error, setError] = React.useState<string>();
  const set =
    (k: keyof typeof v) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setV({ ...v, [k]: e.target.value });
  async function submit() {
    if (!v.contract_number.trim()) return setError("Informe o número do contrato.");
    if (v.object.trim().length < 5) return setError("Descreva o objeto (mínimo de 5 caracteres).");
    if (v.reason.trim().length < 10) return setError("Informe a justificativa (mínimo de 10 caracteres).");
    const { reason, ...data } = v;
    try {
      await update.mutateAsync({ id: contract.id!, data, reason: reason.trim() });
      toast.success("Dados do contrato atualizados.");
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Editar dados do contrato"
      error={error}
      pending={update.isPending}
      size="lg"
      description="Valores e vigência não são editados aqui: use as solicitações próprias ou os aditivos."
      onSubmit={submit}
      submitLabel="Salvar alterações"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="cd-n" label="Número do contrato" required>
          <Input value={v.contract_number} onChange={set("contract_number")} />
        </FormField>
        <FormField id="cd-p" label="Processo administrativo">
          <Input value={v.process_number} onChange={set("process_number")} />
        </FormField>
        <FormField id="cd-m" label="Modalidade">
          <NativeSelect value={v.modality_id} onChange={set("modality_id")}>
            <option value="">Não informada</option>
            {lists.data?.modalities.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="cd-s" label="Data de assinatura" required>
          <Input type="date" value={v.signed_on} onChange={set("signed_on")} />
        </FormField>
        <FormField id="cd-o" label="Objeto" required className="sm:col-span-2">
          <Textarea rows={2} value={v.object} onChange={set("object")} />
        </FormField>
        <FormField id="cd-i" label="Índice de reajuste">
          <NativeSelect value={v.adjustment_index_id} onChange={set("adjustment_index_id")}>
            <option value="">Não informado</option>
            {lists.data?.indexes.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="cd-b" label="Data-base">
          <Input type="date" value={v.base_date} onChange={set("base_date")} />
        </FormField>
        <FormField id="cd-g" label="Gestor do contrato">
          <UserSelect value={v.manager_id} onChange={set("manager_id")} />
        </FormField>
        <FormField id="cd-f" label="Fiscal do contrato">
          <UserSelect value={v.inspector_id} onChange={set("inspector_id")} />
        </FormField>
        <FormField id="cd-st" label="Situação administrativa" required>
          <NativeSelect value={v.admin_status} onChange={set("admin_status")}>
            <option value="active">Ativo</option>
            <option value="suspended">Suspenso</option>
            <option value="terminated">Rescindido</option>
            <option value="closed">Encerrado</option>
          </NativeSelect>
        </FormField>
        <FormField id="cd-no" label="Observações" className="sm:col-span-2">
          <Textarea rows={2} value={v.notes} onChange={set("notes")} />
        </FormField>
        <FormField id="cd-r" label="Justificativa" required className="sm:col-span-2">
          <Textarea rows={2} value={v.reason} onChange={set("reason")} />
        </FormField>
      </div>
    </DialogShell>
  );
}
