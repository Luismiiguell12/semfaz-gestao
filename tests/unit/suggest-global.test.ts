import { describe, expect, it } from "vitest";
import { describeTerm, suggestGlobalValue } from "@/modules/contracts/suggest";

describe("suggestGlobalValue", () => {
  it("vigência de 12 meses completos", () => {
    expect(suggestGlobalValue(1000, "2026-01-10", "2027-01-09")).toEqual({
      cents: 1_200_000,
      months: 12,
      days: 0,
    });
  });
  it("ano civil", () => {
    expect(suggestGlobalValue(1500.5, "2026-01-01", "2026-12-31")).toEqual({
      cents: 1_800_600,
      months: 12,
      days: 0,
    });
  });
  it("dias restantes proporcionais ao mês (centavos arredondados)", () => {
    // 2 meses (01/01 a 28/02) + 15 dias de março (31 dias): 1000/31*15 = 483,87
    expect(suggestGlobalValue(1000, "2026-01-01", "2026-03-15")).toEqual({
      cents: 248_387,
      months: 2,
      days: 15,
    });
  });
  it("início no fim do mês", () => {
    expect(suggestGlobalValue(100, "2026-01-31", "2026-02-27")).toEqual({
      cents: 100_00,
      months: 1,
      days: 0,
    });
  });
  it("datas inválidas ou valor ausente: sem sugestão", () => {
    expect(suggestGlobalValue(null, "2026-01-01", "2026-12-31")).toBeNull();
    expect(suggestGlobalValue(1000, "2026-12-31", "2026-01-01")).toBeNull();
    expect(suggestGlobalValue(1000, "", "2026-01-01")).toBeNull();
  });
  it("descrição do prazo", () => {
    expect(describeTerm(12, 0)).toBe("12 meses");
    expect(describeTerm(1, 1)).toBe("1 mês e 1 dia");
  });
});
