-- =============================================================================
-- SEMFAZ Gestão — Alteração 01 (parte 3): Relatórios de despesas.
-- Uma base única de despesas (`expense_items`: faturas de água/energia e
-- aluguéis) alimenta a tela Financeiro > Relatórios de despesas e os gráficos
-- financeiros do Painel, sem cálculos duplicados. Tudo com a RLS do usuário
-- (security invoker): cada pessoa só soma o que pode ver.
-- Regras: faturas e aluguéis cancelados ficam fora; estornos são abatidos.
-- =============================================================================

create view public.expense_items
with (security_invoker = true)
as
select
  'invoice'::text as source,
  i.id,
  i.supplier_kind::text as kind,
  i.competence,
  i.due_date,
  i.amount,
  i.paid_total,
  i.balance,
  i.status::text as status,
  i.last_paid_on,
  i.property_id,
  i.property_name,
  i.department_id,
  i.supplier_id,
  i.supplier_name,
  null::uuid as contract_id,
  i.consumption,
  i.measure_unit
from public.invoices_overview i
union all
select
  'rent_charge'::text,
  r.id,
  'rent'::text,
  r.competence,
  r.due_date,
  r.amount,
  r.paid_total,
  r.balance,
  r.status::text,
  r.last_paid_on,
  r.property_id,
  r.property_name,
  r.department_id,
  null::uuid,
  null::text,
  r.contract_id,
  null::numeric,
  null::text
from public.rent_charges_overview r;

revoke all on public.expense_items from anon;
grant select on public.expense_items to authenticated;
comment on view public.expense_items is
  'Base única de despesas (faturas de água/energia e aluguéis) com situação calculada. Usada pelos relatórios de despesas e pelo Painel.';

-- Participação de cada locador no contrato (fator de 0 a 1). Sem percentual
-- informado (locador único), o fator é 1. Só ids e fatores: o nome do locador é
-- buscado com a RLS de quem consulta.
create or replace function private.contract_landlord_factors(p_contract_id uuid)
returns table (landlord_id uuid, factor numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with cl as (
    select c.landlord_id, c.share_percent, count(*) over () as n
    from public.contract_landlords c where c.contract_id = p_contract_id and c.deleted_at is null
  )
  select cl.landlord_id, coalesce(cl.share_percent / 100, 1::numeric / cl.n) from cl
  union all
  select null::uuid, 1::numeric where not exists (select 1 from cl);
$$;

-- Linhas do relatório, já filtradas. Na base "competência", cada despesa entra
-- pelo mês de competência; na base "pagamento", entram os pagamentos aprovados
-- pelo mês do pagamento (estornos com sinal negativo). Aluguéis com mais de um
-- locador são distribuídos pelo percentual de participação (somas exatas em numeric).
create or replace function private.expense_rows(
  p_start date, p_end date, p_basis text, p_kinds text[], p_statuses text[],
  p_department_id uuid, p_property_id uuid, p_counterpart_id uuid
)
returns table (
  period date, source text, item_id uuid, kind text, status text,
  property_id uuid, property_name text, department_id uuid,
  counterpart_type text, counterpart_id uuid, counterpart_name text,
  value numeric, paid numeric, pending numeric, overdue numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with items as (
    select e.* from public.expense_items e
    where e.status <> 'cancelled'
      and e.kind = any (p_kinds)
      and (p_statuses is null or e.status = any (p_statuses))
      and (p_department_id is null or e.department_id in (select private.department_subtree(p_department_id)))
      and (p_property_id is null or e.property_id = p_property_id)
  ),
  movements as (
    -- base competência
    select e.competence as period, e.*, e.amount as v_value, e.paid_total as v_paid,
           case when e.status in ('pending', 'partially_paid') then e.balance else 0 end as v_pending,
           case when e.status = 'overdue' then e.balance else 0 end as v_overdue
    from items e
    where p_basis = 'competence' and e.competence between p_start and p_end
    union all
    -- base pagamento
    select date_trunc('month', p.paid_on)::date, e.*,
           case when p.kind = 'payment' then p.amount else -p.amount end,
           case when p.kind = 'payment' then p.amount else -p.amount end, 0, 0
    from public.payments p
    join items e on (e.source = 'invoice' and e.id = p.invoice_id) or (e.source = 'rent_charge' and e.id = p.rent_charge_id)
    where p_basis = 'payment' and p.paid_on >= p_start and p.paid_on < (p_end + interval '1 month')
  )
  select m.period, m.source, m.id, m.kind, m.status, m.property_id, m.property_name, m.department_id,
         case when m.source = 'invoice' then 'supplier' else 'landlord' end,
         coalesce(m.supplier_id, f.landlord_id),
         coalesce(m.supplier_name, l.name),
         m.v_value * coalesce(f.factor, 1), m.v_paid * coalesce(f.factor, 1),
         m.v_pending * coalesce(f.factor, 1), m.v_overdue * coalesce(f.factor, 1)
  from movements m
  left join lateral private.contract_landlord_factors(m.contract_id) f on m.source = 'rent_charge'
  left join public.landlords l on l.id = f.landlord_id
  where p_counterpart_id is null or coalesce(m.supplier_id, f.landlord_id) = p_counterpart_id;
$$;

-- Relatório completo para a tela de Relatórios de despesas.
-- Filtros (jsonb): start, end (primeiro dia do mês), basis ('competence'|'payment'),
-- kinds (['rent','water','energy']), statuses (['paid','pending','partially_paid','overdue']),
-- department_id, property_id, counterpart_id (fornecedor ou locador).
create or replace function public.expense_report(p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_today date := private.today_local();
  v_start date := date_trunc('month', coalesce(nullif(p_filters->>'start', '')::date, (date_trunc('month', v_today) - interval '11 month')::date))::date;
  v_end date := date_trunc('month', coalesce(nullif(p_filters->>'end', '')::date, v_today))::date;
  v_basis text := coalesce(nullif(p_filters->>'basis', ''), 'competence');
  v_kinds text[] := array['rent', 'water', 'energy'];
  v_statuses text[];
  v_dept uuid := nullif(p_filters->>'department_id', '')::uuid;
  v_property uuid := nullif(p_filters->>'property_id', '')::uuid;
  v_counterpart uuid := nullif(p_filters->>'counterpart_id', '')::uuid;
  v_result jsonb;
begin
  if not private.has_permission('finance.reports.view') then
    raise exception 'Acesso negado: você não tem permissão para consultar relatórios de despesas.' using errcode = '42501';
  end if;
  if v_basis not in ('competence', 'payment') then
    raise exception 'Base de apuração inválida.' using errcode = '22023';
  end if;
  if v_end < v_start then
    raise exception 'O mês final deve ser igual ou posterior ao inicial.' using errcode = '22023';
  end if;
  if v_end > (v_start + interval '59 month')::date then
    raise exception 'Período máximo de 60 meses.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_filters->'kinds') = 'array' and jsonb_array_length(p_filters->'kinds') > 0 then
    select array_agg(k) into v_kinds from jsonb_array_elements_text(p_filters->'kinds') k where k in ('rent', 'water', 'energy');
  end if;
  if jsonb_typeof(p_filters->'statuses') = 'array' and jsonb_array_length(p_filters->'statuses') > 0 then
    select array_agg(s) into v_statuses from jsonb_array_elements_text(p_filters->'statuses') s
    where s in ('paid', 'pending', 'partially_paid', 'overdue');
  end if;

  with
  cur as (select * from private.expense_rows(v_start, v_end, v_basis, v_kinds, v_statuses, v_dept, v_property, v_counterpart)),
  prev as (select * from private.expense_rows((v_start - interval '12 month')::date, (v_end - interval '12 month')::date,
                                              v_basis, v_kinds, v_statuses, v_dept, v_property, v_counterpart)),
  months as (select g::date as period from generate_series(v_start, v_end, interval '1 month') g),
  kinds as (select k from unnest(v_kinds) k),
  cmp as (
    select k.k as kind,
           coalesce((select sum(value) from cur where cur.kind = k.k), 0) as current,
           coalesce((select sum(value) from prev where prev.kind = k.k), 0) as previous
    from kinds k
  ),
  cons as (
    select e.property_id, e.property_name, e.competence as period, e.kind, e.measure_unit,
           sum(e.consumption) as consumption, sum(e.amount) as amount
    from public.expense_items e
    where e.source = 'invoice' and e.status <> 'cancelled' and e.kind = any (v_kinds)
      and (v_statuses is null or e.status = any (v_statuses))
      and e.competence between v_start and v_end
      and (v_dept is null or e.department_id in (select private.department_subtree(v_dept)))
      and (v_property is null or e.property_id = v_property)
      and (v_counterpart is null or e.supplier_id = v_counterpart)
    group by 1, 2, 3, 4, 5
  )
  select jsonb_build_object(
    'filters', jsonb_build_object('start', v_start, 'end', v_end, 'basis', v_basis, 'kinds', to_jsonb(v_kinds),
                                  'statuses', to_jsonb(v_statuses)),
    'summary', (select jsonb_build_object(
        'total', coalesce(sum(value), 0)::numeric(14, 2),
        'paid', coalesce(sum(paid), 0)::numeric(14, 2),
        'pending', coalesce(sum(pending), 0)::numeric(14, 2),
        'overdue', coalesce(sum(overdue), 0)::numeric(14, 2),
        'items', count(distinct item_id)) from cur),
    'by_kind', (select coalesce(jsonb_agg(jsonb_build_object('kind', x.kind, 'total', x.total, 'paid', x.paid,
                  'pending', x.pending, 'overdue', x.overdue) order by x.kind), '[]'::jsonb)
                from (select kind, sum(value)::numeric(14, 2) total, sum(paid)::numeric(14, 2) paid,
                             sum(pending)::numeric(14, 2) pending, sum(overdue)::numeric(14, 2) overdue
                      from cur group by kind) x),
    'by_property', (select coalesce(jsonb_agg(jsonb_build_object('id', x.property_id, 'name', x.property_name,
                      'total', x.total, 'paid', x.paid, 'pending', x.pending, 'overdue', x.overdue) order by x.total desc), '[]'::jsonb)
                    from (select property_id, property_name, sum(value)::numeric(14, 2) total, sum(paid)::numeric(14, 2) paid,
                                 sum(pending)::numeric(14, 2) pending, sum(overdue)::numeric(14, 2) overdue
                          from cur group by 1, 2) x),
    'by_department', (select coalesce(jsonb_agg(jsonb_build_object('id', x.department_id, 'name', d.name,
                        'total', x.total, 'paid', x.paid, 'pending', x.pending, 'overdue', x.overdue) order by x.total desc), '[]'::jsonb)
                      from (select department_id, sum(value)::numeric(14, 2) total, sum(paid)::numeric(14, 2) paid,
                                   sum(pending)::numeric(14, 2) pending, sum(overdue)::numeric(14, 2) overdue
                            from cur group by 1) x
                      left join public.departments d on d.id = x.department_id),
    'by_counterpart', (select coalesce(jsonb_agg(jsonb_build_object('id', x.counterpart_id, 'type', x.counterpart_type,
                         'name', x.counterpart_name, 'total', x.total) order by x.total desc), '[]'::jsonb)
                       from (select counterpart_type, counterpart_id, counterpart_name, sum(value)::numeric(14, 2) total
                             from cur group by 1, 2, 3) x),
    'monthly', (select jsonb_agg(jsonb_build_object(
                  'period', m.period,
                  'rent', coalesce((select sum(value) from cur where cur.period = m.period and cur.kind = 'rent'), 0)::numeric(14, 2),
                  'water', coalesce((select sum(value) from cur where cur.period = m.period and cur.kind = 'water'), 0)::numeric(14, 2),
                  'energy', coalesce((select sum(value) from cur where cur.period = m.period and cur.kind = 'energy'), 0)::numeric(14, 2),
                  'total', coalesce((select sum(value) from cur where cur.period = m.period), 0)::numeric(14, 2)) order by m.period)
                from months m),
    'comparison', jsonb_build_object(
      'available', exists (select 1 from prev),
      'previous_start', (v_start - interval '12 month')::date,
      'previous_end', (v_end - interval '12 month')::date,
      'by_kind', (select coalesce(jsonb_agg(jsonb_build_object(
                    'kind', c.kind, 'current', c.current::numeric(14, 2), 'previous', c.previous::numeric(14, 2),
                    'diff', (c.current - c.previous)::numeric(14, 2),
                    'percent', case when c.previous = 0 then null else round((c.current - c.previous) * 100 / c.previous, 2) end)
                    order by c.kind), '[]'::jsonb) from cmp c),
      'total_current', (select coalesce(sum(current), 0)::numeric(14, 2) from cmp),
      'total_previous', (select coalesce(sum(previous), 0)::numeric(14, 2) from cmp)),
    'consumption', (select coalesce(jsonb_agg(jsonb_build_object(
                      'property_id', c.property_id, 'property_name', c.property_name, 'period', c.period, 'kind', c.kind,
                      'measure_unit', c.measure_unit, 'consumption', c.consumption, 'amount', c.amount::numeric(14, 2))
                      order by c.property_name, c.period, c.kind), '[]'::jsonb) from cons c)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.expense_report(jsonb) from public, anon;
grant execute on function public.expense_report(jsonb) to authenticated;
revoke all on function private.contract_landlord_factors(uuid) from public, anon;
grant execute on function private.contract_landlord_factors(uuid) to authenticated;
revoke all on function private.expense_rows(date, date, text, text[], text[], uuid, uuid, uuid) from public, anon;
grant execute on function private.expense_rows(date, date, text, text[], text[], uuid, uuid, uuid) to authenticated;

-- Painel: mesmos números da base de despesas (sem cálculo duplicado).
create or replace function public.dashboard_finance_stats(p_months integer default 12, p_department_id uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with months as (
    select (date_trunc('month', private.today_local()) - make_interval(months => g))::date as competence
    from generate_series(0, least(greatest(p_months, 1), 36) - 1) g
  ),
  items as (
    select * from public.expense_items
    where status <> 'cancelled' and (p_department_id is null or department_id in (select private.department_subtree(p_department_id)))
  ),
  exp as (
    select * from private.expense_rows((select min(competence) from months), (select max(competence) from months), 'competence',
                                       array['rent', 'water', 'energy'], null, p_department_id, null, null)
  )
  select jsonb_build_object(
    'invoices_pending', (select count(*) from items where source = 'invoice' and status in ('pending', 'partially_paid')),
    'invoices_overdue', (select count(*) from items where source = 'invoice' and status = 'overdue'),
    'invoices_open_amount', (select coalesce(sum(balance), 0)::numeric(14, 2) from items where source = 'invoice' and status <> 'paid'),
    'rents_open_amount', (select coalesce(sum(balance), 0)::numeric(14, 2) from items where source = 'rent_charge' and status <> 'paid'),
    'rents_overdue', (select count(*) from items where source = 'rent_charge' and status = 'overdue'),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'competence', m.competence,
        'rent', (select coalesce(sum(value), 0)::numeric(14, 2) from exp where period = m.competence and kind = 'rent'),
        'water', (select coalesce(sum(value), 0)::numeric(14, 2) from exp where period = m.competence and kind = 'water'),
        'energy', (select coalesce(sum(value), 0)::numeric(14, 2) from exp where period = m.competence and kind = 'energy')
      ) order by m.competence), '[]'::jsonb)
      from months m
    ),
    'by_property', (
      select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
        select property_id as id, property_name as name, sum(value)::numeric(14, 2) as total
        from exp group by 1, 2 order by 3 desc limit 10
      ) x
    ),
    'can_view', private.has_permission('invoices.view'),
    'can_view_reports', private.has_permission('finance.reports.view')
  );
$$;

-- Desempenho: as funções de autorização usadas nas políticas RLS consultam
-- várias tabelas. Informar o custo real ao planejador evita reavaliá-las a cada
-- volta de um nested loop (as visões financeiras ficaram de 10 a 16 vezes mais rápidas).
alter function private.can_access_unit(uuid) cost 1000;
alter function private.can_access_property(uuid) cost 1000;
alter function private.has_permission(text, uuid) cost 200;
