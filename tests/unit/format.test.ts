import { describe, expect, it } from "vitest";
import {
  formatCalendarDate,
  formatCurrency,
  formatDateTime,
  formatInstantDate,
  initials,
} from "@/lib/format";

describe("formatação pt-BR", () => {
  it("exibe instantes UTC no fuso de Maceió (UTC−3)", () => {
    expect(formatDateTime("2026-01-01T02:30:00Z")).toBe("31/12/2025, 23:30");
    expect(formatInstantDate("2026-01-01T02:30:00Z")).toBe("31/12/2025");
  });

  it("não converte fuso de datas de calendário", () => {
    expect(formatCalendarDate("2026-03-01")).toBe("01/03/2026");
    expect(formatCalendarDate("data inválida")).toBe("—");
    expect(formatCalendarDate(null)).toBe("—");
  });

  it("formata valores monetários do banco (string numeric) sem cálculo", () => {
    expect(formatCurrency("1234.56").replace(/\s/g, " ")).toBe("R$ 1.234,56");
    expect(formatCurrency("0.10").replace(/\s/g, " ")).toBe("R$ 0,10");
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency("abc")).toBe("—");
  });

  it("gera iniciais", () => {
    expect(initials("Maria da Silva Souza")).toBe("MS");
    expect(initials("Ana")).toBe("A");
  });
});
