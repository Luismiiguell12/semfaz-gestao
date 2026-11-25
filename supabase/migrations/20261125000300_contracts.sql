-- =============================================================================
-- SEMFAZ Gestão — Fase 2C
-- Contratos, locadores do contrato, aditivos, listas configuráveis,
-- vigência e valor vigentes calculados, documentos de imóveis/contratos.
-- =============================================================================

create type public.contract_admin_status as enum ('active', 'suspended', 'terminated', 'closed');
create type public.amendment_kind as enum ('term', 'value', 'term_and_value', 'other');

-- Data de hoje no fuso de exibição (America/Maceio).
create or replace function private.today_local()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Maceio')::date;
$$;

-- -----------------------------------------------------------------------------
-- Listas configuráveis (sem valores oficiais; exemplos genéricos no seed)
-- -----------------------------------------------------------------------------
create table public.contract_modalities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null check (length(btrim(name)) between 2 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  constraint contract_modalities_id_org_key unique (id, organization_id)
);
create unique index contract_modalities_name on public.contract_modalities (organization_id, lower(name));

create table public.adjustment_indexes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null check (length(btrim(name)) between 2 and 60),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  constraint adjustment_indexes_id_org_key unique (id, organization_id)
);
create unique index adjustment_indexes_name on public.adjustment_indexes (organization_id, lower(name));

create trigger contract_modalities_actor before insert or update on public.contract_modalities
  for each row execute function private.tg_set_actor_columns();
create trigger adjustment_indexes_actor before insert or update on public.adjustment_indexes
  for each row execute function private.tg_set_actor_columns();
create trigger contract_modalities_audit after insert or update or delete on public.contract_modalities
  for each row execute function private.tg_audit('settings');
create trigger adjustment_indexes_audit after insert or update or delete on public.adjustment_indexes
  for each row execute function private.tg_audit('settings');
create trigger contract_modalities_no_delete before delete on public.contract_modalities
  for each row execute function private.tg_prevent_physical_delete();
create trigger adjustment_indexes_no_delete before delete on public.adjustment_indexes
  for each row execute function private.tg_prevent_physical_delete();

-- -----------------------------------------------------------------------------
-- Contratos
-- -----------------------------------------------------------------------------
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  property_id uuid not null,
  contract_number text not null check (length(btrim(contract_number)) between 1 and 60),
  process_number text check (process_number is null or length(btrim(process_number)) between 1 and 60),
  modality_id uuid,
  object text not null check (length(btrim(object)) between 5 and 2000),
  signed_on date not null,
  start_date date not null,
  end_date date not null,
  global_value numeric(14, 2) not null check (global_value >= 0),
  monthly_value numeric(14, 2) not null check (monthly_value >= 0),
  adjustment_index_id uuid,
  -- Data-base para reajuste (aniversário anual). O sistema não calcula reajustes; apenas alerta.
  base_date date,
  inspector_id uuid,
  manager_id uuid,
  admin_status public.contract_admin_status not null default 'active',
  notes text check (notes is null or length(notes) <= 4000),
  approval_request_id uuid references public.approval_requests (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id),
  deletion_reason text,
  constraint contracts_id_org_key unique (id, organization_id),
  constraint contracts_dates check (end_date >= start_date and signed_on <= end_date),
  constraint contracts_property_fk foreign key (property_id, organization_id) references public.properties (id, organization_id),
  constraint contracts_modality_fk foreign key (modality_id, organization_id) references public.contract_modalities (id, organization_id),
  constraint contracts_index_fk foreign key (adjustment_index_id, organization_id) references public.adjustment_indexes (id, organization_id),
  constraint contracts_inspector_fk foreign key (inspector_id, organization_id) references public.profiles (id, organization_id),
  constraint contracts_manager_fk foreign key (manager_id, organization_id) references public.profiles (id, organization_id)
);
create unique index contracts_number_per_org on public.contracts (organization_id, lower(contract_number)) where deleted_at is null;
create index contracts_property_idx on public.contracts (property_id);
comment on table public.contracts is 'Contratos de locação. Um imóvel pode ter vários contratos ao longo do tempo; contratos antigos nunca são sobrescritos.';

create trigger contracts_actor before insert or update on public.contracts
  for each row execute function private.tg_set_actor_columns();
create trigger contracts_audit after insert or update or delete on public.contracts
  for each row execute function private.tg_audit('contracts');
create trigger contracts_no_delete before delete on public.contracts
  for each row execute function private.tg_prevent_physical_delete();

create table public.contract_landlords (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  contract_id uuid not null,
  landlord_id uuid not null,
  share_percent numeric(5, 2) check (share_percent is null or (share_percent > 0 and share_percent <= 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id),
  deletion_reason text,
  constraint contract_landlords_contract_fk foreign key (contract_id, organization_id) references public.contracts (id, organization_id),
  constraint contract_landlords_landlord_fk foreign key (landlord_id, organization_id) references public.landlords (id, organization_id)
);
create unique index contract_landlords_active_unique on public.contract_landlords (contract_id, landlord_id) where deleted_at is null;
create trigger contract_landlords_actor before insert or update on public.contract_landlords
  for each row execute function private.tg_set_actor_columns();
create trigger contract_landlords_audit after insert or update or delete on public.contract_landlords
  for each row execute function private.tg_audit('contracts');
create trigger contract_landlords_no_delete before delete on public.contract_landlords
  for each row execute function private.tg_prevent_physical_delete();

-- -----------------------------------------------------------------------------
-- Aditivos (só existem depois de aprovados; nunca alteram o contrato original)
-- -----------------------------------------------------------------------------
create table public.contract_amendments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  contract_id uuid not null,
  amendment_number text not null check (length(btrim(amendment_number)) between 1 and 60),
  kind public.amendment_kind not null,
  signed_on date not null,
  -- Nova vigência (aditivos de prazo).
  new_end_date date,
  -- Novo valor mensal e a data a partir da qual vale (aditivos de valor).
  new_monthly_value numeric(14, 2) check (new_monthly_value is null or new_monthly_value >= 0),
  value_effective_from date,
  description text not null check (length(btrim(description)) between 5 and 2000),
  approval_request_id uuid references public.approval_requests (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id),
  deletion_reason text,
  constraint contract_amendments_contract_fk foreign key (contract_id, organization_id) references public.contracts (id, organization_id),
  constraint contract_amendments_term check ((kind in ('term', 'term_and_value')) = (new_end_date is not null)),
  constraint contract_amendments_value check (
    (kind in ('value', 'term_and_value')) = (new_monthly_value is not null and value_effective_from is not null)
  )
);
create unique index contract_amendments_number on public.contract_amendments (contract_id, lower(amendment_number)) where deleted_at is null;
create index contract_amendments_contract_idx on public.contract_amendments (contract_id, signed_on);

create trigger contract_amendments_actor before insert or update on public.contract_amendments
  for each row execute function private.tg_set_actor_columns();
create trigger contract_amendments_audit after insert or update or delete on public.contract_amendments
  for each row execute function private.tg_audit('contracts');
create trigger contract_amendments_no_delete before delete on public.contract_amendments
  for each row execute function private.tg_prevent_physical_delete();

-- Aditivo aprovado é imutável (preserva o histórico contratual).
create or replace function private.tg_amendment_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - array['updated_at', 'updated_by', 'deleted_at', 'deleted_by', 'deletion_reason'])
     is distinct from (to_jsonb(old) - array['updated_at', 'updated_by', 'deleted_at', 'deleted_by', 'deletion_reason']) then
    raise exception 'Aditivos aprovados não podem ser alterados. Registre um novo aditivo.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger contract_amendments_immutable before update on public.contract_amendments
  for each row execute function private.tg_amendment_immutable();

-- -----------------------------------------------------------------------------
-- Vigência e valor vigentes (contrato + aditivos aprovados)
-- -----------------------------------------------------------------------------
create or replace function private.contract_effective_end(p_contract_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select a.new_end_date from public.contract_amendments a
      where a.contract_id = p_contract_id and a.deleted_at is null and a.new_end_date is not null
      order by a.signed_on desc, a.created_at desc limit 1),
    (select c.end_date from public.contracts c where c.id = p_contract_id)
  );
$$;

-- Valor mensal vigente numa data (o último aditivo de valor já em vigor).
create or replace function private.contract_monthly_value_at(p_contract_id uuid, p_date date)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select a.new_monthly_value from public.contract_amendments a
      where a.contract_id = p_contract_id and a.deleted_at is null and a.new_monthly_value is not null
        and a.value_effective_from <= p_date
      order by a.value_effective_from desc, a.created_at desc limit 1),
    (select c.monthly_value from public.contracts c where c.id = p_contract_id)
  );
$$;

-- Próximo aniversário da data-base a partir de uma data.
create or replace function private.next_anniversary(p_base date, p_from date)
returns date
language sql
immutable
set search_path = ''
as $$
  select case when p_base is null then null else (
    select min(d)::date from (
      select (p_base + make_interval(years => y))::date as d
      from generate_series(0, greatest(0, extract(year from p_from)::int - extract(year from p_base)::int) + 1) y
    ) s where d >= p_from
  ) end;
$$;

-- Visão de consulta: respeita a RLS das tabelas (security_invoker).
create view public.contracts_overview
with (security_invoker = true)
as
select
  c.*,
  p.name as property_name,
  p.department_id,
  private.contract_effective_end(c.id) as effective_end_date,
  private.contract_monthly_value_at(c.id, private.today_local()) as effective_monthly_value,
  (private.contract_effective_end(c.id) - private.today_local()) as days_to_end,
  private.next_anniversary(c.base_date, private.today_local()) as next_adjustment_date,
  case
    when c.admin_status <> 'active' then 'inactive'
    when private.today_local() < c.start_date then 'not_started'
    when private.today_local() > private.contract_effective_end(c.id) then 'expired'
    when private.contract_effective_end(c.id) - private.today_local()
         <= coalesce((private.setting(c.organization_id, 'contracts.expiring_days', '90'::jsonb))::text::int, 90) then 'expiring'
    else 'active'
  end as validity_status
from public.contracts c
join public.properties p on p.id = c.property_id
where c.deleted_at is null;
comment on view public.contracts_overview is 'Contratos com vigência e valor vigentes calculados (contrato + aditivos aprovados) no fuso America/Maceio.';

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.contract_modalities enable row level security;
alter table public.adjustment_indexes enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_landlords enable row level security;
alter table public.contract_amendments enable row level security;
revoke all on public.contract_modalities, public.adjustment_indexes, public.contracts, public.contract_landlords,
  public.contract_amendments, public.contracts_overview from anon;

create policy contract_modalities_select on public.contract_modalities
  for select to authenticated using (organization_id = private.current_org_id());
create policy contract_modalities_write on public.contract_modalities
  for insert to authenticated with check (organization_id = private.current_org_id() and private.has_permission('settings.manage'));
create policy contract_modalities_update on public.contract_modalities
  for update to authenticated
  using (organization_id = private.current_org_id() and private.has_permission('settings.manage'))
  with check (organization_id = private.current_org_id() and private.has_permission('settings.manage'));

create policy adjustment_indexes_select on public.adjustment_indexes
  for select to authenticated using (organization_id = private.current_org_id());
create policy adjustment_indexes_write on public.adjustment_indexes
  for insert to authenticated with check (organization_id = private.current_org_id() and private.has_permission('settings.manage'));
create policy adjustment_indexes_update on public.adjustment_indexes
  for update to authenticated
  using (organization_id = private.current_org_id() and private.has_permission('settings.manage'))
  with check (organization_id = private.current_org_id() and private.has_permission('settings.manage'));

create policy contracts_select on public.contracts
  for select to authenticated
  using (deleted_at is null and private.has_permission('contracts.view') and private.can_access_property(property_id));

create policy contract_landlords_select on public.contract_landlords
  for select to authenticated
  using (deleted_at is null and private.has_permission('landlords.view')
         and exists (select 1 from public.contracts c where c.id = contract_landlords.contract_id));

create policy contract_amendments_select on public.contract_amendments
  for select to authenticated
  using (deleted_at is null and exists (select 1 from public.contracts c where c.id = contract_amendments.contract_id));

grant select on public.contracts_overview to authenticated;

-- -----------------------------------------------------------------------------
-- Operações com aprovação
-- -----------------------------------------------------------------------------
insert into public.approval_operations (code, module, entity_type, description, handler, request_permission) values
  ('contract.create', 'contracts', 'contract', 'Cadastro de contrato', 'apply_contract_create', 'contracts.manage'),
  ('contract.update_value', 'contracts', 'contract', 'Alteração de valor de contrato', 'apply_contract_update_value', 'contracts.manage'),
  ('contract.update_term', 'contracts', 'contract', 'Alteração de vigência de contrato', 'apply_contract_update_term', 'contracts.manage'),
  ('amendment.create', 'contracts', 'contract', 'Cadastro de aditivo contratual', 'apply_amendment_create', 'contracts.manage')
on conflict (code) do nothing;

insert into public.approval_rules (organization_id, operation_code, requires_approval)
select o.id, op.code, true from public.organizations o cross join public.approval_operations op
on conflict (organization_id, operation_code) do nothing;

create or replace function private.contract_insert_sql()
returns text
language sql
immutable
set search_path = ''
as $$
  select $q$
    insert into public.contracts (
      organization_id, property_id, contract_number, process_number, modality_id, object, signed_on, start_date, end_date,
      global_value, monthly_value, adjustment_index_id, base_date, inspector_id, manager_id, notes, approval_request_id
    )
    select ($1->>'organization_id')::uuid, ($1->>'property_id')::uuid, btrim($1->>'contract_number'),
      nullif(btrim($1->>'process_number'), ''), nullif($1->>'modality_id', '')::uuid, btrim($1->>'object'),
      ($1->>'signed_on')::date, ($1->>'start_date')::date, ($1->>'end_date')::date,
      ($1->>'global_value')::numeric(14, 2), ($1->>'monthly_value')::numeric(14, 2),
      nullif($1->>'adjustment_index_id', '')::uuid, nullif($1->>'base_date', '')::date,
      nullif($1->>'inspector_id', '')::uuid, nullif($1->>'manager_id', '')::uuid, nullif(btrim($1->>'notes'), ''),
      nullif($1->>'approval_request_id', '')::uuid
    returning id
  $q$;
$$;

-- Grava locadores do contrato e valida percentuais.
create or replace function private.write_contract_landlords(p_contract_id uuid, p_org uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
begin
  if jsonb_typeof(coalesce(p_items, '[]')) <> 'array' or jsonb_array_length(coalesce(p_items, '[]')) = 0 then
    raise exception 'Informe pelo menos um locador do contrato.' using errcode = '23514';
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.contract_landlords (organization_id, contract_id, landlord_id, share_percent)
    values (p_org, p_contract_id, (v_item->>'landlord_id')::uuid, nullif(v_item->>'share_percent', '')::numeric);
  end loop;
  perform private.assert_landlord_shares('contract_landlords', p_contract_id);
end;
$$;

-- Validação completa (contrato + locadores) numa subtransação desfeita.
create or replace function private.validate_contract_payload(p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  begin
    execute private.contract_insert_sql() into v_id using p_data;
    perform private.write_contract_landlords(v_id, (p_data->>'organization_id')::uuid, p_data->'landlords');
    raise exception 'validation_ok' using errcode = 'P0099';
  exception when sqlstate 'P0099' then
    null;
  end;
end;
$$;

create or replace function public.request_contract_create(p_data jsonb, p_justification text)
returns public.approval_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_property public.properties;
  v_data jsonb := p_data || jsonb_build_object('organization_id', private.current_org_id());
begin
  select * into v_property from public.properties p
  where p.id = (p_data->>'property_id')::uuid and p.deleted_at is null and p.organization_id = private.current_org_id();
  if not found or not private.can_access_property(v_property.id) then
    raise exception 'Imóvel não encontrado ou fora do seu escopo.' using errcode = 'P0002';
  end if;
  perform private.require_permission('contracts.manage', v_property.department_id);
  perform private.validate_contract_payload(v_data);
  return private.submit_approval_request('contract.create', null, v_property.department_id, null,
    v_data - 'organization_id', null, p_justification);
end;
$$;

create or replace function private.apply_contract_create(p_request public.approval_requests)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  execute private.contract_insert_sql() into v_id
  using p_request.proposed_data || jsonb_build_object('organization_id', p_request.organization_id, 'approval_request_id', p_request.id);
  perform private.write_contract_landlords(v_id, p_request.organization_id, p_request.proposed_data->'landlords');
  return v_id;
end;
$$;

-- Contrato acessível ao usuário e com permissão de gestão (lança erro).
create or replace function private.load_managed_contract(p_contract_id uuid)
returns public.contracts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.contracts;
  v_dept uuid;
begin
  select * into v_c from public.contracts c
  where c.id = p_contract_id and c.deleted_at is null and c.organization_id = private.current_org_id();
  if not found or not private.can_access_property(v_c.property_id) then
    raise exception 'Contrato não encontrado.' using errcode = 'P0002';
  end if;
  select department_id into v_dept from public.properties where id = v_c.property_id;
  perform private.require_permission('contracts.manage', v_dept);
  return v_c;
end;
$$;

create or replace function public.request_contract_value_change(
  p_contract_id uuid, p_monthly_value numeric, p_global_value numeric, p_justification text
)
returns public.approval_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.contracts := private.load_managed_contract(p_contract_id);
  v_dept uuid;
begin
  if v_c.monthly_value = p_monthly_value and v_c.global_value = p_global_value then
    raise exception 'Nenhuma alteração de valor informada.' using errcode = '22023';
  end if;
  if p_monthly_value < 0 or p_global_value < 0 then
    raise exception 'Valores não podem ser negativos.' using errcode = '22023';
  end if;
  select department_id into v_dept from public.properties where id = v_c.property_id;
  return private.submit_approval_request('contract.update_value', p_contract_id, v_dept,
    jsonb_build_object('monthly_value', v_c.monthly_value, 'global_value', v_c.global_value),
    jsonb_build_object('monthly_value', round(p_monthly_value, 2), 'global_value', round(p_global_value, 2)),
    private.row_hash('contracts', p_contract_id), p_justification);
end;
$$;

create or replace function private.apply_contract_update_value(p_request public.approval_requests)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.contracts where id = p_request.entity_id for update;
  perform private.assert_not_stale('contracts', p_request.entity_id, p_request.base_hash);
  update public.contracts
     set monthly_value = (p_request.proposed_data->>'monthly_value')::numeric(14, 2),
         global_value = (p_request.proposed_data->>'global_value')::numeric(14, 2)
   where id = p_request.entity_id;
  return p_request.entity_id;
end;
$$;

create or replace function public.request_contract_term_change(
  p_contract_id uuid, p_start_date date, p_end_date date, p_justification text
)
returns public.approval_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.contracts := private.load_managed_contract(p_contract_id);
  v_dept uuid;
begin
  if v_c.start_date = p_start_date and v_c.end_date = p_end_date then
    raise exception 'Nenhuma alteração de vigência informada.' using errcode = '22023';
  end if;
  if p_end_date < p_start_date or v_c.signed_on > p_end_date then
    raise exception 'O fim da vigência deve ser posterior ao início e à assinatura.' using errcode = '23514';
  end if;
  select department_id into v_dept from public.properties where id = v_c.property_id;
  return private.submit_approval_request('contract.update_term', p_contract_id, v_dept,
    jsonb_build_object('start_date', v_c.start_date, 'end_date', v_c.end_date),
    jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date),
    private.row_hash('contracts', p_contract_id), p_justification);
end;
$$;

create or replace function private.apply_contract_update_term(p_request public.approval_requests)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.contracts where id = p_request.entity_id for update;
  perform private.assert_not_stale('contracts', p_request.entity_id, p_request.base_hash);
  update public.contracts
     set start_date = (p_request.proposed_data->>'start_date')::date,
         end_date = (p_request.proposed_data->>'end_date')::date
   where id = p_request.entity_id;
  return p_request.entity_id;
end;
$$;

create or replace function private.amendment_insert_sql()
returns text
language sql
immutable
set search_path = ''
as $$
  select $q$
    insert into public.contract_amendments (
      organization_id, contract_id, amendment_number, kind, signed_on, new_end_date, new_monthly_value,
      value_effective_from, description, approval_request_id
    )
    select ($1->>'organization_id')::uuid, ($1->>'contract_id')::uuid, btrim($1->>'amendment_number'),
      ($1->>'kind')::public.amendment_kind, ($1->>'signed_on')::date, nullif($1->>'new_end_date', '')::date,
      nullif($1->>'new_monthly_value', '')::numeric(14, 2), nullif($1->>'value_effective_from', '')::date,
      btrim($1->>'description'), nullif($1->>'approval_request_id', '')::uuid
    returning id
  $q$;
$$;

create or replace function public.request_amendment_create(p_data jsonb, p_justification text)
returns public.approval_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.contracts := private.load_managed_contract((p_data->>'contract_id')::uuid);
  v_dept uuid;
  v_data jsonb := p_data || jsonb_build_object('organization_id', private.current_org_id());
begin
  if nullif(p_data->>'new_end_date', '')::date < v_c.start_date then
    raise exception 'A nova vigência não pode terminar antes do início do contrato.' using errcode = '23514';
  end if;
  perform private.validate_by_rollback(private.amendment_insert_sql(), v_data);
  select department_id into v_dept from public.properties where id = v_c.property_id;
  return private.submit_approval_request('amendment.create', v_c.id, v_dept,
    jsonb_build_object('effective_end_date', private.contract_effective_end(v_c.id),
      'effective_monthly_value', private.contract_monthly_value_at(v_c.id, private.today_local())),
    v_data - 'organization_id', null, p_justification);
end;
$$;

create or replace function private.apply_amendment_create(p_request public.approval_requests)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  execute private.amendment_insert_sql() into v_id
  using p_request.proposed_data || jsonb_build_object('organization_id', p_request.organization_id, 'approval_request_id', p_request.id);
  return v_id;
end;
$$;

-- Aditivos: várias solicitações pendentes por contrato são permitidas
-- (cada uma cria um registro próprio). Remove a regra de unicidade só para eles.
drop index if exists public.approval_requests_one_pending;
create unique index approval_requests_one_pending
  on public.approval_requests (operation_code, entity_id)
  where status = 'pending' and entity_id is not null and operation_code <> 'amendment.create';

-- Demais campos do contrato: alteração direta (contracts.manage), auditada.
create or replace function public.update_contract_details(p_contract_id uuid, p_data jsonb, p_reason text)
returns public.contracts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.contracts := private.load_managed_contract(p_contract_id);
begin
  perform private.set_justification(p_reason);
  update public.contracts
     set contract_number = btrim(p_data->>'contract_number'),
         process_number = nullif(btrim(p_data->>'process_number'), ''),
         modality_id = nullif(p_data->>'modality_id', '')::uuid,
         object = btrim(p_data->>'object'),
         signed_on = (p_data->>'signed_on')::date,
         adjustment_index_id = nullif(p_data->>'adjustment_index_id', '')::uuid,
         base_date = nullif(p_data->>'base_date', '')::date,
         inspector_id = nullif(p_data->>'inspector_id', '')::uuid,
         manager_id = nullif(p_data->>'manager_id', '')::uuid,
         admin_status = (p_data->>'admin_status')::public.contract_admin_status,
         notes = nullif(btrim(p_data->>'notes'), '')
   where id = v_c.id
  returning * into v_c;
  return v_c;
end;
$$;

-- -----------------------------------------------------------------------------
-- Documentos: imóveis, contratos, aditivos e solicitações de aprovação
-- -----------------------------------------------------------------------------
alter table public.documents drop constraint documents_entity_type_check;
alter table public.documents add constraint documents_entity_type_check
  check (entity_type in ('department', 'property', 'contract', 'amendment', 'approval_request'));

create or replace function private.can_access_document_entity(p_entity_type text, p_entity_id uuid, p_action text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_property uuid;
  v_dept uuid;
  v_req public.approval_requests;
begin
  if not private.is_active_user() or p_action not in ('view', 'attach') then
    return false;
  end if;

  case p_entity_type
    when 'department' then
      if not exists (select 1 from public.departments d where d.id = p_entity_id
                     and d.organization_id = private.current_org_id() and d.deleted_at is null) then
        return false;
      end if;
      if p_action = 'view' then
        return private.department_in_scope(p_entity_id) or private.has_permission('departments.manage');
      end if;
      return private.has_permission('departments.manage');

    when 'property' then
      select p.department_id into v_dept from public.properties p
      where p.id = p_entity_id and p.deleted_at is null and p.organization_id = private.current_org_id();
      if v_dept is null or not private.can_access_property(p_entity_id) then
        return false;
      end if;
      if p_action = 'view' then
        return private.has_permission('properties.view');
      end if;
      return private.has_permission('properties.update', v_dept);

    when 'contract', 'amendment' then
      if p_entity_type = 'amendment' then
        select a.contract_id into p_entity_id from public.contract_amendments a
        where a.id = p_entity_id and a.deleted_at is null;
      end if;
      select c.property_id into v_property from public.contracts c
      where c.id = p_entity_id and c.deleted_at is null and c.organization_id = private.current_org_id();
      if v_property is null or not private.can_access_property(v_property) then
        return false;
      end if;
      select department_id into v_dept from public.properties where id = v_property;
      if p_action = 'view' then
        return private.has_permission('contracts.view') and private.has_permission('contracts.documents.view');
      end if;
      return private.has_permission('contracts.manage', v_dept);

    when 'approval_request' then
      select * into v_req from public.approval_requests r
      where r.id = p_entity_id and r.organization_id = private.current_org_id();
      if not found then
        return false;
      end if;
      if p_action = 'view' then
        return v_req.requested_by = auth.uid() or private.has_permission('approvals.review');
      end if;
      return v_req.requested_by = auth.uid() and v_req.status = 'pending';

    else
      return false;
  end case;
end;
$$;

-- Tipos de notificação do módulo.
update public.notification_types set is_available = true where code in ('contract_expiring', 'contract_adjustment');

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.request_contract_create(jsonb, text)',
    'public.request_contract_value_change(uuid, numeric, numeric, text)',
    'public.request_contract_term_change(uuid, date, date, text)',
    'public.request_amendment_create(jsonb, text)',
    'public.update_contract_details(uuid, jsonb, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
grant execute on all functions in schema private to authenticated, service_role;
