"use client";

import type { FieldErrors, UseFormRegister, UseFormSetValue } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { FormField } from "@/components/shared/form-field";
import { BR_STATES, formatCep } from "@shared/schemas/br.ts";
import type { AddressInput } from "@shared/schemas/properties.ts";

/** Campos de endereço reutilizados no cadastro e na solicitação de alteração. */
export function AddressFields<T extends AddressInput>({
  register,
  errors,
  setValue,
  idPrefix,
}: {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  setValue: UseFormSetValue<T>;
  idPrefix: string;
}) {
  // Os nomes dos campos são os mesmos em todos os formulários que usam este bloco.
  const reg = register as unknown as UseFormRegister<AddressInput>;
  const err = errors as FieldErrors<AddressInput>;
  const set = setValue as unknown as UseFormSetValue<AddressInput>;
  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <FormField
        id={`${idPrefix}-street`}
        label="Logradouro"
        required
        error={err.street?.message}
        className="sm:col-span-4"
      >
        <Input {...reg("street")} autoComplete="off" />
      </FormField>
      <FormField
        id={`${idPrefix}-number`}
        label="Número"
        required
        error={err.address_number?.message}
        className="sm:col-span-2"
        hint="Use S/N se não houver."
      >
        <Input {...reg("address_number")} autoComplete="off" />
      </FormField>
      <FormField
        id={`${idPrefix}-complement`}
        label="Complemento"
        error={err.complement?.message}
        className="sm:col-span-3"
      >
        <Input {...reg("complement")} autoComplete="off" />
      </FormField>
      <FormField
        id={`${idPrefix}-district`}
        label="Bairro"
        required
        error={err.district?.message}
        className="sm:col-span-3"
      >
        <Input {...reg("district")} autoComplete="off" />
      </FormField>
      <FormField
        id={`${idPrefix}-cep`}
        label="CEP"
        required
        error={err.postal_code?.message}
        className="sm:col-span-2"
      >
        <Input
          {...reg("postal_code", { onChange: (e) => set("postal_code", formatCep(e.target.value)) })}
          inputMode="numeric"
          placeholder="00000-000"
          maxLength={9}
        />
      </FormField>
      <FormField
        id={`${idPrefix}-city`}
        label="Município"
        required
        error={err.city?.message}
        className="sm:col-span-3"
      >
        <Input {...reg("city")} autoComplete="off" />
      </FormField>
      <FormField
        id={`${idPrefix}-state`}
        label="UF"
        required
        error={err.state?.message}
        className="sm:col-span-1"
      >
        <NativeSelect {...reg("state")}>
          {BR_STATES.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </NativeSelect>
      </FormField>
    </div>
  );
}
