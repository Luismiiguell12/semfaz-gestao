import { describe, expect, it } from "vitest";
import { formatCep, formatCpfCnpj, isValidCnpj, isValidCpf, parseBrlInput } from "@shared/schemas/br.ts";
import { landlordSharesSchema } from "@shared/schemas/properties.ts";
import { amendmentCreateSchema } from "@shared/schemas/contracts.ts";

const ID1 = "61000000-0000-4000-8000-000000000001";
const ID2 = "61000000-0000-4000-8000-000000000002";

describe("validadores brasileiros", () => {
  it("CPF e CNPJ pelos dígitos verificadores (mesma regra do banco)", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("123.456.789-00")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
  });

  it("formata CPF/CNPJ e CEP durante a digitação", () => {
    expect(formatCpfCnpj("52998224725")).toBe("529.982.247-25");
    expect(formatCpfCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCep("49400000")).toBe("49400-000");
  });

  it("converte valores em pt-BR sem ponto flutuante", () => {
    expect(parseBrlInput("1.234,56")).toBe("1234.56");
    expect(parseBrlInput("1234,5")).toBe("1234.50");
    expect(parseBrlInput("R$ 0,10")).toBe("0.10");
    expect(parseBrlInput("1000")).toBe("1000.00");
    expect(parseBrlInput("12,345")).toBeNull();
    expect(parseBrlInput("abc")).toBeNull();
    expect(parseBrlInput("-10")).toBeNull();
  });

  it("percentuais de locadores somam 100% (aritmética em centésimos)", () => {
    expect(landlordSharesSchema.safeParse([{ landlord_id: ID1 }]).success).toBe(true);
    expect(
      landlordSharesSchema.safeParse([
        { landlord_id: ID1, share_percent: 33.33 },
        { landlord_id: ID2, share_percent: 66.67 },
      ]).success,
    ).toBe(true);
    expect(
      landlordSharesSchema.safeParse([
        { landlord_id: ID1, share_percent: 60 },
        { landlord_id: ID2, share_percent: 50 },
      ]).success,
    ).toBe(false);
    expect(
      landlordSharesSchema.safeParse([{ landlord_id: ID1, share_percent: 50 }, { landlord_id: ID2 }]).success,
    ).toBe(false);
  });

  it("aditivo exige os campos do seu tipo", () => {
    const base = {
      contract_id: ID1,
      amendment_number: "1",
      signed_on: "2026-01-10",
      description: "Aditivo de teste",
      justification: "Justificativa do aditivo",
    };
    expect(amendmentCreateSchema.safeParse({ ...base, kind: "term" }).success).toBe(false);
    expect(
      amendmentCreateSchema.safeParse({ ...base, kind: "term", new_end_date: "2027-01-10" }).success,
    ).toBe(true);
    expect(
      amendmentCreateSchema.safeParse({ ...base, kind: "value", new_monthly_value: "1.500,00" }).success,
    ).toBe(false);
    expect(
      amendmentCreateSchema.safeParse({
        ...base,
        kind: "value",
        new_monthly_value: "1.500,00",
        value_effective_from: "2026-02-01",
      }).success,
    ).toBe(true);
  });
});
