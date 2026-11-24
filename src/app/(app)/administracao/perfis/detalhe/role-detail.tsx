"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { ErrorState, FullPageLoading, InlineAlert } from "@/components/shared/states";
import { FormField } from "@/components/shared/form-field";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MODULE_LABEL,
  MODULE_ORDER,
  useDeleteRole,
  usePermissions,
  useRoles,
  useSaveRole,
  type Permission,
} from "@/modules/roles/api";
import { roleSchema } from "@shared/schemas/organization.ts";
import { useAuth } from "@/providers/auth-provider";

type RoleWithPermissions = NonNullable<ReturnType<typeof useRoles>["data"]>[number];

export function RoleDetail() {
  const id = useSearchParams().get("id");
  const roles = useRoles();
  const permissions = usePermissions();
  const role = roles.data?.find((r) => r.id === id);

  if (roles.isLoading || permissions.isLoading) return <FullPageLoading />;
  if (roles.isError) return <ErrorState message={roles.error.message} />;
  if (permissions.isError) return <ErrorState message={permissions.error.message} />;
  if (id !== "novo" && !role) return <ErrorState title="Perfil não encontrado." />;
  return <RoleEditor key={role?.id ?? "novo"} role={role ?? null} permissions={permissions.data ?? []} />;
}

function RoleEditor({ role, permissions }: { role: RoleWithPermissions | null; permissions: Permission[] }) {
  const isNew = role === null;
  const router = useRouter();
  const { access } = useAuth();
  const save = useSaveRole();
  const remove = useDeleteRole();
  const isAdminRole = role?.code === "admin";
  const heldBySelf = Boolean(role && access?.roles?.some((r) => r.id === role.id));

  const [code, setCode] = React.useState(role?.code ?? "");
  const [name, setName] = React.useState(role?.name ?? "");
  const [description, setDescription] = React.useState(role?.description ?? "");
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(role?.role_permissions.map((p) => p.permission_code) ?? []),
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [confirm, setConfirm] = React.useState<"save" | "delete" | null>(null);

  const grouped = React.useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissions) map.set(p.module, [...(map.get(p.module) ?? []), p]);
    const rank = (m: string) => MODULE_ORDER.indexOf(m) + 1 || 99;
    return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [permissions]);

  const readOnly = isAdminRole || heldBySelf;

  function validate(reason: string) {
    const parsed = roleSchema.safeParse({ code, name, description, permission_codes: [...selected], reason });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = issue.message;
      setErrors(errs);
      return null;
    }
    setErrors({});
    return parsed.data;
  }

  return (
    <>
      <Button asChild variant="link" size="sm" className="mb-3">
        <Link href="/administracao/perfis/">
          <ArrowLeft aria-hidden="true" /> Perfis de acesso
        </Link>
      </Button>
      <PageHeader
        title={isNew ? "Novo perfil de acesso" : (role?.name ?? "")}
        description="Permissões marcadas com escudo exigem verificação em duas etapas (MFA) na sessão."
        actions={
          role && !role.is_system && !readOnly ? (
            <Button
              variant="outline"
              className="border-danger/40 text-danger hover:bg-danger-soft"
              onClick={() => setConfirm("delete")}
            >
              Excluir perfil
            </Button>
          ) : null
        }
      />
      {isAdminRole && (
        <InlineAlert tone="info" className="mb-4" title="Perfil protegido">
          O Administrador possui todas as permissões, inclusive as de módulos futuros, e não pode ser editado.
        </InlineAlert>
      )}
      {heldBySelf && !isAdminRole && (
        <InlineAlert tone="info" className="mb-4">
          Você possui este perfil e, por segurança, não pode alterar suas permissões.
        </InlineAlert>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel title="Identificação">
          <div className="space-y-4">
            <FormField
              id="role-code"
              label="Código"
              required
              error={errors.code}
              hint="Identificador técnico, não pode ser alterado depois."
            >
              <Input value={code} onChange={(e) => setCode(e.target.value)} disabled={!isNew} />
            </FormField>
            <FormField id="role-name" label="Nome" required error={errors.name}>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} />
            </FormField>
            <FormField id="role-desc" label="Descrição" error={errors.description}>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={readOnly}
                rows={3}
              />
            </FormField>
            {!readOnly && (
              <Button
                onClick={() => {
                  if (validate("justificativa provisória")) setConfirm("save");
                }}
              >
                {isNew ? "Criar perfil" : "Salvar perfil"}
              </Button>
            )}
          </div>
        </Panel>
        <Panel
          title="Permissões"
          description={`${isAdminRole ? permissions.length : selected.size} de ${permissions.length} selecionadas`}
        >
          <div className="space-y-6">
            {grouped.map(([module, perms]) => (
              <fieldset key={module}>
                <legend className="text-brand mb-2 text-sm font-semibold">
                  {MODULE_LABEL[module] ?? module}
                </legend>
                <div className="space-y-2">
                  {perms.map((p) => {
                    const cid = `perm-${p.code}`;
                    return (
                      <div key={p.code} className="flex items-start gap-2.5">
                        <Checkbox
                          id={cid}
                          className="mt-0.5"
                          checked={isAdminRole || selected.has(p.code)}
                          disabled={readOnly}
                          onCheckedChange={(v) =>
                            setSelected((s) => {
                              const n = new Set(s);
                              if (v) n.add(p.code);
                              else n.delete(p.code);
                              return n;
                            })
                          }
                        />
                        <label htmlFor={cid} className="cursor-pointer text-sm">
                          <span className="flex items-center gap-1.5">
                            {p.description}
                            {p.is_privileged && (
                              <ShieldAlert className="text-warning size-3.5" aria-label="exige MFA" />
                            )}
                          </span>
                          <span className="text-muted-foreground block font-mono text-[11px]">{p.code}</span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            {isAdminRole && (
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Lock className="size-3.5" aria-hidden="true" /> Somente leitura.
              </p>
            )}
          </div>
        </Panel>
      </div>
      <ConfirmDialog
        open={confirm === "save"}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={isNew ? "Criar perfil de acesso?" : "Salvar alterações do perfil?"}
        description="Usuários com este perfil passam a ter as novas permissões imediatamente."
        confirmLabel={isNew ? "Criar perfil" : "Salvar perfil"}
        requireReason
        onConfirm={async (reason) => {
          const values = validate(reason);
          if (!values) throw new Error("invalid");
          try {
            const saved = await save.mutateAsync({ id: isNew ? null : role!.id, values });
            toast.success(isNew ? "Perfil criado." : "Perfil atualizado.");
            if (isNew && saved)
              router.replace(`/administracao/perfis/detalhe/?id=${(saved as { id: string }).id}`);
          } catch (e) {
            toast.error((e as Error).message);
            throw e;
          }
        }}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`Excluir o perfil ${role?.name ?? ""}?`}
        description="O perfil precisa estar sem usuários. A exclusão é lógica e fica registrada na auditoria."
        confirmLabel="Excluir perfil"
        tone="destructive"
        requireReason
        onConfirm={async (reason) => {
          try {
            await remove.mutateAsync({ id: role!.id, reason });
            toast.success("Perfil excluído.");
            router.replace("/administracao/perfis/");
          } catch (e) {
            toast.error((e as Error).message);
            throw e;
          }
        }}
      />
    </>
  );
}
