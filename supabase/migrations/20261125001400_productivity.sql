-- =============================================================================
-- SEMFAZ Gestão — Fase 5: produtividade (SEM pontuação).
-- Métricas de quantidade e prazo, individuais e coletivas, por mês, trimestre,
-- semestre e ano (datas no fuso de Maceió). Pontos, pesos e rankings ficam para
-- a fase de pontuação: aqui não existem productivity_rules, productivity_entries
-- nem performance_reviews.
-- Dados individuais são pessoais: cada pessoa vê os próprios; os da equipe só com
-- productivity.view_team, no escopo de departamentos de quem consulta.
-- =============================================================================

-- Níveis de complexidade (catálogo). Sem pesos nesta versão.
create table public.task_complexity_levels (
  code public.task_complexity primary key,
  label text not null,
  sort_order smallint not null unique,
  description text
);
comment on table public.task_complexity_levels is
  'Níveis de complexidade das demandas. A pontuação por nível será definida em fase futura (sem migração destrutiva).';
insert into public.task_complexity_levels (code, label, sort_order, description) values
  ('simple', 'Simples', 1, 'Rotina, poucas etapas.'),
  ('medium', 'Média', 2, 'Algumas etapas ou dependências.'),
  ('complex', 'Complexa', 3, 'Várias etapas, análise ou articulação com outros setores.'),
  ('very_complex', 'Muito complexa', 4, 'Alto esforço, prazos longos ou impacto amplo.')
on conflict (code) do nothing;
alter table public.task_complexity_levels enable row level security;
revoke all on public.task_complexity_levels from anon;
grant select on public.task_complexity_levels to authenticated;
create policy task_complexity_levels_select on public.task_complexity_levels for select to authenticated using (true);

-- Métricas consolidadas por pessoa e período (registro estável dos períodos fechados).
create table public.productivity_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null,
  period_type text not null check (period_type in ('month', 'quarter', 'semester', 'year')),
  period_start date not null,
  period_end date not null,
  metrics jsonb not null,
  generated_at timestamptz not null default now(),
  constraint productivity_snapshots_unique unique (user_id, period_type, period_start),
  constraint productivity_snapshots_user_fk foreign key (user_id, organization_id) references public.profiles (id, organization_id)
);
create index productivity_snapshots_period_idx on public.productivity_snapshots (organization_id, period_type, period_start);
comment on table public.productivity_snapshots is
  'Métricas de produtividade consolidadas ao fim de cada período (sem pontos). Geradas pela rotina mensal.';
create trigger productivity_snapshots_immutable before update or delete on public.productivity_snapshots
  for each row execute function private.tg_immutable_row();

-- -----------------------------------------------------------------------------
-- Períodos
-- -----------------------------------------------------------------------------
create or replace function private.period_bounds(p_type text, p_ref date)
returns table (period_start date, period_end date)
language sql
immutable
set search_path = ''
as $$
  select s, (s + case p_type when 'month' then interval '1 month' when 'quarter' then interval '3 month'
                              when 'semester' then interval '6 month' else interval '1 year' end - interval '1 day')::date
  from (select case p_type
                 when 'month' then date_trunc('month', p_ref)::date
                 when 'quarter' then date_trunc('quarter', p_ref)::date
                 when 'semester' then make_date(extract(year from p_ref)::int, case when extract(month from p_ref) <= 6 then 1 else 7 end, 1)
                 else date_trunc('year', p_ref)::date
               end as s) x;
$$;

-- -----------------------------------------------------------------------------
-- Métricas de uma pessoa num intervalo (datas de Maceió). Contagens, prazos e
-- tempos; nenhuma pontuação.
--   recebidas      vínculos (responsável ou participante) criados no período
--   concluidas     concluídas no período em que a pessoa participa
--   no_prazo       concluídas até o prazo (data e, se houver, horário)
--   com_prazo      concluídas que tinham prazo
--   pendentes      abertas ao fim do período (nem concluídas nem canceladas até lá)
--   atrasadas      pendentes cujo prazo já passou na data de referência
--   tempo_medio_dias  média entre a criação e a conclusão
--   por_complexidade  concluídas por nível
--   como_responsavel / como_participante  participação nas concluídas e pendentes
-- -----------------------------------------------------------------------------
create or replace function private.productivity_metrics(p_user uuid, p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with ref as (
    select least(p_to, private.today_local()) as ref_date,
           (p_from::timestamp at time zone 'America/Maceio') as t0,
           ((p_to + 1)::timestamp at time zone 'America/Maceio') as t1
  ),
  mine as (
    select t.*, a.role, a.created_at as assigned_at
    from public.task_assignees a
    join public.tasks t on t.id = a.task_id and t.deleted_at is null
    where a.user_id = p_user
  ),
  done as (
    select m.* from mine m, ref where m.status = 'done' and m.completed_at >= ref.t0 and m.completed_at < ref.t1
  ),
  pending as (
    select m.* from mine m, ref
    where m.created_at < ref.t1
      and (m.completed_at is null or m.completed_at >= ref.t1)
      and (m.cancelled_at is null or m.cancelled_at >= ref.t1)
      and not (m.status in ('done', 'cancelled') and coalesce(m.completed_at, m.cancelled_at) is null)
  )
  select jsonb_build_object(
    'recebidas', (select count(*) from mine, ref where mine.assigned_at >= ref.t0 and mine.assigned_at < ref.t1),
    'concluidas', (select count(*) from done),
    'com_prazo', (select count(*) from done where due_date is not null),
    'no_prazo', (select count(*) from done
                 where due_date is not null
                   and (completed_at at time zone 'America/Maceio') <= (due_date + coalesce(due_time, time '23:59:59'))),
    'pendentes', (select count(*) from pending),
    'atrasadas', (select count(*) from pending, ref
                  where pending.due_date is not null
                    and (pending.due_date < ref.ref_date
                         or (ref.ref_date = private.today_local() and pending.due_date = ref.ref_date and pending.due_time is not null
                             and pending.due_time < (now() at time zone 'America/Maceio')::time))),
    'tempo_medio_dias', (select round(avg(extract(epoch from (completed_at - created_at)) / 86400)::numeric, 1) from done),
    'por_complexidade', (select coalesce(jsonb_object_agg(l.code, (select count(*) from done where done.complexity = l.code)), '{}'::jsonb)
                         from public.task_complexity_levels l),
    'como_responsavel', (select count(*) from (select role from done union all select role from pending) x where role = 'responsible'),
    'como_participante', (select count(*) from (select role from done union all select role from pending) x where role = 'participant')
  );
$$;

-- Indicadores derivados (percentuais), calculados a partir das contagens.
create or replace function private.productivity_rates(m jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select m || jsonb_build_object(
    'percentual_conclusao', case when (m->>'concluidas')::int + (m->>'pendentes')::int = 0 then null
                                 else round((m->>'concluidas')::numeric * 100 / ((m->>'concluidas')::int + (m->>'pendentes')::int), 1) end,
    'cumprimento_prazos', case when (m->>'com_prazo')::int = 0 then null
                               else round((m->>'no_prazo')::numeric * 100 / (m->>'com_prazo')::int, 1) end
  );
$$;

-- -----------------------------------------------------------------------------
-- Quem pode ver os indicadores de quem
-- -----------------------------------------------------------------------------
create or replace function private.can_view_productivity(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user()
    and exists (select 1 from public.profiles p where p.id = p_user and p.organization_id = private.current_org_id())
    and (
      (p_user = (select auth.uid()) and private.has_permission('productivity.view_own'))
      or (private.has_permission('productivity.view_team')
          and (private.has_org_wide_scope()
               or exists (select 1 from public.profiles p where p.id = p_user and p.department_id is not null
                          and private.department_in_scope(p.department_id))
               or exists (select 1 from public.user_department_access u where u.user_id = p_user
                          and private.department_in_scope(u.department_id))))
    );
$$;
alter function private.can_view_productivity(uuid) cost 1000;

alter table public.productivity_snapshots enable row level security;
revoke all on public.productivity_snapshots from anon;
revoke insert, update, delete, truncate on public.productivity_snapshots from authenticated;
grant select on public.productivity_snapshots to authenticated;
create policy productivity_snapshots_select on public.productivity_snapshots
  for select to authenticated
  using (organization_id = private.current_org_id() and private.can_view_productivity(user_id));

-- -----------------------------------------------------------------------------
-- Relatório (individual e coletivo)
-- -----------------------------------------------------------------------------
-- p_period_type: month | quarter | semester | year; p_ref: qualquer data do período.
-- p_department_id: filtra a equipe pela estrutura do departamento (opcional).
-- p_user_id: uma pessoa (opcional). Sem permissão de equipe, só a própria pessoa.
-- Períodos fechados usam o registro consolidado (quando existir); o período em
-- curso é calculado na hora.
create or replace function public.productivity_report(
  p_period_type text, p_ref date, p_department_id uuid default null, p_user_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_start date;
  v_end date;
  v_closed boolean;
  v_team boolean := private.has_permission('productivity.view_team');
  v_people jsonb := '[]'::jsonb;
  v_totals jsonb;
  r record;
  v_m jsonb;
  v_from_snapshot boolean;
begin
  if p_period_type not in ('month', 'quarter', 'semester', 'year') then
    raise exception 'Período inválido.' using errcode = '22023';
  end if;
  if not (private.has_permission('productivity.view_own') or v_team) then
    raise exception 'Acesso negado: você não tem permissão para ver indicadores de produtividade.' using errcode = '42501';
  end if;
  if p_user_id is not null and not private.can_view_productivity(p_user_id) then
    raise exception 'Acesso negado: você não pode ver os indicadores desta pessoa.' using errcode = '42501';
  end if;
  select b.period_start, b.period_end into v_start, v_end from private.period_bounds(p_period_type, coalesce(p_ref, private.today_local())) b;
  v_closed := v_end < private.today_local();

  for r in
    select p.id, p.full_name, p.department_id
    from public.profiles p
    where p.organization_id = private.current_org_id() and p.deleted_at is null
      and (p_user_id is null or p.id = p_user_id)
      and (p_user_id is not null or v_team or p.id = auth.uid())
      and private.can_view_productivity(p.id)
      and (p_department_id is null
           or p.department_id in (select private.department_subtree(p_department_id))
           or exists (select 1 from public.user_department_access u where u.user_id = p.id
                      and u.department_id in (select private.department_subtree(p_department_id))))
      -- Equipe: apenas quem tem demandas ou é a própria pessoa (evita linhas vazias de quem não usa o módulo).
      and (p.id = auth.uid() or p_user_id is not null or exists (select 1 from public.task_assignees a where a.user_id = p.id))
    order by p.full_name
  loop
    v_m := null;
    v_from_snapshot := false;
    if v_closed then
      select s.metrics into v_m from public.productivity_snapshots s
      where s.user_id = r.id and s.period_type = p_period_type and s.period_start = v_start;
      v_from_snapshot := v_m is not null;
    end if;
    v_m := private.productivity_rates(coalesce(v_m, private.productivity_metrics(r.id, v_start, v_end)));
    v_people := v_people || jsonb_build_object('user_id', r.id, 'name', r.full_name, 'department_id', r.department_id,
                                               'is_me', r.id = auth.uid(), 'consolidated', v_from_snapshot, 'metrics', v_m);
  end loop;

  -- Coletivo: soma das contagens das pessoas visíveis (uma demanda com várias
  -- pessoas conta uma vez para cada uma, como participação).
  select private.productivity_rates(jsonb_build_object(
    'recebidas', coalesce(sum((x->'metrics'->>'recebidas')::int), 0),
    'concluidas', coalesce(sum((x->'metrics'->>'concluidas')::int), 0),
    'com_prazo', coalesce(sum((x->'metrics'->>'com_prazo')::int), 0),
    'no_prazo', coalesce(sum((x->'metrics'->>'no_prazo')::int), 0),
    'pendentes', coalesce(sum((x->'metrics'->>'pendentes')::int), 0),
    'atrasadas', coalesce(sum((x->'metrics'->>'atrasadas')::int), 0),
    'tempo_medio_dias', round(sum((x->'metrics'->>'tempo_medio_dias')::numeric * (x->'metrics'->>'concluidas')::int)
                              / nullif(sum((x->'metrics'->>'concluidas')::int) filter (where x->'metrics'->>'tempo_medio_dias' is not null), 0), 1),
    'por_complexidade', (select coalesce(jsonb_object_agg(l.code,
                           (select coalesce(sum((y->'metrics'->'por_complexidade'->>l.code::text)::int), 0) from jsonb_array_elements(v_people) y)), '{}'::jsonb)
                         from public.task_complexity_levels l),
    'como_responsavel', coalesce(sum((x->'metrics'->>'como_responsavel')::int), 0),
    'como_participante', coalesce(sum((x->'metrics'->>'como_participante')::int), 0)
  ))
  into v_totals
  from jsonb_array_elements(v_people) x;

  return jsonb_build_object(
    'period', jsonb_build_object('type', p_period_type, 'start', v_start, 'end', v_end, 'closed', v_closed),
    'can_view_team', v_team,
    'people', v_people,
    'totals', v_totals,
    'notice', 'Os indicadores apoiam a gestão e não devem ser usados como avaliação automática e definitiva dos servidores.'
  );
end;
$$;

-- Evolução de uma pessoa nos últimos N períodos (para os gráficos).
create or replace function public.productivity_series(p_period_type text, p_count int default 6, p_user_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := coalesce(p_user_id, auth.uid());
  v_ref date := private.today_local();
  v_out jsonb := '[]'::jsonb;
  v_step interval;
  b record;
  i int;
  v_m jsonb;
begin
  if p_period_type not in ('month', 'quarter', 'semester', 'year') then
    raise exception 'Período inválido.' using errcode = '22023';
  end if;
  if not private.can_view_productivity(v_user) then
    raise exception 'Acesso negado: você não pode ver os indicadores desta pessoa.' using errcode = '42501';
  end if;
  v_step := case p_period_type when 'month' then interval '1 month' when 'quarter' then interval '3 month'
                               when 'semester' then interval '6 month' else interval '1 year' end;
  for i in reverse least(greatest(p_count, 1), 24) - 1 .. 0 loop
    select * into b from private.period_bounds(p_period_type, (v_ref - v_step * i)::date);
    v_m := null;
    if b.period_end < private.today_local() then
      select s.metrics into v_m from public.productivity_snapshots s
      where s.user_id = v_user and s.period_type = p_period_type and s.period_start = b.period_start;
    end if;
    v_m := private.productivity_rates(coalesce(v_m, private.productivity_metrics(v_user, b.period_start, b.period_end)));
    v_out := v_out || jsonb_build_object('start', b.period_start, 'end', b.period_end, 'metrics', v_m);
  end loop;
  return v_out;
end;
$$;

-- -----------------------------------------------------------------------------
-- Rotina: consolida os períodos que fecharam (todo dia 1º, 06h20 de Maceió).
-- Idempotente: não regrava períodos já consolidados (registros imutáveis).
-- -----------------------------------------------------------------------------
create or replace function private.consolidate_productivity(p_ref date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last date := (date_trunc('month', coalesce(p_ref, private.today_local())) - interval '1 day')::date; -- último dia do mês anterior
  v_type text;
  b record;
  u record;
  v_count int := 0;
begin
  foreach v_type in array array['month', 'quarter', 'semester', 'year'] loop
    select * into b from private.period_bounds(v_type, v_last);
    if b.period_end <> v_last then
      continue; -- o período deste tipo ainda não fechou
    end if;
    for u in
      select distinct p.id, p.organization_id
      from public.profiles p
      where p.deleted_at is null
        and exists (select 1 from public.task_assignees a where a.user_id = p.id)
    loop
      insert into public.productivity_snapshots (organization_id, user_id, period_type, period_start, period_end, metrics)
      values (u.organization_id, u.id, v_type, b.period_start, b.period_end, private.productivity_metrics(u.id, b.period_start, b.period_end))
      on conflict (user_id, period_type, period_start) do nothing;
      if found then
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;
  return v_count;
end;
$$;
revoke all on function private.consolidate_productivity(date) from public, anon, authenticated;
select cron.schedule('semfaz-productivity-snapshots', '20 9 1 * *', 'select private.consolidate_productivity()');

do $$
declare
  f text;
begin
  foreach f in array array['public.productivity_report(text, date, uuid, uuid)', 'public.productivity_series(text, integer, uuid)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
grant execute on function private.can_view_productivity(uuid), private.period_bounds(text, date),
  private.productivity_rates(jsonb) to authenticated, service_role;
revoke all on function private.productivity_metrics(uuid, date, date) from public, anon, authenticated;
