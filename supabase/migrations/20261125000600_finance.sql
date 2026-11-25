-- =============================================================================
-- SEMFAZ Gestão — Fase 3B a 3E
-- Faturas, aluguéis gerados automaticamente, pagamentos (com complementos e
-- estornos), análise de consumo, rotinas diárias e indicadores financeiros.
-- O sistema REGISTRA e CONTROLA pagamentos; não executa pagamentos.
-- Valores sempre em numeric(14,2); nenhum cálculo financeiro no frontend.
-- =============================================================================

create type public.payment_kind as enum ('payment', 'reversal');

-- -----------------------------------------------------------------------------
-- Faturas de água e energia
-- -----------------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  unit_id uuid not null,
  supplier_id uuid not null,
  -- Derivado do vínculo da unidade na competência.
  property_id uuid not null,
  invoice_number text check (invoice_number is null or invoice_number ~ '^[0-9A-Za-z./-]{1,60}$'),
  -- Competência: primeiro dia do mês.
  competence date not null check (extract(day from competence) = 1),
  consumption numeric(14, 3) not null check (consumption >= 0),
  measure_unit text not null check (measure_unit in ('kWh', 'm³')),
  amount numeric(14, 2) not null check (amount > 0),
  issue_date date,
  due_date date not null,
  -- Fatura duplicada (mesma unidade e competência) só com justificativa aprovada.
  is_justified_duplicate boolean not null default false,
  cancelled_at timestamptz,
  cancellation_reason text,
  approval_request_id uuid references public.approval_requests (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id),
  deletion_reason text,
  constraint invoices_id_org_key unique (id, organization_id),
  constraint invoices_unit_fk foreign key (unit_id, organization_id) references public.consumer_units (id, organization_id),
  constraint invoices_supplier_fk foreign key (supplier_id, organization_id) references public.suppliers (id, organization_id),
  constraint invoices_property_fk foreign key (property_id, organization_id) references public.properties (id, organization_id),
  constraint invoices_dates check (issue_date is null or issue_date <= due_date),
  constraint invoices_cancel_consistency check ((cancelled_at is null) = (cancellation_reason is null))
);
-- Impede duplicidade por unidade e competência (exceto duplicata justificada e aprovada).
create unique index invoices_unit_competence_unique
  on public.invoices (unit_id, competence)
  where cancelled_at is null and deleted_at is null and not is_justified_duplicate;
create index invoices_property_idx on public.invoices (property_id, competence desc);
create index invoices_due_idx on public.invoices (due_date) where cancelled_at is null;

-- Fornecedor, unidade de medida e imóvel derivados da unidade consumidora.
create or replace function private.tg_invoices_derive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind public.supplier_kind;
  v_supplier uuid;
  v_property uuid;
  v_month_end date := (new.competence + interval '1 month' - interval '1 day')::date;
begin
  select u.supplier_id, s.kind into v_supplier, v_kind
  from public.consumer_units u join public.suppliers s on s.id = u.supplier_id
  where u.id = new.unit_id;
  new.supplier_id := v_supplier;
  new.measure_unit := case v_kind when 'energy' then 'kWh' else 'm³' end;
  if tg_op = 'INSERT' or new.unit_id is distinct from old.unit_id or new.competence is distinct from old.competence then
    v_property := coalesce(private.unit_property_at(new.unit_id, v_month_end), private.unit_property_at(new.unit_id, new.competence));
    if v_property is null then
      raise exception 'A unidade consumidora não está vinculada a nenhum imóvel nesta competência.' using errcode = '23514';
    end if;
    -- O usuário pode confirmar o imóvel, mas ele deve corresponder ao vínculo.
    if new.property_id is not null and new.property_id <> v_property then
      raise exception 'O imóvel informado não corresponde ao vínculo da unidade na competência.' using errcode = '23514';
    end if;
    new.property_id := v_property;
  end if;
  return new;
end;
$$;
create trigger invoices_derive before insert or update on public.invoices
  for each row execute function private.tg_invoices_derive();
create trigger invoices_actor before insert or update on public.invoices
  for each row execute function private.tg_set_actor_columns();
create trigger invoices_audit after insert or update or delete on public.invoices
  for each row execute function private.tg_audit('finance');
create trigger invoices_no_delete before delete on public.invoices
  for each row execute function private.tg_prevent_physical_delete();

-- -----------------------------------------------------------------------------
-- Aluguéis (gerados automaticamente a partir dos contratos vigentes)
-- -----------------------------------------------------------------------------
create table public.rent_charges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  contract_id uuid not null,
  property_id uuid not null,
  competence date not null check (extract(day from competence) = 1),
  amount numeric(14, 2) not null check (amount >= 0),
  -- Valor calculado na geração (preservado em caso de correção aprovada).
  calculated_amount numeric(14, 2) not null check (calculated_amount >= 0),
  due_date date not null,
  -- Memória de cálculo: dias considerados, valor diário e períodos.
  calc_memo jsonb not null,
  correction_note text,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  constraint rent_charges_id_org_key unique (id, organization_id),
  -- Um lançamento por contrato e competência (geração idempotente).
  constraint rent_charges_unique unique (contract_id, competence),
  constraint rent_charges_contract_fk foreign key (contract_id, organization_id) references public.contracts (id, organization_id),
  constraint rent_charges_property_fk foreign key (property_id, organization_id) references public.properties (id, organization_id)
);
create index rent_charges_property_idx on public.rent_charges (property_id, competence desc);
create trigger rent_charges_actor before insert or update on public.rent_charges
  for each row execute function private.tg_set_actor_columns();
create trigger rent_charges_audit after insert or update or delete on public.rent_charges
  for each row execute function private.tg_audit('finance');
create trigger rent_charges_no_delete before delete on public.rent_charges
  for each row execute function private.tg_prevent_physical_delete();

-- Cálculo do aluguel de uma competência:
--   valor mensal ÷ dias do mês × dias de vigência no mês, por período de valor
--   (aditivo de valor no meio do mês gera dois períodos), contando dia inicial e
--   final, somando em numeric e arredondando o total para centavos (meio para cima).
create or replace function private.rent_calculation(p_contract_id uuid, p_competence date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_c public.contracts;
  v_month_end date := (p_competence + interval '1 month' - interval '1 day')::date;
  v_days_in_month int := extract(day from v_month_end)::int;
  v_from date;
  v_to date;
  v_breaks date[];
  v_periods jsonb := '[]'::jsonb;
  v_total numeric := 0;
  v_value numeric;
  v_seg_start date;
  v_seg_end date;
  v_days int;
  i int;
begin
  select * into v_c from public.contracts where id = p_contract_id;
  v_from := greatest(p_competence, v_c.start_date);
  v_to := least(v_month_end, private.contract_effective_end(p_contract_id));
  if v_from > v_to then
    return null;
  end if;

  -- Pontos de mudança de valor dentro do intervalo.
  select array_agg(d order by d) into v_breaks from (
    select distinct a.value_effective_from as d from public.contract_amendments a
    where a.contract_id = p_contract_id and a.deleted_at is null and a.new_monthly_value is not null
      and a.value_effective_from > v_from and a.value_effective_from <= v_to
  ) s;
  v_breaks := array_prepend(v_from, coalesce(v_breaks, '{}'::date[]));

  for i in 1 .. array_length(v_breaks, 1) loop
    v_seg_start := v_breaks[i];
    v_seg_end := case when i < array_length(v_breaks, 1) then v_breaks[i + 1] - 1 else v_to end;
    v_days := v_seg_end - v_seg_start + 1;
    v_value := private.contract_monthly_value_at(p_contract_id, v_seg_start);
    v_total := v_total + (v_value / v_days_in_month * v_days);
    v_periods := v_periods || jsonb_build_object(
      'from', v_seg_start, 'to', v_seg_end, 'days', v_days, 'monthly_value', v_value,
      'daily_value', round(v_value / v_days_in_month, 6),
      'subtotal', round(v_value / v_days_in_month * v_days, 2));
  end loop;

  return jsonb_build_object(
    'amount', round(v_total, 2),
    'days_in_month', v_days_in_month,
    'days', v_to - v_from + 1,
    'full_month', (v_from = p_competence and v_to = v_month_end and array_length(v_breaks, 1) = 1),
    'periods', v_periods,
    'rule', 'valor mensal ÷ dias do mês × dias de vigência no mês; total arredondado para centavos (meio para cima)'
  );
end;
$$;

-- Gera os aluguéis das competências dentro da vigência efetiva, até a
-- competência atual. Idempotente. A autoria registrada é o SISTEMA.
create or replace function private.generate_rent_charges(p_contract_id uuid default null, p_until date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit date := date_trunc('month', coalesce(p_until, private.today_local()))::date;
  v_c public.contracts;
  v_comp date;
  v_last date;
  v_calc jsonb;
  v_due_day int;
  v_count int := 0;
  v_id uuid;
  v_claims text := current_setting('request.jwt.claims', true);
  v_justification text := current_setting('app.justification', true);
begin
  -- Autoria do sistema na auditoria, mesmo quando disparada por uma aprovação.
  perform set_config('request.jwt.claims', '', true);
  perform set_config('app.justification', 'Geração automática de aluguel pelo sistema.', true);

  for v_c in
    select * from public.contracts c
    where c.deleted_at is null and c.admin_status = 'active'
      and (p_contract_id is null or c.id = p_contract_id)
  loop
    v_due_day := coalesce((private.setting(v_c.organization_id, 'rents.due_day', '10'::jsonb))::text::int, 10);
    v_last := least(date_trunc('month', private.contract_effective_end(v_c.id))::date, v_limit);
    v_comp := date_trunc('month', v_c.start_date)::date;
    while v_comp <= v_last loop
      v_calc := private.rent_calculation(v_c.id, v_comp);
      if v_calc is not null then
        insert into public.rent_charges (organization_id, contract_id, property_id, competence, amount, calculated_amount, due_date, calc_memo)
        values (v_c.organization_id, v_c.id, v_c.property_id, v_comp, (v_calc->>'amount')::numeric, (v_calc->>'amount')::numeric,
                make_date(extract(year from v_comp)::int, extract(month from v_comp)::int,
                          least(v_due_day, extract(day from (v_comp + interval '1 month' - interval '1 day'))::int)),
                v_calc)
        on conflict (contract_id, competence) do nothing
        returning id into v_id;
        if v_id is not null then
          v_count := v_count + 1;
          v_id := null;
        end if;
      end if;
      v_comp := (v_comp + interval '1 month')::date;
    end loop;
  end loop;

  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  perform set_config('app.justification', coalesce(v_justification, ''), true);
  return v_count;
end;
$$;

-- Geração imediata quando um contrato ou aditivo é aprovado/alterado.
create or replace function private.tg_contracts_generate_rents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.generate_rent_charges(new.id);
  return null;
end;
$$;
create or replace function private.tg_amendments_generate_rents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.generate_rent_charges(new.contract_id);
  return null;
end;
$$;
create trigger contracts_generate_rents after insert or update of start_date, end_date, admin_status on public.contracts
  for each row execute function private.tg_contracts_generate_rents();
create trigger amendments_generate_rents after insert on public.contract_amendments
  for each row execute function private.tg_amendments_generate_rents();

-- -----------------------------------------------------------------------------
-- Pagamentos, complementos e estornos (registros independentes e imutáveis)
-- -----------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  invoice_id uuid,
  rent_charge_id uuid,
  kind public.payment_kind not null,
  amount numeric(14, 2) not null check (amount > 0),
  paid_on date not null,
  reversal_of uuid references public.payments (id),
  notes text check (notes is null or length(notes) <= 1000),
  approval_request_id uuid references public.approval_requests (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  constraint payments_id_org_key unique (id, organization_id),
  constraint payments_one_target check ((invoice_id is null) <> (rent_charge_id is null)),
  constraint payments_reversal check ((kind = 'reversal') = (reversal_of is not null)),
  constraint payments_invoice_fk foreign key (invoice_id, organization_id) references public.invoices (id, organization_id),
  constraint payments_rent_fk foreign key (rent_charge_id, organization_id) references public.rent_charges (id, organization_id)
);
create index payments_invoice_idx on public.payments (invoice_id);
create index payments_rent_idx on public.payments (rent_charge_id);
create trigger payments_actor before insert on public.payments
  for each row execute function private.tg_set_actor_columns();
create trigger payments_audit after insert on public.payments
  for each row execute function private.tg_audit('finance');
create trigger payments_immutable before update or delete on public.payments
  for each row execute function private.tg_immutable_row();
create trigger payments_no_truncate before truncate on public.payments
  for each statement execute function private.tg_immutable_row();

-- Total líquido pago (pagamentos − estornos) de uma fatura ou aluguel.
create or replace function private.paid_total(p_invoice_id uuid, p_rent_charge_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(case when p.kind = 'payment' then p.amount else -p.amount end), 0)::numeric(14, 2)
  from public.payments p
  where (p_invoice_id is not null and p.invoice_id = p_invoice_id)
     or (p_rent_charge_id is not null and p.rent_charge_id = p_rent_charge_id);
$$;

-- Situação calculada (nunca digitada):
-- cancelada > paga > vencida (saldo e vencimento passado) > parcialmente paga > pendente.
create or replace function private.charge_status(p_cancelled boolean, p_amount numeric, p_paid numeric, p_due date)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_cancelled then 'cancelled'
    when p_paid >= p_amount then 'paid'
    when p_due < private.today_local() then 'overdue'
    when p_paid > 0 then 'partially_paid'
    else 'pending'
  end;
$$;

create view public.invoices_overview
with (security_invoker = true)
as
select
  i.*,
  u.identifier as unit_identifier,
  s.name as supplier_name,
  s.kind as supplier_kind,
  p.name as property_name,
  p.department_id,
  private.paid_total(i.id, null) as paid_total,
  (i.amount - private.paid_total(i.id, null))::numeric(14, 2) as balance,
  private.charge_status(i.cancelled_at is not null, i.amount, private.paid_total(i.id, null), i.due_date) as status,
  (select max(pp.paid_on) from public.payments pp where pp.invoice_id = i.id and pp.kind = 'payment') as last_paid_on
from public.invoices i
join public.consumer_units u on u.id = i.unit_id
join public.suppliers s on s.id = i.supplier_id
join public.properties p on p.id = i.property_id
where i.deleted_at is null;

create view public.rent_charges_overview
with (security_invoker = true)
as
select
  r.*,
  c.contract_number,
  p.name as property_name,
  p.department_id,
  private.paid_total(null, r.id) as paid_total,
  (r.amount - private.paid_total(null, r.id))::numeric(14, 2) as balance,
  private.charge_status(r.cancelled_at is not null, r.amount, private.paid_total(null, r.id), r.due_date) as status,
  (select max(pp.paid_on) from public.payments pp where pp.rent_charge_id = r.id and pp.kind = 'payment') as last_paid_on
from public.rent_charges r
join public.contracts c on c.id = r.contract_id
join public.properties p on p.id = r.property_id;

-- -----------------------------------------------------------------------------
-- Análise de consumo
-- -----------------------------------------------------------------------------
create table public.consumption_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  unit_id uuid not null,
  competence date not null check (extract(day from competence) = 1),
  invoice_id uuid not null references public.invoices (id),
  consumption numeric(14, 3) not null,
  previous_average numeric(14, 3),
  increase_percent numeric(9, 2),
  threshold_percent numeric(5, 2) not null,
  status text not null check (status in ('insufficient_history', 'normal', 'alert')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consumption_records_unique unique (unit_id, competence),
  constraint consumption_records_unit_fk foreign key (unit_id, organization_id) references public.consumer_units (id, organization_id)
);

-- Compara o consumo com a média dos três meses anteriores. Com menos de três
-- meses de histórico, registra "histórico insuficiente" e não gera alerta.
-- O alerta é para análise; não classifica irregularidade.
create or replace function private.analyze_consumption(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_i public.invoices;
  v_prev numeric[];
  v_avg numeric;
  v_pct numeric;
  v_threshold numeric;
  v_status text;
  v_old_status text;
  v_user uuid;
  v_unit text;
begin
  select * into v_i from public.invoices where id = p_invoice_id;
  if v_i.cancelled_at is not null or v_i.is_justified_duplicate or v_i.deleted_at is not null then
    return;
  end if;
  v_threshold := coalesce((private.setting(v_i.organization_id, 'consumption.alert_percent', '30'::jsonb))::text::numeric, 30);

  select array_agg(x.consumption) into v_prev from (
    select i.consumption from public.invoices i
    where i.unit_id = v_i.unit_id and i.cancelled_at is null and i.deleted_at is null and not i.is_justified_duplicate
      and i.competence in ((v_i.competence - interval '1 month')::date, (v_i.competence - interval '2 month')::date, (v_i.competence - interval '3 month')::date)
  ) x;

  if coalesce(array_length(v_prev, 1), 0) < 3 then
    v_status := 'insufficient_history';
  else
    select avg(v) into v_avg from unnest(v_prev) v;
    if v_avg > 0 then
      v_pct := round((v_i.consumption - v_avg) / v_avg * 100, 2);
    end if;
    v_status := case when v_avg = 0 and v_i.consumption > 0 then 'alert'
                     when v_pct > v_threshold then 'alert' else 'normal' end;
  end if;

  select status into v_old_status from public.consumption_records where unit_id = v_i.unit_id and competence = v_i.competence;
  insert into public.consumption_records (organization_id, unit_id, competence, invoice_id, consumption, previous_average,
                                          increase_percent, threshold_percent, status)
  values (v_i.organization_id, v_i.unit_id, v_i.competence, v_i.id, v_i.consumption, round(v_avg, 3), v_pct, v_threshold, v_status)
  on conflict (unit_id, competence) do update
    set invoice_id = excluded.invoice_id, consumption = excluded.consumption, previous_average = excluded.previous_average,
        increase_percent = excluded.increase_percent, threshold_percent = excluded.threshold_percent,
        status = excluded.status, updated_at = now();

  if v_status = 'alert' and v_old_status is distinct from 'alert' then
    select identifier into v_unit from public.consumer_units where id = v_i.unit_id;
    for v_user in
      select distinct x from (
        select p.internal_responsible_id as x from public.properties p where p.id = v_i.property_id
        union select r from private.approval_reviewers(v_i.organization_id, '00000000-0000-0000-0000-000000000000') r
      ) s where x is not null
    loop
      perform private.notify(v_user, 'consumption_alert', format('Consumo acima do esperado na unidade %s', v_unit),
        format('Competência %s: %s acima da média dos três meses anteriores. Verificar.',
               to_char(v_i.competence, 'MM/YYYY'), coalesce(v_pct::text || '%', 'consumo sem histórico de consumo')),
        format('/financeiro/faturas/detalhe/?id=%s', v_i.id), 'invoices', v_i.id);
    end loop;
  end if;
end;
$$;

create or replace function private.tg_invoices_analyze()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.analyze_consumption(new.id);
  return null;
end;
$$;
create trigger invoices_analyze after insert or update of consumption, competence, cancelled_at on public.invoices
  for each row execute function private.tg_invoices_analyze();

-- -----------------------------------------------------------------------------
-- Operações (aprovação) e RPCs
-- -----------------------------------------------------------------------------
insert into public.approval_operations (code, module, entity_type, description, handler, request_permission) values
  ('invoice.duplicate', 'finance', 'invoice', 'Lançamento de fatura duplicada (justificada)', 'apply_invoice_duplicate', 'invoices.manage'),
  ('invoice.correct', 'finance', 'invoice', 'Correção de fatura (consumo, valor ou datas)', 'apply_invoice_correct', 'invoices.manage'),
  ('invoice.cancel', 'finance', 'invoice', 'Cancelamento de fatura', 'apply_invoice_cancel', 'invoices.manage'),
  ('rent_charge.correct', 'finance', 'rent_charge', 'Correção de valor de aluguel', 'apply_rent_correct', 'invoices.manage'),
  ('rent_charge.cancel', 'finance', 'rent_charge', 'Cancelamento de lançamento de aluguel', 'apply_rent_cancel', 'invoices.manage'),
  ('payment.register', 'finance', 'payment', 'Registro de pagamento, complemento ou estorno', 'apply_payment_register', 'invoices.manage')
on conflict (code) do nothing;
insert into public.approval_rules (organization_id, operation_code, requires_approval)
select o.id, op.code, true from public.organizations o cross join public.approval_operations op
on conflict (organization_id, operation_code) do nothing;

create or replace function private.invoice_insert_sql()
returns text
language sql
immutable
set search_path = ''
as $$
  select $q$
    insert into public.invoices (organization_id, unit_id, supplier_id, property_id, invoice_number, competence, consumption,
                                 measure_unit, amount, issue_date, due_date, is_justified_duplicate, approval_request_id)
    select ($1->>'organization_id')::uuid, ($1->>'unit_id')::uuid, ($1->>'unit_id')::uuid, nullif($1->>'property_id', '')::uuid,
           nullif(upper(btrim($1->>'invoice_number')), ''), date_trunc('month', ($1->>'competence')::date)::date,
           ($1->>'consumption')::numeric(14, 3), 'kWh', ($1->>'amount')::numeric(14, 2), nullif($1->>'issue_date', '')::date,
           ($1->>'due_date')::date, coalesce(($1->>'is_justified_duplicate')::boolean, false), nullif($1->>'approval_request_id', '')::uuid
    returning id
  $q$;
$$;
-- Observação: supplier_id e measure_unit são substituídos pelo trigger de derivação.

-- Lança uma fatura. Se já existir fatura para a unidade e competência, exige
-- justificativa e gera solicitação de aprovação (duplicata justificada).
create or replace function public.create_invoice(p_data jsonb, p_justification text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unit uuid := (p_data->>'unit_id')::uuid;
  v_comp date := date_trunc('month', (p_data->>'competence')::date)::date;
  v_property uuid;
  v_dept uuid;
  v_id uuid;
  v_data jsonb := p_data || jsonb_build_object('organization_id', private.current_org_id());
  v_req public.approval_requests;
begin
  if not private.can_access_unit(v_unit) then
    raise exception 'Unidade consumidora não encontrada ou fora do seu escopo.' using errcode = 'P0002';
  end if;
  v_property := coalesce(private.unit_property_at(v_unit, (v_comp + interval '1 month' - interval '1 day')::date), private.unit_property_at(v_unit, v_comp));
  select department_id into v_dept from public.properties where id = v_property;
  perform private.require_permission('invoices.manage', v_dept);

  if exists (select 1 from public.invoices i where i.unit_id = v_unit and i.competence = v_comp
             and i.cancelled_at is null and i.deleted_at is null and not i.is_justified_duplicate) then
    if p_justification is null or length(btrim(p_justification)) < 10 then
      raise exception 'Já existe fatura desta unidade para a competência. Para lançar outra, informe a justificativa: ela seguirá para aprovação.'
        using errcode = '23505', hint = 'duplicate_invoice';
    end if;
    perform private.validate_by_rollback(private.invoice_insert_sql(), v_data || jsonb_build_object('is_justified_duplicate', true));
    v_req := private.submit_approval_request('invoice.duplicate', null, v_dept, null,
      (v_data - 'organization_id') || jsonb_build_object('competence', v_comp, 'property_id', v_property), null, p_justification);
    return jsonb_build_object('approval_request_id', v_req.id, 'status', v_req.status);
  end if;

  execute private.invoice_insert_sql() into v_id using v_data;
  return jsonb_build_object('invoice_id', v_id);
end;
$$;

create or replace function private.apply_invoice_duplicate(p_request public.approval_requests)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  execute private.invoice_insert_sql() into v_id
  using p_request.proposed_data || jsonb_build_object('organization_id', p_request.organization_id,
    'is_justified_duplicate', true, 'approval_request_id', p_request.id);
  return v_id;
end;
$$;

-- Carrega fatura acessível com permissão de gestão.
create or replace function private.load_managed_invoice(p_invoice_id uuid)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_i public.invoices;
  v_dept uuid;
begin
  select * into v_i from public.invoices i
  where i.id = p_invoice_id and i.deleted_at is null and i.organization_id = private.current_org_id();
  if not found or not private.can_access_property(v_i.property_id) then
    raise exception 'Fatura não encontrada.' using errcode = 'P0002';
  end if;
  select department_id into v_dept from public.properties where id = v_i.property_id;
  perform private.require_permission('invoices.manage', v_dept);
  return v_i;
end;
$$;

create or replace function public.request_invoice_correction(p_invoice_id uuid, p_data jsonb, p_justification text)
returns public.approval_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_i public.invoices := private.load_managed_invoice(p_invoice_id);
  v_new jsonb;
  v_old jsonb;
  v_dept uuid;
begin
  if v_i.cancelled_at is not null then
    raise exception 'Fatura cancelada não pode ser corrigida.' using errcode = '22023';
  end if;
  v_old := jsonb_build_object('invoice_number', v_i.invoice_number, 'consumption', v_i.consumption, 'amount', v_i.amount,
                              'issue_date', v_i.issue_date, 'due_date', v_i.due_date);
  v_new := jsonb_build_object('invoice_number', nullif(upper(btrim(p_data->>'invoice_number')), ''),
    'consumption', (p_data->>'consumption')::numeric(14, 3), 'amount', (p_data->>'amount')::numeric(14, 2),
    'issue_date', nullif(p_data->>'issue_date', '')::date, 'due_date', (p_data->>'due_date')::date);
  if v_new = v_old then
    raise exception 'Nenhuma alteração informada.' using errcode = '22023';
  end if;
  if (v_new->>'amount')::numeric < private.paid_total(v_i.id, null) then
    raise exception 'O novo valor não pode ser menor que o total já pago.' using errcode = '23514';
  end if;
  perform private.validate_by_rollback(
    $q$ update public.invoices set invoice_number = $1->>'invoice_number', consumption = ($1->>'consumption')::numeric,
          amount = ($1->>'amount')::numeric, issue_date = nullif($1->>'issue_date', '')::date, due_date = ($1->>'due_date')::date
        where id = ($1->>'id')::uuid $q$, v_new || jsonb_build_object('id', p_invoice_id));
  select department_id into v_dept from public.properties where id = v_i.property_id;
  return private.submit_approval_request('invoice.correct', p_invoice_id, v_dept, v_old, v_new,
    private.row_hash('invoices', p_invoice_id), p_justification);
end;
$$;

create or replace function private.apply_invoice_correct(p_request public.approval_requests)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb := p_request.proposed_data;
begin
  perform 1 from public.invoices where id = p_request.entity_id for update;
  perform private.assert_not_stale('invoices', p_request.entity_id, p_request.base_hash);
  if (d->>'amount')::numeric < private.paid_total(p_request.entity_id, null) then
    raise exception 'O novo valor é menor que o total já pago.' using errcode = '23514';
  end if;
  update public.invoices
     set invoice_number = d->>'invoice_number', consumption = (d->>'consumption')::numeric(14, 3),
         amount = (d->>'amount')::numeric(14, 2), issue_date = nullif(d->>'issue_date', '')::date, due_date = (d->>'due_date')::date
   where id = p_request.entity_id;
  return p_request.entity_id;
end;
$$;

create or replace function public.request_invoice_cancel(p_invoice_id uuid, p_justification text)
returns public.approval_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_i public.invoices := private.load_managed_invoice(p_invoice_id);
  v_dept uuid;
begin
  if v_i.cancelled_at is not null then
    raise exception 'A fatura já está cancelada.' using errcode = '22023';
  end if;
  if private.paid_total(v_i.id, null) > 0 then
    raise exception 'Fatura com pagamento registrado: registre o estorno antes de cancelar.' using errcode = '23514';
  end if;
  select department_id into v_dept from public.properties where id = v_i.property_id;
  return private.submit_approval_request('invoice.cancel', p_invoice_id, v_dept,
    jsonb_build_object('status', 'ativa'), jsonb_build_object('status', 'cancelada'),
    private.row_hash('invoices', p_invoice_id), p_justification);
end;
$$;

create or replace function private.apply_invoice_cancel(p_request public.approval_requests)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.invoices where id = p_request.entity_id for update;
  perform private.assert_not_stale('invoices', p_request.entity_id, p_request.base_hash);
  if private.paid_total(p_request.entity_id, null) > 0 then
    raise exception 'Fatura com pagamento registrado não pode ser cancelada.' using errcode = '23514';
  end if;
  update public.invoices set cancelled_at = now(), cancellation_reason = p_request.justification where id = p_request.entity_id;
  return p_request.entity_id;
end;
$$;

-- Aluguéis: correção e cancelamento (com aprovação).
create or replace function private.load_managed_rent(p_rent_id uuid)
returns public.rent_charges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.rent_charges;
  v_dept uuid;
begin
  select * into v_r from public.rent_charges r where r.id = p_rent_id and r.organization_id = private.current_org_id();
  if not found or not private.can_access_property(v_r.property_id) then
    raise exception 'Lançamento de aluguel não encontrado.' using errcode = 'P0002';
  end if;
  select department_id into v_dept from public.properties where id = v_r.property_id;
  perform private.require_permission('invoices.manage', v_dept);
  return v_r;
end;
$$;

create or replace function public.request_rent_correction(p_rent_id uuid, p_amount numeric, p_justification text)
returns public.approval_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.rent_charges := private.load_managed_rent(p_rent_id);
  v_dept uuid;
begin
  if v_r.cancelled_at is not null then
    raise exception 'Lançamento cancelado não pode ser corrigido.' using errcode = '22023';
  end if;
  if p_amount < 0 or round(p_amount, 2) = v_r.amount then
    raise exception 'Informe um novo valor diferente do atual.' using errcode = '22023';
  end if;
  if round(p_amount, 2) < private.paid_total(null, v_r.id) then
    raise exception 'O novo valor não pode ser menor que o total já pago.' using errcode = '23514';
  end if;
  select department_id into v_dept from public.properties where id = v_r.property_id;
  return private.submit_approval_request('rent_charge.correct', p_rent_id, v_dept,
    jsonb_build_object('amount', v_r.amount), jsonb_build_object('amount', round(p_amount, 2)),
    private.row_hash('rent_charges', p_rent_id), p_justification);
end;
$$;

create or replace function private.apply_rent_correct(p_request public.approval_requests)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.rent_charges where id = p_request.entity_id for update;
  perform private.assert_not_stale('rent_charges', p_request.entity_id, p_request.base_hash);
  update public.rent_charges
     set amount = (p_request.proposed_data->>'amount')::numeric(14, 2), correction_note = p_request.justification
   where id = p_request.entity_id;
  return p_request.entity_id;
end;
$$;

create or replace function public.request_rent_cancel(p_rent_id uuid, p_justification text)
returns public.approval_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.rent_charges := private.load_managed_rent(p_rent_id);
  v_dept uuid;
begin
  if v_r.cancelled_at is not null then
    raise exception 'O lançamento já está cancelado.' using errcode = '22023';
  end if;
  if private.paid_total(null, v_r.id) > 0 then
    raise exception 'Lançamento com pagamento registrado: registre o estorno antes de cancelar.' using errcode = '23514';
  end if;
  select department_id into v_dept from public.properties where id = v_r.property_id;
  return private.submit_approval_request('rent_charge.cancel', p_rent_id, v_dept,
    jsonb_build_object('status', 'ativo'), jsonb_build_object('status', 'cancelado'),
    private.row_hash('rent_charges', p_rent_id), p_justification);
end;
$$;

create or replace function private.apply_rent_cancel(p_request public.approval_requests)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.rent_charges where id = p_request.entity_id for update;
  perform private.assert_not_stale('rent_charges', p_request.entity_id, p_request.base_hash);
  update public.rent_charges set cancelled_at = now(), cancellation_reason = p_request.justification where id = p_request.entity_id;
  return p_request.entity_id;
end;
$$;

-- Pagamentos: toda movimentação passa por aprovação. A validação é repetida na
-- efetivação (outros pagamentos podem ter sido aprovados no intervalo).
create or replace function private.validate_payment(p jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_amount numeric := (p->>'amount')::numeric;
  v_invoice uuid := nullif(p->>'invoice_id', '')::uuid;
  v_rent uuid := nullif(p->>'rent_charge_id', '')::uuid;
  v_total numeric;
  v_paid numeric;
  v_cancelled boolean;
  v_orig public.payments;
  v_reversed numeric;
begin
  if (v_invoice is null) = (v_rent is null) then
    raise exception 'Informe a fatura ou o aluguel do pagamento.' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 or round(v_amount, 2) <> v_amount then
    raise exception 'Valor inválido.' using errcode = '22023';
  end if;
  if (p->>'paid_on') is null or (p->>'paid_on')::date > private.today_local() then
    raise exception 'A data do pagamento não pode ser futura.' using errcode = '22023';
  end if;
  if v_invoice is not null then
    select amount, cancelled_at is not null into v_total, v_cancelled from public.invoices where id = v_invoice;
  else
    select amount, cancelled_at is not null into v_total, v_cancelled from public.rent_charges where id = v_rent;
  end if;
  if v_cancelled then
    raise exception 'Não é possível registrar movimentação em lançamento cancelado.' using errcode = '22023';
  end if;
  v_paid := private.paid_total(v_invoice, v_rent);

  if (p->>'kind') = 'payment' then
    if v_amount > v_total - v_paid then
      raise exception 'O valor excede o saldo em aberto (R$ %).', to_char(v_total - v_paid, 'FM999G999G990D00') using errcode = '23514';
    end if;
  elsif (p->>'kind') = 'reversal' then
    select * into v_orig from public.payments where id = (p->>'reversal_of')::uuid;
    if not found or v_orig.kind <> 'payment'
       or v_orig.invoice_id is distinct from v_invoice or v_orig.rent_charge_id is distinct from v_rent then
      raise exception 'Selecione o pagamento a ser estornado.' using errcode = '22023';
    end if;
    select coalesce(sum(amount), 0) into v_reversed from public.payments where reversal_of = v_orig.id;
    if v_amount > v_orig.amount - v_reversed then
      raise exception 'O estorno excede o valor ainda não estornado do pagamento.' using errcode = '23514';
    end if;
  else
    raise exception 'Tipo de movimentação inválido.' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.request_payment(p_data jsonb, p_justification text)
returns public.approval_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_property uuid;
  v_dept uuid;
  v_entity uuid := coalesce(nullif(p_data->>'invoice_id', '')::uuid, nullif(p_data->>'rent_charge_id', '')::uuid);
begin
  if nullif(p_data->>'invoice_id', '') is not null then
    v_property := (private.load_managed_invoice((p_data->>'invoice_id')::uuid)).property_id;
  else
    v_property := (private.load_managed_rent((p_data->>'rent_charge_id')::uuid)).property_id;
  end if;
  perform private.validate_payment(p_data);
  select department_id into v_dept from public.properties where id = v_property;
  return private.submit_approval_request('payment.register', null, v_dept,
    jsonb_build_object('paid_total', private.paid_total(nullif(p_data->>'invoice_id', '')::uuid, nullif(p_data->>'rent_charge_id', '')::uuid)),
    jsonb_build_object('invoice_id', nullif(p_data->>'invoice_id', ''), 'rent_charge_id', nullif(p_data->>'rent_charge_id', ''),
      'kind', p_data->>'kind', 'amount', round((p_data->>'amount')::numeric, 2), 'paid_on', p_data->>'paid_on',
      'reversal_of', nullif(p_data->>'reversal_of', ''), 'notes', nullif(btrim(p_data->>'notes'), ''), 'target_id', v_entity),
    null, p_justification);
end;
$$;

create or replace function private.apply_payment_register(p_request public.approval_requests)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb := p_request.proposed_data;
  v_id uuid;
begin
  -- Bloqueia o lançamento alvo e revalida o saldo no momento da efetivação.
  perform 1 from public.invoices where id = nullif(d->>'invoice_id', '')::uuid for update;
  perform 1 from public.rent_charges where id = nullif(d->>'rent_charge_id', '')::uuid for update;
  perform private.validate_payment(d);
  insert into public.payments (organization_id, invoice_id, rent_charge_id, kind, amount, paid_on, reversal_of, notes, approval_request_id)
  values (p_request.organization_id, nullif(d->>'invoice_id', '')::uuid, nullif(d->>'rent_charge_id', '')::uuid,
          (d->>'kind')::public.payment_kind, (d->>'amount')::numeric(14, 2), (d->>'paid_on')::date,
          nullif(d->>'reversal_of', '')::uuid, d->>'notes', p_request.id)
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Alertas de fatura vencida (rotina diária)
-- -----------------------------------------------------------------------------
alter table public.alert_rules drop constraint alert_rules_code_check;
alter table public.alert_rules add constraint alert_rules_code_check
  check (code in ('contract_expiring', 'contract_expired', 'contract_adjustment', 'invoice_overdue'));
alter table public.alerts drop constraint alerts_entity_type_check;
alter table public.alerts add constraint alerts_entity_type_check check (entity_type in ('contract', 'invoice'));
drop policy alerts_select on public.alerts;
create policy alerts_select on public.alerts
  for select to authenticated
  using (
    (entity_type = 'contract' and exists (select 1 from public.contracts c where c.id = alerts.entity_id))
    or (entity_type = 'invoice' and exists (select 1 from public.invoices i where i.id = alerts.entity_id))
  );
insert into public.alert_rules (organization_id, code, days_before, description)
select o.id, 'invoice_overdue', 0, 'Fatura vencida com saldo em aberto' from public.organizations o
on conflict (organization_id, code, days_before) do nothing;

create or replace function private.generate_invoice_alerts(p_reference date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref date := coalesce(p_reference, private.today_local());
  v_i record;
  v_rule uuid;
  v_id uuid;
  v_user uuid;
  v_count int := 0;
begin
  for v_i in
    select i.*, u.identifier, p.internal_responsible_id
    from public.invoices i
    join public.consumer_units u on u.id = i.unit_id
    join public.properties p on p.id = i.property_id
    where i.cancelled_at is null and i.deleted_at is null and i.due_date < v_ref
      and private.paid_total(i.id, null) < i.amount
  loop
    select r.id into v_rule from public.alert_rules r
    where r.organization_id = v_i.organization_id and r.code = 'invoice_overdue' and r.is_active;
    continue when v_rule is null;
    insert into public.alerts (organization_id, rule_id, entity_type, entity_id, milestone_date, title)
    values (v_i.organization_id, v_rule, 'invoice', v_i.id, v_i.due_date,
            format('Fatura da unidade %s (competência %s) vencida em %s', v_i.identifier, to_char(v_i.competence, 'MM/YYYY'), to_char(v_i.due_date, 'DD/MM/YYYY')))
    on conflict on constraint alerts_unique do nothing
    returning id into v_id;
    if v_id is not null then
      v_count := v_count + 1;
      for v_user in
        select distinct x from (
          select v_i.internal_responsible_id as x
          union select r from private.approval_reviewers(v_i.organization_id, '00000000-0000-0000-0000-000000000000') r
        ) s where x is not null
      loop
        perform private.notify(v_user, 'invoice_overdue', 'Fatura vencida',
          format('Unidade %s, competência %s, vencida em %s.', v_i.identifier, to_char(v_i.competence, 'MM/YYYY'), to_char(v_i.due_date, 'DD/MM/YYYY')),
          format('/financeiro/faturas/detalhe/?id=%s', v_i.id), 'invoices', v_i.id);
      end loop;
      v_id := null;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Rotina diária do financeiro (06:05 de Maceió): aluguéis e faturas vencidas.
select cron.schedule('semfaz-finance-daily', '5 9 * * *',
  'select private.generate_rent_charges(); select private.generate_invoice_alerts();');

update public.notification_types set is_available = true where code in ('invoice_overdue', 'consumption_alert');

-- -----------------------------------------------------------------------------
-- Documentos: faturas, aluguéis, pagamentos e unidades consumidoras
-- -----------------------------------------------------------------------------
alter table public.documents drop constraint documents_entity_type_check;
alter table public.documents add constraint documents_entity_type_check
  check (entity_type in ('department', 'property', 'contract', 'amendment', 'approval_request',
                         'invoice', 'rent_charge', 'payment', 'consumer_unit'));

create or replace function private.can_access_finance_document(p_entity_type text, p_entity_id uuid, p_action text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_property uuid;
  v_dept uuid;
begin
  case p_entity_type
    when 'invoice' then select property_id into v_property from public.invoices where id = p_entity_id and deleted_at is null;
    when 'rent_charge' then select property_id into v_property from public.rent_charges where id = p_entity_id;
    when 'payment' then
      select coalesce(i.property_id, r.property_id) into v_property
      from public.payments p left join public.invoices i on i.id = p.invoice_id left join public.rent_charges r on r.id = p.rent_charge_id
      where p.id = p_entity_id;
    when 'consumer_unit' then
      if not private.can_access_unit(p_entity_id) then return false; end if;
      if p_action = 'view' then return private.has_permission('utilities.view'); end if;
      return private.has_permission('utilities.manage');
    else return false;
  end case;
  if v_property is null or not private.can_access_property(v_property) then
    return false;
  end if;
  select department_id into v_dept from public.properties where id = v_property;
  if p_action = 'view' then
    return private.has_permission('invoices.view') and private.has_permission('finance.documents.view');
  end if;
  return private.has_permission('invoices.manage', v_dept);
end;
$$;

-- Estende a autorização de documentos (mantém os tipos anteriores).
alter function private.can_access_document_entity(text, uuid, text) rename to can_access_document_entity_base;
create or replace function private.can_access_document_entity(p_entity_type text, p_entity_id uuid, p_action text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_active_user() or p_action not in ('view', 'attach') then
    return false;
  end if;
  if p_entity_type in ('invoice', 'rent_charge', 'payment', 'consumer_unit') then
    return private.can_access_finance_document(p_entity_type, p_entity_id, p_action);
  end if;
  return private.can_access_document_entity_base(p_entity_type, p_entity_id, p_action);
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.invoices enable row level security;
alter table public.rent_charges enable row level security;
alter table public.payments enable row level security;
alter table public.consumption_records enable row level security;
revoke all on public.invoices, public.rent_charges, public.payments, public.consumption_records,
  public.invoices_overview, public.rent_charges_overview from anon;
revoke insert, update, delete, truncate on public.payments from authenticated, service_role;

create policy invoices_select on public.invoices
  for select to authenticated
  using (deleted_at is null and private.has_permission('invoices.view') and private.can_access_property(property_id));
create policy rent_charges_select on public.rent_charges
  for select to authenticated
  using (private.has_permission('invoices.view') and private.can_access_property(property_id));
create policy payments_select on public.payments
  for select to authenticated
  using (
    (invoice_id is not null and exists (select 1 from public.invoices i where i.id = payments.invoice_id))
    or (rent_charge_id is not null and exists (select 1 from public.rent_charges r where r.id = payments.rent_charge_id))
  );
create policy consumption_records_select on public.consumption_records
  for select to authenticated
  using ((private.has_permission('utilities.view') or private.has_permission('invoices.view')) and private.can_access_unit(unit_id));
grant select on public.invoices_overview, public.rent_charges_overview to authenticated;

-- -----------------------------------------------------------------------------
-- Indicadores financeiros (RLS do usuário aplicada)
-- -----------------------------------------------------------------------------
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
  inv as (
    select * from public.invoices_overview
    where status <> 'cancelled' and (p_department_id is null or department_id in (select private.department_subtree(p_department_id)))
  ),
  rent as (
    select * from public.rent_charges_overview
    where status <> 'cancelled' and (p_department_id is null or department_id in (select private.department_subtree(p_department_id)))
  )
  select jsonb_build_object(
    'invoices_pending', (select count(*) from inv where status in ('pending', 'partially_paid')),
    'invoices_overdue', (select count(*) from inv where status = 'overdue'),
    'invoices_open_amount', (select coalesce(sum(balance), 0)::numeric(14, 2) from inv where status <> 'paid'),
    'rents_open_amount', (select coalesce(sum(balance), 0)::numeric(14, 2) from rent where status <> 'paid'),
    'rents_overdue', (select count(*) from rent where status = 'overdue'),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'competence', m.competence,
        'rent', (select coalesce(sum(amount), 0)::numeric(14, 2) from rent where competence = m.competence),
        'water', (select coalesce(sum(amount), 0)::numeric(14, 2) from inv where competence = m.competence and supplier_kind = 'water'),
        'energy', (select coalesce(sum(amount), 0)::numeric(14, 2) from inv where competence = m.competence and supplier_kind = 'energy')
      ) order by m.competence), '[]'::jsonb)
      from months m
    ),
    'by_property', (
      select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
        select property_name as name, sum(amount)::numeric(14, 2) as total from (
          select property_name, amount from inv where competence >= (select min(competence) from months)
          union all select property_name, amount from rent where competence >= (select min(competence) from months)
        ) s group by property_name order by 2 desc limit 10
      ) x
    ),
    'can_view', private.has_permission('invoices.view')
  );
$$;
revoke execute on function public.dashboard_finance_stats(integer, uuid) from public, anon;
grant execute on function public.dashboard_finance_stats(integer, uuid) to authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.create_invoice(jsonb, text)',
    'public.request_invoice_correction(uuid, jsonb, text)',
    'public.request_invoice_cancel(uuid, text)',
    'public.request_rent_correction(uuid, numeric, text)',
    'public.request_rent_cancel(uuid, text)',
    'public.request_payment(jsonb, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
grant execute on all functions in schema private to authenticated, service_role;
