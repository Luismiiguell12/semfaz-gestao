/**
 * Datas do calendário no fuso de Maceió. As datas "de calendário" circulam como
 * texto AAAA-MM-DD e a aritmética é feita em UTC para não sofrer com o fuso do
 * navegador. America/Maceio não adota horário de verão desde 2019: o
 * deslocamento é fixo em -03:00 (usado para gravar horários informados).
 */
export const TZ = "America/Maceio";
export const MACEIO_OFFSET = "-03:00";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Instante → data e hora em Maceió. */
export function maceioParts(iso: string | Date): { date: string; time: string } {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Data e hora informadas (Maceió) → instante ISO. */
export function fromMaceio(date: string, time = "00:00"): string {
  return `${date}T${time}:00${MACEIO_OFFSET}`;
}

export function todayMaceio(): string {
  return maceioParts(new Date()).date;
}

function toUtc(d: string): Date {
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, day));
}
function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

export function addMonths(date: string, n: number): string {
  const d = toUtc(date);
  return fromUtc(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)));
}

/** Domingo da semana da data (padrão brasileiro de calendário). */
export function startOfWeek(date: string): string {
  return addDays(date, -toUtc(date).getUTCDay());
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** Semanas (domingo a sábado) que cobrem o mês da data. */
export function monthGrid(date: string): string[][] {
  const first = startOfMonth(date);
  const month = first.slice(0, 7);
  let cur = startOfWeek(first);
  const weeks: string[][] = [];
  do {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cur, i)));
    cur = addDays(cur, 7);
  } while (cur.slice(0, 7) === month);
  return weeks;
}

export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const WEEKDAYS_LONG = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function weekday(date: string): number {
  return toUtc(date).getUTCDay();
}

export function formatMonthTitle(date: string): string {
  const [y, m] = date.split("-");
  return `${MONTHS[Number(m) - 1]} de ${y}`;
}

export function formatDayTitle(date: string): string {
  const [y, m, d] = date.split("-");
  return `${WEEKDAYS_LONG[weekday(date)]}, ${Number(d)} de ${MONTHS[Number(m) - 1]} de ${y}`;
}

export function formatShort(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}
