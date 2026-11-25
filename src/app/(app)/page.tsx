"use client";

import Link from "next/link";
import {
  Bell,
  Building2,
  FileSignature,
  Home,
  Network,
  ShieldAlert,
  Stamp,
  Users,
  Wallet,
  AlertTriangle,
  Banknote,
  Receipt,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useContractStats, useFoundationStats } from "@/modules/dashboard/api";
import { useFinanceStats } from "@/modules/finance/api";
import { MonthlySpendChart, PropertySpendChart } from "@/modules/finance/charts";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { EmptyState, ErrorState, InlineAlert } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatInteger } from "@/lib/format";

function Indicator({
  label,
  value,
  detail,
  href,
  icon: Icon,
}: {
  label: string;
  value: number | string | undefined;
  detail?: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const body = (
    <div className="bg-surface-raised hover:border-primary/40 flex h-full flex-col justify-between gap-4 rounded-lg border p-5 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        <Icon className="text-brand/70 size-4" aria-hidden="true" />
      </div>
      <div>
        {value === undefined ? (
          <Skeleton className="h-9 w-16" />
        ) : (
          <p className="tabular text-brand text-[2rem] leading-none font-bold">
            {typeof value === "number" ? formatInteger(value) : value}
          </p>
        )}
        {detail && <p className="text-muted-foreground mt-2 text-xs">{detail}</p>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="focus-visible:outline-ring block rounded-lg focus-visible:outline-2">
      {body}
    </Link>
  ) : (
    body
  );
}

const UPCOMING = [
  {
    phase: "Fase 4",
    title: "Demandas e calendário",
    text: "Demandas abertas, em andamento, concluídas, atrasadas e próximos compromissos.",
  },
  {
    phase: "Fase 5",
    title: "Produtividade",
    text: "Indicadores individuais e da equipe (sem pontuação nesta versão).",
  },
];

export default function DashboardPage() {
  const { access, can } = useAuth();
  const stats = useFoundationStats();
  const cs = useContractStats();
  const fs = useFinanceStats(12);
  const f = fs.data;
  const c = cs.data;
  const firstName = access?.profile?.full_name.split(" ")[0] ?? "";
  const d = stats.data;
  const departmentsTotal = d
    ? d.departments.secretariats + d.departments.directorates + d.departments.units
    : undefined;

  return (
    <>
      <PageHeader
        title={`Olá, ${firstName}`}
        description={`${access?.organization?.name ?? ""}${access?.department ? `, ${access.department.name}` : ""}`}
      />

      {d?.users && d.users.active_admins < 2 && (
        <InlineAlert tone="warning" className="mb-4" title="Apenas um administrador ativo">
          As solicitações feitas pelo próprio administrador precisam de outro administrador para serem
          aprovadas. Cadastre um segundo administrador em{" "}
          <Link href="/administracao/usuarios/" className="font-semibold underline">
            Usuários
          </Link>
          .
        </InlineAlert>
      )}
      {d?.users && d.users.admins_without_mfa > 0 && (
        <InlineAlert tone="warning" className="mb-4" title="Administrador sem verificação em duas etapas">
          {d.users.admins_without_mfa === 1
            ? "Um administrador ainda não cadastrou"
            : `${d.users.admins_without_mfa} administradores ainda não cadastraram`}{" "}
          o MFA. As operações administrativas ficam bloqueadas para eles até o cadastro.
        </InlineAlert>
      )}

      {stats.isError ? (
        <Panel>
          <ErrorState message={stats.error.message} onRetry={() => stats.refetch()} />
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Indicator
            label="Notificações não lidas"
            value={d?.unread_notifications}
            href="/notificacoes/"
            icon={Bell}
          />
          <Indicator
            label="Departamentos ativos"
            value={departmentsTotal}
            detail={
              d
                ? `${d.departments.secretariats} secretarias, ${d.departments.directorates} diretorias, ${d.departments.units} unidades`
                : undefined
            }
            href={can("departments.manage") ? "/administracao/departamentos/" : undefined}
            icon={Network}
          />
          {can("users.manage") && (
            <>
              <Indicator
                label="Usuários ativos"
                value={d?.users?.active}
                detail={d?.users ? `${d.users.inactive} inativos, ${d.users.blocked} bloqueados` : undefined}
                href="/administracao/usuarios/"
                icon={Users}
              />
              <Indicator label="Administradores ativos" value={d?.users?.active_admins} icon={ShieldAlert} />
            </>
          )}
        </div>
      )}

      {c && (c.can_view_properties || c.can_view_contracts || c.approvals_pending > 0) && (
        <section aria-label="Imóveis, contratos e aprovações" className="mt-6">
          <h2 className="text-brand mb-3 text-base font-semibold">Imóveis, contratos e aprovações</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {c.can_view_properties && (
              <Indicator
                label="Imóveis"
                value={c.properties_total}
                detail={`${c.properties_active} ativos`}
                href="/imoveis/"
                icon={Home}
              />
            )}
            {c.can_view_contracts && (
              <>
                <Indicator
                  label="Contratos vigentes"
                  value={c.contracts_active}
                  detail={`${c.contracts_expiring} próximos do vencimento, ${c.contracts_expired} vencidos`}
                  href="/contratos/"
                  icon={FileSignature}
                />
                <Indicator
                  label="Valor mensal de locações"
                  value={formatCurrency(c.monthly_rent_total)}
                  detail="Soma dos contratos vigentes"
                  href="/contratos/"
                  icon={Wallet}
                />
              </>
            )}
            <Indicator
              label={c.can_review ? "Aprovações pendentes" : "Minhas solicitações pendentes"}
              value={c.approvals_pending}
              href="/aprovacoes/"
              icon={Stamp}
            />
          </div>
          {c.can_view_contracts && c.contracts_active + c.contracts_expired === 0 && (
            <p className="text-muted-foreground mt-3 text-sm">
              Ainda não há contratos aprovados no seu escopo.
            </p>
          )}
        </section>
      )}

      {f?.can_view && (
        <section aria-label="Financeiro" className="mt-6">
          <h2 className="text-brand mb-3 text-base font-semibold">Financeiro</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Indicator
              label="Faturas pendentes"
              value={f.invoices_pending}
              href="/financeiro/faturas/"
              icon={Receipt}
            />
            <Indicator
              label="Faturas vencidas"
              value={f.invoices_overdue}
              href="/financeiro/faturas/"
              icon={AlertTriangle}
            />
            <Indicator
              label="Saldo de faturas em aberto"
              value={formatCurrency(f.invoices_open_amount)}
              href="/financeiro/faturas/"
              icon={Wallet}
            />
            <Indicator
              label="Saldo de aluguéis em aberto"
              value={formatCurrency(f.rents_open_amount)}
              detail={`${f.rents_overdue} vencidos`}
              href="/financeiro/alugueis/"
              icon={Banknote}
            />
          </div>
          <div className="mt-6 mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-foreground text-sm font-semibold">Gastos mensais nos últimos 12 meses</h3>
            {can("finance.reports.view") && (
              <Link
                href="/financeiro/relatorios/"
                className="text-primary text-sm font-semibold hover:underline"
              >
                Ver relatórios de despesas
              </Link>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <MonthlySpendChart title="Aluguel" data={f.series} field="rent" />
            <MonthlySpendChart title="Água" data={f.series} field="water" />
            <MonthlySpendChart title="Energia" data={f.series} field="energy" />
          </div>
          {f.by_property.length > 0 && (
            <div className="mt-4">
              <PropertySpendChart data={f.by_property} />
            </div>
          )}
        </section>
      )}

      <Panel
        className="mt-6"
        title="Próximos módulos"
        description="Os indicadores aparecem aqui à medida que cada módulo for liberado."
      >
        <EmptyState
          icon={Building2}
          title="Ainda não há indicadores de demandas ou produtividade"
          description="Nenhum número é exibido antes de existirem registros reais no sistema."
          className="py-6"
        />
        <ol className="mt-2 grid gap-3 md:grid-cols-2">
          {UPCOMING.map((u) => (
            <li key={u.phase} className="bg-surface rounded-md border border-dashed px-4 py-3">
              <p className="text-primary-hover text-xs font-semibold">{u.phase}</p>
              <p className="text-foreground mt-0.5 font-semibold">{u.title}</p>
              <p className="text-muted-foreground mt-1 text-sm">{u.text}</p>
            </li>
          ))}
        </ol>
      </Panel>
    </>
  );
}
