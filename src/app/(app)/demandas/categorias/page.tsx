"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { ErrorState, LoadingRows } from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/providers/auth-provider";
import { useAddCategory, useTaskCategories, useToggleCategory } from "@/modules/tasks/api";

function CategoriesContent() {
  const { access } = useAuth();
  const q = useTaskCategories();
  const add = useAddCategory();
  const toggle = useToggleCategory();
  const [name, setName] = React.useState("");
  return (
    <>
      <Button asChild variant="link" size="sm" className="mb-3">
        <Link href="/demandas/">
          <ArrowLeft aria-hidden="true" /> Demandas
        </Link>
      </Button>
      <PageHeader
        title="Categorias de demandas"
        description="As categorias não são apagadas; desative as que não devem mais ser usadas em novas demandas."
      />
      <Panel>
        {q.isLoading && <LoadingRows />}
        {q.isError && <ErrorState message={q.error.message} onRetry={() => q.refetch()} />}
        {q.data && (
          <ul className="mb-4 divide-y rounded-md border">
            {q.data.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className={c.is_active ? "" : "text-muted-foreground line-through"}>
                  {c.name} {c.is_system && <Badge tone="neutral">Inicial</Badge>}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    toggle.mutate(
                      { id: c.id, active: !c.is_active },
                      { onError: (e) => toast.error(e.message) },
                    )
                  }
                >
                  {c.is_active ? "Desativar" : "Reativar"}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length < 2) return toast.error("Informe um nome com pelo menos 2 caracteres.");
            add.mutate(
              { name, organizationId: access!.profile!.organization_id },
              {
                onSuccess: () => {
                  setName("");
                  toast.success("Categoria adicionada.");
                },
                onError: (err) => toast.error(err.message),
              },
            );
          }}
        >
          <label htmlFor="cat-new" className="sr-only">
            Nova categoria
          </label>
          <Input
            id="cat-new"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nova categoria"
            maxLength={80}
          />
          <Button type="submit" variant="outline" loading={add.isPending}>
            Adicionar
          </Button>
        </form>
      </Panel>
    </>
  );
}

export default function CategoriesPage() {
  return (
    <RequirePermission permission="tasks.categories.manage">
      <CategoriesContent />
    </RequirePermission>
  );
}
