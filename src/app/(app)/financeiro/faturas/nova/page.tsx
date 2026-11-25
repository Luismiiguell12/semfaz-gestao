"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { FormField } from "@/components/shared/form-field";
import { InlineAlert } from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { assignmentAt, useConsumerUnits, type Assignment } from "@/modules/consumer-units/api";
import { useDepartments } from "@/modules/departments/api";
import { useCreateInvoice } from "@/modules/finance/api";
import { parseBrlInput } from "@shared/schemas/br.ts";

function NewInvoiceForm() {
  const router = useRouter();
  const units = useConsumerUnits();
  const create = useCreateInvoice();
  const [v, setV] = React.useState({
    unit_id: "",
    competence: "",
    invoice_number: "",
    consumption: "",
    amount: "",
    issue_date: "",
    due_date: "",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string>();
  const [duplicate, setDuplicate] = React.useState(false);
  const [justification, setJustification] = React.useState("");
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV({ ...v, [k]: e.target.value });
  const unit = units.data?.find((u) => u.id === v.unit_id);
  const kind = (unit?.suppliers as { kind: string } | null)?.kind;

  async function submit() {
    setError(undefined);
    const errs: Record<string, string> = {};
    if (!v.unit_id) errs.unit_id = "Selecione a unidade consumidora.";
    if (!/^\d{4}-\d{2}$/.test(v.competence)) errs.competence = "Informe a competência (mês/ano).";
    const consumption = v.consumption.trim().replace(/\./g, "").replace(",", ".");
    if (!/^\d+(\.\d{1,3})?$/.test(consumption))
      errs.consumption = "Informe o consumo (número, até 3 casas decimais).";
    const amount = parseBrlInput(v.amount);
    if (!amount || Number(amount) <= 0) errs.amount = "Informe o valor (ex.: 1.234,56).";
    if (!v.due_date) errs.due_date = "Informe o vencimento.";
    if (v.issue_date && v.due_date && v.issue_date > v.due_date)
      errs.issue_date = "A emissão não pode ser posterior ao vencimento.";
    if (v.invoice_number && !/^[0-9A-Za-z./-]{1,60}$/.test(v.invoice_number.trim()))
      errs.invoice_number = "Número inválido.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (duplicate && justification.trim().length < 10)
      return setError("Informe a justificativa da fatura duplicada (mínimo de 10 caracteres).");
    try {
      const r = await create.mutateAsync({
        data: {
          ...v,
          competence: `${v.competence}-01`,
          consumption,
          amount,
          invoice_number: v.invoice_number.trim(),
        },
        justification: duplicate ? justification.trim() : undefined,
      });
      if (r.approval_request_id) {
        toast.success("Fatura duplicada enviada para aprovação.");
        router.push(`/aprovacoes/detalhe/?id=${r.approval_request_id}`);
      } else {
        toast.success("Fatura lançada.");
        router.push(`/financeiro/faturas/detalhe/?id=${r.invoice_id}`);
      }
    } catch (e) {
      if ((e as Error & { duplicate?: boolean }).duplicate) setDuplicate(true);
      setError((e as Error).message);
    }
  }

  return (
    <>
      <Button asChild variant="link" size="sm" className="mb-3">
        <Link href="/financeiro/faturas/">
          <ArrowLeft aria-hidden="true" /> Faturas
        </Link>
      </Button>
      <PageHeader
        title="Lançar fatura"
        description="O imóvel é definido pelo vínculo da unidade na competência. Lançamento manual a partir da fatura da concessionária."
      />
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-6"
      >
        {error && <InlineAlert tone={duplicate ? "warning" : "danger"}>{error}</InlineAlert>}
        <Panel title="Fatura">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              id="f-unit"
              label="Unidade consumidora"
              required
              error={errors.unit_id}
              className="sm:col-span-2 lg:col-span-3"
            >
              <NativeSelect value={v.unit_id} onChange={set("unit_id")}>
                <option value="">Selecione</option>
                {units.data
                  ?.filter((u) => u.status === "active")
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {(u.suppliers as { name: string } | null)?.name} {u.identifier}
                      {u.current ? `, ${u.current.properties?.name}` : ", sem vínculo"}
                    </option>
                  ))}
              </NativeSelect>
            </FormField>
            <FormField id="f-comp" label="Competência" required error={errors.competence}>
              <Input type="month" value={v.competence} onChange={set("competence")} />
            </FormField>
            {unit && <UnitPreview unit={unit} competence={v.competence} />}
            <FormField id="f-num" label="Número da fatura" error={errors.invoice_number}>
              <Input value={v.invoice_number} onChange={set("invoice_number")} />
            </FormField>
            <FormField
              id="f-cons"
              label={`Consumo (${kind === "water" ? "m³" : "kWh"})`}
              required
              error={errors.consumption}
            >
              <Input inputMode="decimal" value={v.consumption} onChange={set("consumption")} />
            </FormField>
            <FormField id="f-amount" label="Valor (R$)" required error={errors.amount}>
              <Input inputMode="decimal" placeholder="0,00" value={v.amount} onChange={set("amount")} />
            </FormField>
            <FormField id="f-issue" label="Emissão" error={errors.issue_date}>
              <Input type="date" value={v.issue_date} onChange={set("issue_date")} />
            </FormField>
            <FormField id="f-due" label="Vencimento" required error={errors.due_date}>
              <Input type="date" value={v.due_date} onChange={set("due_date")} />
            </FormField>
          </div>
        </Panel>
        {duplicate && (
          <Panel
            title="Fatura duplicada"
            description="Já existe fatura desta unidade nesta competência. Para lançar mesmo assim, justifique: a fatura passa a valer depois da aprovação."
          >
            <FormField id="f-just" label="Justificativa" required>
              <Textarea rows={3} value={justification} onChange={(e) => setJustification(e.target.value)} />
            </FormField>
          </Panel>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={create.isPending}>
            {duplicate ? "Enviar para aprovação" : "Lançar fatura"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/financeiro/faturas/")}>
            Cancelar
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          O arquivo da fatura pode ser anexado no detalhe, depois do lançamento.
        </p>
      </form>
    </>
  );
}

/** Dados preenchidos automaticamente a partir da unidade e da competência. */
function UnitPreview({
  unit,
  competence,
}: {
  unit: { suppliers: unknown; unit_assignments: unknown };
  competence: string;
}) {
  const deps = useDepartments();
  const supplier = unit.suppliers as { name: string; kind: "energy" | "water" } | null;
  const a = assignmentAt((unit.unit_assignments ?? []) as Assignment[], competence);
  const dept = deps.data?.find((d) => d.id === a?.properties?.department_id)?.name;
  return (
    <div
      className="bg-surface rounded-md border px-4 py-3 text-sm sm:col-span-2 lg:col-span-3"
      aria-live="polite"
    >
      <p className="text-muted-foreground mb-1 text-xs font-semibold">Preenchido a partir da unidade</p>
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground text-xs">Fornecedor</dt>
          <dd>{supplier?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Unidade de medida</dt>
          <dd>{supplier?.kind === "water" ? "m³" : "kWh"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Imóvel na competência</dt>
          <dd>
            {!competence ? (
              "Informe a competência"
            ) : a ? (
              <Link href={`/imoveis/detalhe/?id=${a.property_id}`} className="text-primary hover:underline">
                {a.properties?.name ?? "Acesso restrito"}
              </Link>
            ) : (
              <span className="text-danger">Sem vínculo na competência</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Secretaria</dt>
          <dd>{a ? (dept ?? "Acesso restrito") : "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <RequirePermission permission="invoices.manage">
      <NewInvoiceForm />
    </RequirePermission>
  );
}
