/**
 * Sugestão de valor global: valor mensal × meses da vigência. Meses completos
 * contam inteiros; dias restantes entram proporcionalmente (valor mensal ÷ dias
 * do mês × dias), a mesma regra usada nos aluguéis. Cálculo em centavos.
 * O usuário sempre confirma ou altera o valor sugerido.
 */
export function suggestGlobalValue(
  monthly: number | null,
  start: string,
  end: string,
): { cents: number; months: number; days: number } | null {
  if (monthly === null || !Number.isFinite(monthly) || monthly <= 0) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) return null;
  const [sy, sm, sd] = start.split("-").map(Number) as [number, number, number];
  const endDate = Date.UTC(
    ...(end.split("-").map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))) as [number, number, number]),
  );
  const addMonths = (n: number) => {
    // Último dia do período de n meses: (início + n meses) − 1 dia, com ajuste de fim de mês.
    const y = sy + Math.floor((sm - 1 + n) / 12);
    const m = (sm - 1 + n) % 12;
    const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return Date.UTC(y, m, Math.min(sd, dim)) - 86_400_000;
  };
  let months = 0;
  while (addMonths(months + 1) <= endDate && months < 1200) months++;
  const periodStart = addMonths(months) + 86_400_000;
  const days = Math.round((endDate - periodStart) / 86_400_000) + 1;
  const monthlyCents = Math.round(monthly * 100);
  let cents = monthlyCents * months;
  if (days > 0) {
    const d = new Date(periodStart);
    const dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    cents += Math.round((monthlyCents * days) / dim);
  }
  return { cents, months, days: Math.max(0, days) };
}

export function describeTerm(months: number, days: number): string {
  const parts = [];
  if (months) parts.push(`${months} ${months === 1 ? "mês" : "meses"}`);
  if (days) parts.push(`${days} ${days === 1 ? "dia" : "dias"}`);
  return parts.join(" e ") || "0 dias";
}
