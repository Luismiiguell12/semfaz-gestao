"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { EmptyState, ErrorState, FullPageLoading, InlineAlert } from "@/components/shared/states";
import { FormField } from "@/components/shared/form-field";
import { DetailList } from "@/components/shared/detail-list";
import { ApprovalStatusBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DocumentsPanel } from "@/modules/documents/documents-panel";
import { useContractLists } from "@/modules/contracts/api";
import { useDepartments } from "@/modules/departments/api";
import { useUserDirectory } from "@/modules/users/api";
import {
  EMPTY_UI,
  useDraft,
  useReopenDraft,
  useSaveDraft,
  useSubmitPackage,
  type Draft,
  type DraftUi,
} from "@/modules/registration/api";
import {
  buildPackage,
  draftTitle,
  validateContract,
  validateJustification,
  validateLandlords,
  validateProperty,
  validateUnits,
  type StepErrors,
} from "@/modules/registration/package";
import { parseBrlInput } from "@shared/schemas/br.ts";
import { formatCalendarDate, formatCurrency } from "@/lib/format";
import { ContractStep, LandlordsStep, PropertyStep, UnitsStep } from "./steps";

const STEPS = [
  { n: 1, title: "Dados do contrato" },
  { n: 2, title: "Locadores" },
  { n: 3, title: "Imóvel" },
  { n: 4, title: "Unidades consumidoras" },
  { n: 5, title: "Revisão e envio" },
] as const;

function validateStep(step: number, ui: DraftUi): StepErrors | null {
  const r =
    step === 1
      ? validateContract(ui)
      : step === 2
        ? validateLandlords(ui)
        : step === 3
          ? validateProperty(ui)
          : step === 4
            ? validateUnits(ui)
            : validateJustification(ui);
  return r.ok ? null : r.errors;
}

function Stepper({
  current,
  maxReachable,
  onGo,
}: {
  current: number;
  maxReachable: number;
  onGo: (n: number) => void;
}) {
  return (
    <nav aria-label="Etapas do cadastro" className="mb-6">
      <p className="text-muted-foreground mb-2 text-sm sm:hidden">
        Etapa {current} de {STEPS.length}:{" "}
        <strong className="text-foreground">{STEPS[current - 1]!.title}</strong>
      </p>
      <ol className="hidden gap-2 sm:grid sm:grid-cols-5">
        {STEPS.map((s) => {
          const done = s.n < current;
          const active = s.n === current;
          const reachable = s.n <= maxReachable;
          return (
            <li key={s.n}>
              <button
                type="button"
                disabled={!reachable || active}
                onClick={() => onGo(s.n)}
                aria-current={active ? "step" : undefined}
                className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm ${
                  active
                    ? "border-primary bg-primary-soft font-semibold"
                    : reachable
                      ? "hover:bg-surface"
                      : "opacity-60"
                }`}
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    done
                      ? "bg-success text-white"
                      : active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                  }`}
                  aria-hidden="true"
                >
                  {done ? <Check className="size-3.5" /> : s.n}
                </span>
                <span className="leading-tight">{s.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Review({
  ui,
  update,
  errors,
}: {
  ui: DraftUi;
  update: (fn: (u: DraftUi) => DraftUi) => void;
  errors: StepErrors;
}) {
  const lists = useContractLists();
  const deps = useDepartments();
  const users = useUserDirectory();
  const c = ui.contract;
  const name = (list: { id: string; name: string }[] | undefined, id: string) =>
    list?.find((x) => x.id === id)?.name ?? "—";
  const userName = (id: string) => users.data?.get(id)?.full_name ?? "—";
  const p = ui.property;
  return (
    <div className="space-y-6">
      <section aria-labelledby="r-contract">
        <h3 id="r-contract" className="text-foreground mb-2 text-sm font-semibold">
          Contrato (será criado após a aprovação)
        </h3>
        <DetailList
          items={[
            { label: "Número", value: c.contract_number },
            { label: "Processo", value: c.process_number || "—" },
            { label: "Modalidade", value: c.modality_id ? name(lists.data?.modalities, c.modality_id) : "—" },
            { label: "Objeto", value: c.object },
            { label: "Assinatura", value: formatCalendarDate(c.signed_on) },
            {
              label: "Vigência",
              value: `${formatCalendarDate(c.start_date)} a ${formatCalendarDate(c.end_date)}`,
            },
            { label: "Valor mensal", value: formatCurrency(parseBrlInput(c.monthly_value ?? "") ?? 0) },
            { label: "Valor global", value: formatCurrency(parseBrlInput(c.global_value ?? "") ?? 0) },
            {
              label: "Índice de reajuste",
              value: c.adjustment_index_id ? name(lists.data?.indexes, c.adjustment_index_id) : "—",
            },
            { label: "Data-base", value: c.base_date ? formatCalendarDate(c.base_date) : "—" },
            { label: "Gestor", value: c.manager_id ? userName(c.manager_id) : "—" },
            { label: "Fiscal", value: c.inspector_id ? userName(c.inspector_id) : "—" },
          ]}
        />
      </section>
      <section aria-labelledby="r-ll">
        <h3 id="r-ll" className="text-foreground mb-2 text-sm font-semibold">
          Locadores (vinculados ao contrato e ao imóvel)
        </h3>
        <ul className="list-inside list-disc text-sm">
          {ui.landlords.map((l) => (
            <li key={l.landlord_id}>
              {l.name} ({l.document_masked}){l.share ? ` — ${l.share}%` : ""}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="r-prop">
        <h3 id="r-prop" className="text-foreground mb-2 text-sm font-semibold">
          Imóvel
        </h3>
        {p.mode === "existing" ? (
          <p className="text-sm">
            Imóvel já cadastrado:{" "}
            <Link href={`/imoveis/detalhe/?id=${p.id}`} className="font-semibold hover:underline">
              {p.name}
            </Link>
          </p>
        ) : (
          <p className="text-sm">
            Novo imóvel (criado após a aprovação): <strong>{p.data.name}</strong> —{" "}
            {[p.data.street, p.data.address_number, p.data.complement, p.data.district]
              .filter(Boolean)
              .join(", ")}
            , {p.data.city}/{p.data.state}, CEP {p.data.postal_code}. Secretaria:{" "}
            {name(deps.data, p.data.department_id ?? "")}.
          </p>
        )}
      </section>
      <section aria-labelledby="r-units">
        <h3 id="r-units" className="text-foreground mb-2 text-sm font-semibold">
          Unidades consumidoras
        </h3>
        {ui.units.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhuma unidade neste cadastro (podem ser incluídas depois).
          </p>
        ) : (
          <ul className="list-inside list-disc text-sm">
            {ui.units.map((u) => (
              <li key={u.key}>
                {u.supplier_name} {u.identifier} —{" "}
                {u.mode === "new"
                  ? "nova unidade"
                  : u.current_property_name
                    ? `transferência de ${u.current_property_name}`
                    : "vínculo de unidade existente"}
                , a partir de {formatCalendarDate(u.start_date)}
              </li>
            ))}
          </ul>
        )}
      </section>
      <FormField
        id="w-just"
        label="Justificativa"
        required
        error={errors._}
        hint="Uma única solicitação reúne tudo o que será criado ou vinculado. Se for rejeitada, nada é criado; locadores já cadastrados permanecem."
      >
        <Textarea
          rows={3}
          value={ui.justification}
          onChange={(e) => {
            const v = e.target.value;
            update((u) => ({ ...u, justification: v }));
          }}
        />
      </FormField>
    </div>
  );
}

/** Rascunho já enviado: situação da solicitação e anexo do contrato. */
function Submitted({ draft }: { draft: Draft }) {
  const reopen = useReopenDraft();
  const req = draft.approval_requests;
  const status = req?.status ?? "pending";
  return (
    <div className="space-y-6">
      <Panel title="Cadastro enviado para aprovação">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          Situação da solicitação: <ApprovalStatusBadge status={status as never} />
        </div>
        {status === "pending" && (
          <p className="text-muted-foreground mt-3 text-sm">
            Um administrador (diferente de você) vai analisar o pacote. Anexe abaixo o arquivo digital do
            contrato.
          </p>
        )}
        {(status === "rejected" || status === "failed" || status === "cancelled") && (
          <InlineAlert tone="danger" className="mt-3" title="O cadastro não foi efetivado">
            {req?.failure_reason ?? req?.decision_comment ?? "Solicitação cancelada."}
            <div className="mt-3">
              <Button
                size="sm"
                loading={reopen.isPending}
                onClick={() =>
                  reopen.mutate(draft.id, {
                    onSuccess: () => toast.success("Rascunho reaberto. Corrija e envie novamente."),
                    onError: (e) => toast.error(e.message),
                  })
                }
              >
                Reabrir e corrigir
              </Button>
            </div>
          </InlineAlert>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {draft.approval_request_id && (
            <Button asChild variant="outline">
              <Link href={`/aprovacoes/detalhe/?id=${draft.approval_request_id}`}>Abrir a solicitação</Link>
            </Button>
          )}
          <Button asChild variant="ghost">
            <Link href="/cadastro-guiado/">Meus cadastros</Link>
          </Button>
        </div>
      </Panel>
      {draft.approval_request_id && (
        <Panel
          title="Arquivo digital do contrato"
          description="Anexos da solicitação (PDF, imagens ou documentos)."
        >
          <DocumentsPanel
            entityType="approval_request"
            entityId={draft.approval_request_id}
            canAttach={status === "pending"}
          />
        </Panel>
      )}
    </div>
  );
}

export function Wizard() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const q = useDraft(id);
  const save = useSaveDraft(id ?? "");
  const submit = useSubmitPackage(id ?? "");
  const [ui, setUi] = React.useState<DraftUi | null>(null);
  const [step, setStep] = React.useState(1);
  const [errors, setErrors] = React.useState<StepErrors>({});
  const [serverError, setServerError] = React.useState<string>();
  const [dirty, setDirty] = React.useState(false);
  const loadedFor = React.useRef<string | null>(null);

  React.useEffect(() => {
    const d = q.data;
    if (!d || d.status !== "draft" || loadedFor.current === `${d.id}:${d.status}`) return;
    loadedFor.current = `${d.id}:${d.status}`;
    setUi({
      ...EMPTY_UI,
      ...(d.data.ui ?? {}),
      contract: { ...EMPTY_UI.contract, ...(d.data.ui?.contract ?? {}) },
    });
    setStep(Math.min(Math.max(d.current_step, 1), 5));
  }, [q.data]);

  // Aviso ao sair com alterações não salvas.
  React.useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  if (q.isLoading) return <FullPageLoading />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  if (!q.data)
    return (
      <EmptyState title="Rascunho não encontrado" description="Ele não existe ou pertence a outra pessoa." />
    );
  const draft = q.data;

  const header = (
    <>
      <Button asChild variant="link" size="sm" className="mb-3">
        <Link href="/cadastro-guiado/">
          <ArrowLeft aria-hidden="true" /> Meus cadastros
        </Link>
      </Button>
      <PageHeader
        title="Novo cadastro a partir de contrato"
        description="Contrato → locadores → imóvel → unidades consumidoras. O andamento fica salvo como rascunho."
      />
    </>
  );
  if (draft.status === "submitted")
    return (
      <>
        {header}
        <Submitted draft={draft} />
      </>
    );
  if (draft.status === "discarded")
    return (
      <>
        {header}
        <EmptyState title="Rascunho descartado" />
      </>
    );
  if (!ui) return <FullPageLoading />;

  const update = (fn: (u: DraftUi) => DraftUi) => {
    setUi((u) => (u ? fn(u) : u));
    setDirty(true);
  };
  // A etapa mais avançada acessível: todas as anteriores válidas.
  let maxReachable = 1;
  for (let s = 1; s < 5; s++) {
    if (validateStep(s, ui)) break;
    maxReachable = s + 1;
  }

  async function persist(nextStep: number) {
    setServerError(undefined);
    try {
      await save.mutateAsync({ step: nextStep, title: draftTitle(ui!), data: buildPackage(ui!) });
      setDirty(false);
      return true;
    } catch (e) {
      setServerError((e as Error).message);
      return false;
    }
  }

  async function next() {
    const errs = validateStep(step, ui!);
    if (errs) {
      setErrors(errs);
      toast.error("Revise os campos destacados.");
      return;
    }
    setErrors({});
    if (await persist(step + 1)) {
      setStep(step + 1);
      window.scrollTo({ top: 0 });
    }
  }

  async function go(n: number) {
    setErrors({});
    if (await persist(n)) setStep(n);
  }

  async function send() {
    for (let s = 1; s <= 5; s++) {
      const errs = validateStep(s, ui!);
      if (errs) {
        setErrors(errs);
        if (s !== step) setStep(s);
        toast.error(`Revise a etapa ${s}: ${STEPS[s - 1]!.title}.`);
        return;
      }
    }
    if (!(await persist(5))) return;
    try {
      const r = await submit.mutateAsync(ui!.justification.trim());
      setDirty(false);
      toast.success(r.status === "approved" ? "Cadastro efetivado." : "Cadastro enviado para aprovação.");
      await q.refetch();
    } catch (e) {
      setServerError((e as Error).message);
    }
  }

  const stepProps = { ui, update, errors };
  return (
    <>
      {header}
      <Stepper current={step} maxReachable={maxReachable} onGo={go} />
      {serverError && (
        <InlineAlert tone="danger" className="mb-4" title="Não foi possível concluir">
          {serverError}
        </InlineAlert>
      )}
      <Panel title={`${step}. ${STEPS[step - 1]!.title}`}>
        {step === 1 && <ContractStep {...stepProps} />}
        {step === 2 && <LandlordsStep {...stepProps} />}
        {step === 3 && <PropertyStep {...stepProps} />}
        {step === 4 && <UnitsStep {...stepProps} />}
        {step === 5 && <Review {...stepProps} />}
      </Panel>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {step > 1 && (
          <Button type="button" variant="outline" onClick={() => go(step - 1)} disabled={save.isPending}>
            Voltar
          </Button>
        )}
        {step < 5 && (
          <Button type="button" onClick={next} loading={save.isPending}>
            Próxima etapa
          </Button>
        )}
        {step === 4 && ui.units.length === 0 && (
          <Button
            type="button"
            variant="ghost"
            onClick={async () => {
              update((u) => ({ ...u, unitsSkipped: true }));
              if (await persist(5)) setStep(5);
            }}
          >
            Pular esta etapa
          </Button>
        )}
        {step === 5 && (
          <Button type="button" onClick={send} loading={submit.isPending || save.isPending}>
            Enviar para aprovação
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={async () => {
            if (await persist(step)) toast.success("Rascunho salvo.");
          }}
          disabled={save.isPending}
        >
          <Save aria-hidden="true" /> Salvar rascunho
        </Button>
        <Button type="button" variant="link" onClick={() => router.push("/cadastro-guiado/")}>
          Sair
        </Button>
      </div>
    </>
  );
}
