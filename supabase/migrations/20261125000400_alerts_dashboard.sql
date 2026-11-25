-- =============================================================================
-- SEMFAZ Gestão — Fase 2D
-- Regras de alerta configuráveis, alertas gerados (sem duplicidade), rotina
-- diária (pg_cron) e indicadores do painel para imóveis, contratos e aprovações.
-- =============================================================================

create extension if not exists pg_cron;

create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  -- contract_expiring: N dias antes do fim da vigência efetiva
  -- contract_expired: contrato vencido (days_before = 0)
  -- contract_adjustment: N dias antes do aniversário da data-base
  code text not null check (code in ('contract_expiring', 'contract_expired', 'contract_adjustment')),
  days_before integer not null check (days_before between 0 and 365),
  is_active boolean not null default true,
  description text not null check (length(btrim(description)) between 5 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  constraint alert_rules_unique unique (organization_id, code, days_before)
);
create trigger alert_rules_actor before insert or update on public.alert_rules
  for each row execute function private.tg_set_actor_columns();
create trigger alert_rules_audit after insert or update or delete on public.alert_rules
  for each row execute function private.tg_audit('settings');
create trigger alert_rules_no_delete before delete on public.alert_rules
  for each row execute function private.tg_prevent_physical_delete();

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  rule_id uuid not null references public.alert_rules (id),
  entity_type text not null check (entity_type in ('contract')),
  entity_id uuid not null,
  -- Data do marco (fim da vigência ou aniversário da data-base).
  milestone_date date not null,
  title text not null,
  created_at timestamptz not null default now(),
  -- Impede alerta duplicado para o mesmo registro, regra e marco.
  constraint alerts_unique unique (rule_id, entity_id, milestone_date)
);
create index alerts_entity_idx on public.alerts (entity_type, entity_id, created_at desc);
create trigger alerts_immutable before update or delete on public.alerts
  for each row execute function private.tg_immutable_row();

alter table public.alert_rules enable row level security;
alter table public.alerts enable row level security;
revoke all on public.alert_rules, public.alerts from anon;

create policy alert_rules_select on public.alert_rules
  for select to authenticated using (organization_id = private.current_org_id());
create policy alert_rules_update on public.alert_rules
  for update to authenticated
  using (organization_id = private.current_org_id() and private.has_permission('settings.manage'))
  with check (organization_id = private.current_org_id() and private.has_permission('settings.manage'));
create policy alerts_select on public.alerts
  for select to authenticated
  using (exists (select 1 from public.contracts c where c.id = alerts.entity_id));

-- -----------------------------------------------------------------------------
-- Geração diária
-- -----------------------------------------------------------------------------
create or replace function private.contract_alert_recipients(p_contract public.contracts)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct u from (
    select p_contract.manager_id as u
    union select p_contract.inspector_id
    union select r from private.approval_reviewers(p_contract.organization_id, '00000000-0000-0000-0000-000000000000') r
  ) s
  join public.profiles p on p.id = s.u and p.status = 'active' and p.deleted_at is null
  where u is not null;
$$;

-- Gera os alertas de contratos para a data de referência (padrão: hoje em
-- America/Maceio). Idempotente: alertas já gerados não se repetem.
create or replace function private.generate_contract_alerts(p_reference date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref date := coalesce(p_reference, private.today_local());
  v_c public.contracts;
  v_end date;
  v_anniv date;
  v_rule public.alert_rules;
  v_inserted integer := 0;
  v_notified boolean;
  v_title text;
  v_id uuid;
  v_user uuid;
  v_type text;
begin
  for v_c in
    select * from public.contracts c
    where c.deleted_at is null and c.admin_status = 'active' and c.start_date <= v_ref
  loop
    v_end := private.contract_effective_end(v_c.id);
    v_anniv := private.next_anniversary(v_c.base_date, v_ref);
    v_notified := false;

    -- Regras em ordem de urgência: vencido, depois o menor prazo.
    for v_rule in
      select * from public.alert_rules r
      where r.organization_id = v_c.organization_id and r.is_active
      order by case r.code when 'contract_expired' then 0 when 'contract_expiring' then 1 else 2 end, r.days_before
    loop
      v_id := null;
      if v_rule.code = 'contract_expired' and v_ref > v_end then
        v_title := format('Contrato %s vencido em %s', v_c.contract_number, to_char(v_end, 'DD/MM/YYYY'));
        v_type := 'contract_expiring';
        insert into public.alerts (organization_id, rule_id, entity_type, entity_id, milestone_date, title)
        values (v_c.organization_id, v_rule.id, 'contract', v_c.id, v_end, v_title)
        on conflict on constraint alerts_unique do nothing returning id into v_id;
      elsif v_rule.code = 'contract_expiring' and v_ref <= v_end and v_end - v_ref <= v_rule.days_before then
        v_title := format('Contrato %s vence em %s (%s dias)', v_c.contract_number, to_char(v_end, 'DD/MM/YYYY'), v_end - v_ref);
        v_type := 'contract_expiring';
        insert into public.alerts (organization_id, rule_id, entity_type, entity_id, milestone_date, title)
        values (v_c.organization_id, v_rule.id, 'contract', v_c.id, v_end, v_title)
        on conflict on constraint alerts_unique do nothing returning id into v_id;
      elsif v_rule.code = 'contract_adjustment' and v_anniv is not null and v_anniv <= v_end
            and v_anniv - v_ref <= v_rule.days_before then
        v_title := format('Data-base do contrato %s em %s: verificar reajuste', v_c.contract_number, to_char(v_anniv, 'DD/MM/YYYY'));
        v_type := 'contract_adjustment';
        insert into public.alerts (organization_id, rule_id, entity_type, entity_id, milestone_date, title)
        values (v_c.organization_id, v_rule.id, 'contract', v_c.id, v_anniv, v_title)
        on conflict on constraint alerts_unique do nothing returning id into v_id;
      end if;

      if v_id is not null then
        v_inserted := v_inserted + 1;
        -- Uma notificação por contrato e execução (o marco mais urgente); os
        -- demais marcos alcançados ficam registrados sem notificar de novo.
        if not v_notified or v_type = 'contract_adjustment' then
          for v_user in select * from private.contract_alert_recipients(v_c) loop
            perform private.notify(v_user, v_type, v_title, null,
              format('/contratos/detalhe/?id=%s', v_c.id), 'contracts', v_c.id);
          end loop;
          if v_type = 'contract_expiring' then
            v_notified := true;
          end if;
        end if;
      end if;
    end loop;
  end loop;

  if v_inserted > 0 then
    perform private.log_event('ALERTS_GENERATED', 'contracts', 'alerts', null, null, null,
      (select id from public.organizations order by created_at limit 1), null,
      jsonb_build_object('reference_date', v_ref, 'alerts', v_inserted));
  end if;
  return v_inserted;
end;
$$;

-- Rotina diária às 06:00 de Maceió (09:00 UTC), independente de acesso ao sistema.
select cron.schedule('semfaz-contract-alerts', '0 9 * * *', 'select private.generate_contract_alerts()');

-- -----------------------------------------------------------------------------
-- Indicadores do painel (executa com as permissões do usuário: RLS aplicada)
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_contract_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'properties_total', (select count(*) from public.properties),
    'properties_active', (select count(*) from public.properties where status = 'active'),
    'contracts_active', (select count(*) from public.contracts_overview where validity_status in ('active', 'expiring')),
    'contracts_expiring', (select count(*) from public.contracts_overview where validity_status = 'expiring'),
    'contracts_expired', (select count(*) from public.contracts_overview where validity_status = 'expired'),
    'monthly_rent_total', (select coalesce(sum(effective_monthly_value), 0)::numeric(14, 2)
                            from public.contracts_overview where validity_status in ('active', 'expiring')),
    'approvals_pending', (select count(*) from public.approval_requests where status = 'pending'),
    'can_view_properties', private.has_permission('properties.view'),
    'can_view_contracts', private.has_permission('contracts.view'),
    'can_review', private.has_permission('approvals.review')
  );
$$;
revoke execute on function public.dashboard_contract_stats() from public, anon;
grant execute on function public.dashboard_contract_stats() to authenticated;
grant execute on all functions in schema private to authenticated, service_role;
