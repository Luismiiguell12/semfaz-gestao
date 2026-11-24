"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { USER_STATUS_LABEL, type UserStatus } from "./api";
import type { DepartmentNode } from "@/modules/departments/api";

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const tone = status === "active" ? "success" : status === "blocked" ? "danger" : "warning";
  return <Badge tone={tone}>{USER_STATUS_LABEL[status]}</Badge>;
}

/** Seleção de perfis de acesso (checkboxes). */
export function RolePicker({
  roles,
  value,
  onChange,
  idPrefix,
  disabledCodes = [],
}: {
  roles: { id: string; code: string; name: string; description: string | null }[];
  value: string[];
  onChange: (v: string[]) => void;
  idPrefix: string;
  disabledCodes?: string[];
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">
        Perfis de acesso{" "}
        <span className="text-danger" aria-hidden="true">
          *
        </span>
      </legend>
      {roles.map((r) => {
        const id = `${idPrefix}-role-${r.id}`;
        const checked = value.includes(r.id);
        return (
          <div key={r.id} className="flex items-start gap-2.5">
            <Checkbox
              id={id}
              checked={checked}
              disabled={disabledCodes.includes(r.code)}
              onCheckedChange={(v) => onChange(v ? [...value, r.id] : value.filter((x) => x !== r.id))}
              className="mt-0.5"
            />
            <label htmlFor={id} className="cursor-pointer text-sm">
              <span className="font-medium">{r.name}</span>
              {r.description && <span className="text-muted-foreground block text-xs">{r.description}</span>}
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}

/** Seleção de departamentos do escopo (concede a subárvore). */
export function ScopePicker({
  departments,
  value,
  onChange,
  idPrefix,
}: {
  departments: DepartmentNode[];
  value: string[];
  onChange: (v: string[]) => void;
  idPrefix: string;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">Escopo por departamento</legend>
      <p className="text-muted-foreground mb-2 text-xs">
        Cada departamento selecionado inclui suas diretorias e unidades.
      </p>
      <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-md border p-3">
        {departments.map((d) => {
          const id = `${idPrefix}-dep-${d.id}`;
          return (
            <div
              key={d.id}
              className="flex items-center gap-2.5"
              style={{ paddingLeft: `${d.depth * 1.25}rem` }}
            >
              <Checkbox
                id={id}
                checked={value.includes(d.id)}
                onCheckedChange={(v) => onChange(v ? [...value, d.id] : value.filter((x) => x !== d.id))}
              />
              <label htmlFor={id} className="cursor-pointer text-sm">
                {d.name}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
