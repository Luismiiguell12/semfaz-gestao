"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, Pencil, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState, ErrorState, InlineAlert, LoadingRows } from "@/components/shared/states";
import { FormField } from "@/components/shared/form-field";
import { RequirePermission } from "@/components/auth/route-guard";
import { Badge } from "@/components/ui/badge";
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
import {
  fetchLandlordSensitive,
  useLandlords,
  useSaveLandlord,
  type Landlord,
} from "@/modules/landlords/api";
import { landlordSchema, type LandlordInput } from "@shared/schemas/properties.ts";
import { formatCpfCnpj, formatPhone } from "@shared/schemas/br.ts";
import { useAuth } from "@/providers/auth-provider";

function LandlordDialog({
  editing,
  open,
  onOpenChange,
}: {
  editing: Landlord | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const save = useSaveLandlord();
  const [error, setError] = React.useState<string>();
  const [reason, setReason] = React.useState("");
  const form = useForm<LandlordInput>({
    resolver: zodResolver(landlordSchema),
    defaultValues: editing
      ? {
          person_type: editing.person_type,
          name: editing.name,
          document: "",
          phone: "",
          email: editing.email ?? "",
          address: editing.address ?? "",
          notes: editing.notes ?? "",
        }
      : { person_type: "individual", name: "", document: "", phone: "", email: "", address: "", notes: "" },
  });
  const type = form.watch("person_type");
  const errors = form.formState.errors;

  async function onSubmit(values: LandlordInput) {
    setError(undefined);
    if (editing && reason.trim().length < 10) {
      setError("Informe a justificativa da alteração (mínimo de 10 caracteres).");
      return;
    }
    try {
      await save.mutateAsync({ id: editing?.id ?? null, values, reason: reason.trim() });
      toast.success(editing ? "Locador atualizado." : "Locador cadastrado.");
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="contents">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar locador" : "Novo locador"}</DialogTitle>
            <DialogDescription>
              Dados bancários não são armazenados. CPF e telefone ficam mascarados por padrão.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            {error && (
              <InlineAlert tone="danger" className="sm:col-span-2">
                {error}
              </InlineAlert>
            )}
            {editing && (
              <InlineAlert tone="info" className="sm:col-span-2">
                Por proteção de dados, informe novamente o CPF/CNPJ e o telefone ao editar.
              </InlineAlert>
            )}
            <FormField id="l-type" label="Tipo de pessoa" required>
              <NativeSelect {...form.register("person_type")}>
                <option value="individual">Pessoa física</option>
                <option value="company">Pessoa jurídica</option>
              </NativeSelect>
            </FormField>
            <FormField
              id="l-doc"
              label={type === "individual" ? "CPF" : "CNPJ"}
              required
              error={errors.document?.message}
            >
              <Input
                {...form.register("document", {
                  onChange: (e) => form.setValue("document", formatCpfCnpj(e.target.value)),
                })}
                inputMode="numeric"
                autoComplete="off"
              />
            </FormField>
            <FormField
              id="l-name"
              label={type === "individual" ? "Nome" : "Razão social"}
              required
              error={errors.name?.message}
              className="sm:col-span-2"
            >
              <Input {...form.register("name")} autoComplete="off" />
            </FormField>
            <FormField id="l-phone" label="Telefone" error={errors.phone?.message}>
              <Input
                {...form.register("phone", {
                  onChange: (e) => form.setValue("phone", formatPhone(e.target.value)),
                })}
                inputMode="tel"
                autoComplete="off"
              />
            </FormField>
            <FormField id="l-email" label="E-mail" error={errors.email?.message}>
              <Input type="email" {...form.register("email")} autoComplete="off" />
            </FormField>
            <FormField
              id="l-address"
              label="Endereço"
              className="sm:col-span-2"
              error={errors.address?.message}
            >
              <Input {...form.register("address")} autoComplete="off" />
            </FormField>
            <FormField
              id="l-notes"
              label="Observações"
              className="sm:col-span-2"
              error={errors.notes?.message}
            >
              <Textarea rows={2} {...form.register("notes")} />
            </FormField>
            {editing && (
              <FormField id="l-reason" label="Justificativa" required className="sm:col-span-2">
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              </FormField>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {editing ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SensitiveButton({ landlord }: { landlord: Landlord }) {
  const [data, setData] = React.useState<{ document: string; phone: string | null } | null>(null);
  const [loading, setLoading] = React.useState(false);
  if (data) {
    return (
      <span className="text-sm">
        {formatCpfCnpj(data.document)}
        {data.phone ? `, ${formatPhone(data.phone)}` : ""}
      </span>
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        try {
          setData(await fetchLandlordSensitive(landlord.id));
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setLoading(false);
        }
      }}
      aria-label={`Ver dados completos de ${landlord.name}`}
    >
      <Eye aria-hidden="true" /> Ver completo
    </Button>
  );
}

function LandlordsContent() {
  const { can } = useAuth();
  const list = useLandlords();
  const [dialog, setDialog] = React.useState<{ editing: Landlord | null } | null>(null);
  const canManage = can("landlords.manage");
  const canSensitive = can("landlords.view_sensitive");

  const columns: ColumnDef<Landlord, unknown>[] = [
    {
      id: "name",
      accessorFn: (l) => `${l.name} ${l.document_masked}`,
      header: "Locador",
      meta: { label: "Locador", hideOnCard: true },
      cell: ({ row }) => (
        <span>
          <span className="block font-semibold">{row.original.name}</span>
          <Badge tone="neutral">
            {row.original.person_type === "individual" ? "Pessoa física" : "Pessoa jurídica"}
          </Badge>
        </span>
      ),
    },
    {
      id: "document",
      accessorKey: "document_masked",
      header: "CPF/CNPJ",
      meta: { label: "CPF/CNPJ" },
      cell: ({ getValue }) => <span className="tabular">{getValue() as string}</span>,
    },
    {
      id: "phone",
      accessorFn: (l) => l.phone_masked ?? "",
      header: "Telefone",
      meta: { label: "Telefone" },
      cell: ({ getValue }) => (getValue() as string) || "—",
    },
    {
      id: "email",
      accessorFn: (l) => l.email ?? "",
      header: "E-mail",
      meta: { label: "E-mail" },
      cell: ({ getValue }) => (getValue() as string) || "—",
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { label: "Ações" },
      cell: ({ row }) => (
        <span className="flex flex-wrap justify-end gap-1">
          {canSensitive && <SensitiveButton landlord={row.original} />}
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDialog({ editing: row.original })}
              aria-label={`Editar ${row.original.name}`}
            >
              <Pencil aria-hidden="true" /> Editar
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Locadores"
        description="Pessoas e empresas que alugam imóveis à Prefeitura. CPF e telefone aparecem mascarados; a consulta completa é restrita e fica registrada."
        actions={
          canManage && (
            <Button onClick={() => setDialog({ editing: null })}>
              <Plus aria-hidden="true" /> Novo locador
            </Button>
          )
        }
      />
      <Panel bodyClassName="p-0">
        {list.isLoading && <LoadingRows />}
        {list.isError && <ErrorState message={list.error.message} onRetry={() => list.refetch()} />}
        {list.data && (
          <DataTable
            columns={columns}
            data={list.data}
            getRowId={(l) => l.id}
            searchPlaceholder="Buscar por nome"
            cardTitle={(l) => <span className="font-semibold">{l.name}</span>}
            emptyState={<EmptyState icon={UserRound} title="Nenhum locador cadastrado" />}
          />
        )}
      </Panel>
      {dialog && (
        <LandlordDialog
          key={dialog.editing?.id ?? "new"}
          editing={dialog.editing}
          open
          onOpenChange={(v) => !v && setDialog(null)}
        />
      )}
    </>
  );
}

export default function LandlordsPage() {
  return (
    <RequirePermission permission="landlords.view">
      <LandlordsContent />
    </RequirePermission>
  );
}
