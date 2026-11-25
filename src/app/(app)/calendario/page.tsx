"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { ErrorState, FullPageLoading, LoadingRows } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { FilterTab, FilterTabs, FilterTabsList } from "@/components/ui/filter-tabs";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import {
  EVENT_KIND_LABEL,
  TASK_STATUS_LABEL,
  useCalendarItems,
  type CalendarItem,
} from "@/modules/tasks/api";
import {
  WEEKDAYS,
  addDays,
  addMonths,
  formatDayTitle,
  formatMonthTitle,
  formatShort,
  maceioParts,
  monthGrid,
  startOfWeek,
  todayMaceio,
} from "@/modules/tasks/dates";
import { EventDialog } from "@/modules/tasks/event-dialog";

type View = "mes" | "semana" | "dia";

/** Item do calendário: demanda (pelo prazo) ou evento. */
function Item({
  item,
  onOpenEvent,
  compact,
}: {
  item: CalendarItem;
  onOpenEvent: (id: string) => void;
  compact?: boolean;
}) {
  const time = item.all_day ? null : maceioParts(item.starts_at).time;
  const label =
    item.item_type === "task"
      ? `Prazo: ${item.title}`
      : `${item.event_kind ? EVENT_KIND_LABEL[item.event_kind] : "Evento"}: ${item.title}`;
  const cls = cn(
    "block w-full truncate rounded px-1.5 py-0.5 text-left text-xs",
    item.item_type === "task"
      ? item.is_overdue
        ? "bg-danger-soft text-danger"
        : item.task_status === "done"
          ? "bg-success-soft text-success line-through"
          : "bg-warning-soft text-warning"
      : "bg-primary-soft text-primary-hover",
  );
  const text = (
    <>
      {time && <span className="tabular font-semibold">{time} </span>}
      {compact ? item.title : label}
      {item.item_type === "task" && item.is_overdue && <span className="sr-only"> (atrasada)</span>}
      {item.item_type === "task" && item.task_status && !compact && (
        <span> · {TASK_STATUS_LABEL[item.task_status]}</span>
      )}
    </>
  );
  return item.item_type === "task" ? (
    <Link href={`/demandas/detalhe/?id=${item.task_id}`} className={cls} title={label}>
      {text}
    </Link>
  ) : (
    <button type="button" className={cls} title={label} onClick={() => onOpenEvent(item.id)}>
      {text}
    </button>
  );
}

function CalendarContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const { can } = useAuth();
  const today = todayMaceio();
  const view: View = (["mes", "semana", "dia"] as const).find((v) => v === sp.get("visao")) ?? "mes";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("data") ?? "") ? sp.get("data")! : today;
  const [dialog, setDialog] = React.useState<{ eventId: string | null; date?: string } | null>(null);

  const weeks = view === "mes" ? monthGrid(date) : [];
  const from = view === "mes" ? weeks[0]![0]! : view === "semana" ? startOfWeek(date) : date;
  const to = view === "mes" ? weeks.at(-1)![6]! : view === "semana" ? addDays(startOfWeek(date), 6) : date;
  const q = useCalendarItems(from, to);
  const byDay = React.useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const i of q.data ?? []) {
      const d = maceioParts(i.starts_at).date;
      m.set(d, [...(m.get(d) ?? []), i]);
    }
    return m;
  }, [q.data]);

  const go = (v: View, d: string) => router.replace(`/calendario/?visao=${v}&data=${d}`);
  const step = (dir: number) =>
    go(view, view === "mes" ? addMonths(date, dir) : addDays(date, view === "semana" ? 7 * dir : dir));
  const title =
    view === "mes"
      ? formatMonthTitle(date)
      : view === "semana"
        ? `Semana de ${formatShort(from)} a ${formatShort(to)}`
        : formatDayTitle(date);
  const openEvent = (id: string) => setDialog({ eventId: id });
  const days = view === "semana" ? Array.from({ length: 7 }, (_, i) => addDays(from, i)) : [date];

  return (
    <>
      <PageHeader
        title="Calendário"
        description="Prazos de demandas, reuniões, compromissos e lembretes. Horários de Maceió."
        actions={
          can("tasks.create") && (
            <Button onClick={() => setDialog({ eventId: null, date: view === "mes" ? today : date })}>
              <CalendarPlus aria-hidden="true" /> Novo evento
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => step(-1)} aria-label="Período anterior">
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => go(view, today)}>
            Hoje
          </Button>
          <Button variant="outline" size="sm" onClick={() => step(1)} aria-label="Próximo período">
            <ChevronRight aria-hidden="true" />
          </Button>
          <h2
            className="text-foreground ml-2 text-base font-semibold first-letter:uppercase"
            aria-live="polite"
          >
            {title}
          </h2>
        </div>
        <FilterTabs value={view} onValueChange={(v) => go(v as View, date)}>
          <FilterTabsList aria-label="Visualização do calendário">
            <FilterTab value="mes">Mês</FilterTab>
            <FilterTab value="semana">Semana</FilterTab>
            <FilterTab value="dia">Dia</FilterTab>
          </FilterTabsList>
        </FilterTabs>
      </div>
      <div className="text-muted-foreground mb-3 flex flex-wrap gap-3 text-xs" aria-label="Legenda">
        <span className="bg-primary-soft text-primary-hover rounded px-1.5 py-0.5">Evento</span>
        <span className="bg-warning-soft text-warning rounded px-1.5 py-0.5">Prazo de demanda</span>
        <span className="bg-danger-soft text-danger rounded px-1.5 py-0.5">Demanda atrasada</span>
        <span className="bg-success-soft text-success rounded px-1.5 py-0.5 line-through">Concluída</span>
      </div>

      {q.isError && <ErrorState message={q.error.message} onRetry={() => q.refetch()} />}
      {q.isLoading && <LoadingRows />}
      {q.data && view === "mes" && (
        <Panel bodyClassName="p-0">
          {/* Mês: grade no computador e tablet; lista por dia no celular. */}
          <table className="hidden w-full table-fixed border-collapse sm:table">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                {WEEKDAYS.map((w) => (
                  <th
                    key={w}
                    scope="col"
                    className="text-muted-foreground border-b py-2 text-xs font-semibold"
                  >
                    {w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w[0]}>
                  {w.map((d) => {
                    const items = byDay.get(d) ?? [];
                    const outside = d.slice(0, 7) !== date.slice(0, 7);
                    return (
                      <td
                        key={d}
                        className={cn(
                          "h-28 border-b border-l align-top first:border-l-0",
                          outside && "bg-surface",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => go("dia", d)}
                          className={cn(
                            "m-1 flex size-7 items-center justify-center rounded-full text-xs hover:underline",
                            d === today
                              ? "bg-primary text-primary-foreground font-bold"
                              : outside
                                ? "text-muted-foreground"
                                : "",
                          )}
                          aria-label={`Ver o dia ${formatDayTitle(d)}`}
                        >
                          {Number(d.slice(8))}
                        </button>
                        <div className="space-y-0.5 px-1 pb-1">
                          {items.slice(0, 3).map((i) => (
                            <Item key={`${i.item_type}-${i.id}`} item={i} onOpenEvent={openEvent} compact />
                          ))}
                          {items.length > 3 && (
                            <button
                              type="button"
                              className="text-primary px-1.5 text-xs hover:underline"
                              onClick={() => go("dia", d)}
                            >
                              +{items.length - 3} itens
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y sm:hidden">
            {weeks
              .flat()
              .filter((d) => d.slice(0, 7) === date.slice(0, 7) && (byDay.get(d)?.length || d === today))
              .map((d) => (
                <li key={d} className="px-4 py-3">
                  <button
                    type="button"
                    className="text-sm font-semibold hover:underline"
                    onClick={() => go("dia", d)}
                  >
                    {formatDayTitle(d)}
                    {d === today ? " (hoje)" : ""}
                  </button>
                  <div className="mt-1.5 space-y-1">
                    {(byDay.get(d) ?? []).map((i) => (
                      <Item key={`${i.item_type}-${i.id}`} item={i} onOpenEvent={openEvent} />
                    ))}
                    {(byDay.get(d) ?? []).length === 0 && (
                      <p className="text-muted-foreground text-xs">Nada agendado.</p>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        </Panel>
      )}
      {q.data && view !== "mes" && (
        <div className={cn("grid grid-cols-1 gap-3", view === "semana" && "md:grid-cols-7")}>
          {days.map((d) => {
            const items = byDay.get(d) ?? [];
            return (
              <section
                key={d}
                aria-label={formatDayTitle(d)}
                className={cn("bg-surface-raised min-w-0 rounded-lg border", d === today && "border-primary")}
              >
                <header className="border-b px-3 py-2">
                  <button
                    type="button"
                    className="text-left text-sm font-semibold first-letter:uppercase hover:underline"
                    onClick={() => go("dia", d)}
                  >
                    {view === "semana" ? `${WEEKDAYS[days.indexOf(d)]} ${formatShort(d)}` : formatDayTitle(d)}
                  </button>
                </header>
                <div className="space-y-1.5 p-2">
                  {items.map((i) => (
                    <Item
                      key={`${i.item_type}-${i.id}`}
                      item={i}
                      onOpenEvent={openEvent}
                      compact={view === "semana"}
                    />
                  ))}
                  {items.length === 0 && (
                    <p className="text-muted-foreground px-1 py-2 text-xs">Nada agendado.</p>
                  )}
                  {view === "dia" && can("tasks.create") && (
                    <Button variant="ghost" size="sm" onClick={() => setDialog({ eventId: null, date: d })}>
                      <CalendarPlus aria-hidden="true" /> Agendar neste dia
                    </Button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {dialog && (
        <EventDialog
          eventId={dialog.eventId}
          defaultDate={dialog.date}
          open
          onOpenChange={(v) => !v && setDialog(null)}
        />
      )}
    </>
  );
}

export default function CalendarPage() {
  return (
    <React.Suspense fallback={<FullPageLoading />}>
      <CalendarContent />
    </React.Suspense>
  );
}
