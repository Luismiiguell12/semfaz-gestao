// Formatação pt-BR. Instantes (timestamptz, UTC) são exibidos em America/Maceio.
// Datas de calendário (tipo date, "AAAA-MM-DD") são exibidas sem conversão de fuso.
export const DISPLAY_TIMEZONE = "America/Maceio";

const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: DISPLAY_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: DISPLAY_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const relativeFmt = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const currencyFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const integerFmt = new Intl.NumberFormat("pt-BR");

/** "2026-11-24T23:00:00Z" → "24/11/2026, 20:00" (horário de Maceió). */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return dateTimeFmt.format(typeof value === "string" ? new Date(value) : value);
}

/** Instante → data no fuso de exibição. */
export function formatInstantDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return dateFmt.format(typeof value === "string" ? new Date(value) : value);
}

/** Data de calendário "AAAA-MM-DD" → "DD/MM/AAAA" (sem conversão de fuso). */
export function formatCalendarDate(value: string | null | undefined): string {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Valor monetário vindo do banco (numeric(14,2), recebido como string ou número)
 * → "R$ 1.234,56". Nenhum cálculo financeiro é feito no frontend.
 */
export function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return currencyFmt.format(n);
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return integerFmt.format(value);
}

export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const diffSec = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return "agora";
  if (abs < 3600) return relativeFmt.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return relativeFmt.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 7) return relativeFmt.format(Math.round(diffSec / 86400), "day");
  return formatInstantDate(date);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}
