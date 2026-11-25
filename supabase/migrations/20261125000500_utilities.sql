-- =============================================================================
-- SEMFAZ Gestão — Fase 3A
-- Fornecedores (Energisa, Iguá e outros), unidades consumidoras e histórico de
-- vinculação unidade–imóvel, sem sobreposição de períodos.
-- Lançamento manual: não há integração com os sistemas das concessionárias.
-- =============================================================================

create type public.supplier_kind as enum ('energy', 'water');
create type public.unit_status as enum ('active', 'inactive');

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null check (length(btrim(name)) between 2 and 120),
  kind public.supplier_kind not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  constraint suppliers_id_org_key unique (id, organization_id)
);
create unique index suppliers_name_per_org on public.suppliers (organization_id, lower(name));
create trigger suppliers_actor before insert or update on public.suppliers
  for each row execute function private.tg_set_actor_columns();
create trigger suppliers_audit after insert or update or delete on public.suppliers
  for each row execute function private.tg_audit('settings');
create trigger suppliers_no_delete before delete on public.suppliers
  for each row execute function private.tg_prevent_physical_delete();

create table public.consumer_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  supplier_id uuid not null,
  -- Número da UC (energia) ou matrícula (água).
  identifier text not null check (identifier ~ '^[0-9A-Za-z./-]{1,40}$'),
  complement text check (complement is null or length(complement) <= 120),
  holder_name text not null check (length(btrim(holder_name)) between 2 and 200),
  meter_number text check (meter_number is null or meter_number ~ '^[0-9A-Za-z./-]{1,40}$'),
  address text check (address is null or length(address) <= 300),
  status public.unit_status not null default 'active',
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id),
  deletion_reason text,
  constraint consumer_units_id_org_key unique (id, organization_id),
  constraint consumer_units_supplier_fk foreign key (supplier_id, organization_id)
    references public.suppliers (id, organization_id)
);
-- Número da UC/matrícula único por fornecedor.
create unique index consumer_units_identifier_per_supplier on public.consumer_units (supplier_id, upper(identifier));
create trigger consumer_units_actor before insert or update on public.consumer_units
  for each row execute function private.tg_set_actor_columns();
create trigger consumer_units_audit after insert or update or delete on public.consumer_units
  for each row execute function private.tg_audit('utilities');
create trigger consumer_units_no_delete before delete on public.consumer_units
  for each row execute function private.tg_prevent_physical_delete();

-- Histórico de vínculos: um período por linha; vínculo aberto = end_date nulo.
create table public.unit_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  unit_id uuid not null,
  property_id uuid not null,
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  constraint unit_assignments_dates check (end_date is null or end_date >= start_date),
  constraint unit_assignments_unit_fk foreign key (unit_id, organization_id)
    references public.consumer_units (id, organization_id),
  constraint unit_assignments_property_fk foreign key (property_id, organization_id)
    references public.properties (id, organization_id),
  -- Nenhuma unidade com dois vínculos no mesmo período (inclui dois vínculos abertos).
  constraint unit_assignments_no_overlap exclude using gist (
    unit_id with =,
    daterange(start_date, coalesce(end_date, 'infinity'::date), '[]') with &&
  )
);
create index unit_assignments_property_idx on public.unit_assignments (property_id);
create trigger unit_assignments_actor before insert or update on public.unit_assignments
  for each row execute function private.tg_set_actor_columns();
create trigger unit_assignments_audit after insert or update or delete on public.unit_assignments
  for each row execute function private.tg_audit('utilities');
create trigger unit_assignments_no_delete before delete on public.unit_assignments
  for each row execute function private.tg_prevent_physical_delete();

-- Período encerrado não é reaberto nem alterado (preserva o histórico).
create or replace function private.tg_unit_assignment_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.end_date is not null then
    raise exception 'Vínculos encerrados não podem ser alterados.' using errcode = '42501';
  end if;
  if (new.unit_id, new.property_id, new.start_date) is distinct from (old.unit_id, old.property_id, old.start_date) then
    raise exception 'Somente a data de encerramento do vínculo pode ser informada.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger unit_assignments_guard before update on public.unit_assignments
  for each row execute function private.tg_unit_assignment_guard();

-- -----------------------------------------------------------------------------
-- Autorização
-- -----------------------------------------------------------------------------
create or replace function private.has_org_wide_scope()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user() and (
    private.is_admin((select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.organization_wide_access)
  );
$$;

-- Unidade acessível: algum vínculo (atual ou passado) com imóvel do escopo,
-- ou, sem vínculo, somente para quem tem escopo de toda a organização.
create or replace function private.can_access_unit(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.consumer_units u
    where u.id = p_unit_id and u.organization_id = private.current_org_id()
      and (
        private.has_org_wide_scope()
        or exists (select 1 from public.unit_assignments a where a.unit_id = u.id and private.can_access_property(a.property_id))
      )
  );
$$;

-- Imóvel vinculado à unidade numa data.
create or replace function private.unit_property_at(p_unit_id uuid, p_date date)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.property_id from public.unit_assignments a
  where a.unit_id = p_unit_id and a.start_date <= p_date and (a.end_date is null or a.end_date >= p_date)
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.suppliers enable row level security;
alter table public.consumer_units enable row level security;
alter table public.unit_assignments enable row level security;
revoke all on public.suppliers, public.consumer_units, public.unit_assignments from anon;

create policy suppliers_select on public.suppliers
  for select to authenticated using (organization_id = private.current_org_id());
create policy suppliers_insert on public.suppliers
  for insert to authenticated with check (organization_id = private.current_org_id() and private.has_permission('settings.manage'));
create policy suppliers_update on public.suppliers
  for update to authenticated
  using (organization_id = private.current_org_id() and private.has_permission('settings.manage'))
  with check (organization_id = private.current_org_id() and private.has_permission('settings.manage'));

create policy consumer_units_select on public.consumer_units
  for select to authenticated
  using (deleted_at is null and private.has_permission('utilities.view') and private.can_access_unit(id));

create policy unit_assignments_select on public.unit_assignments
  for select to authenticated
  using (private.has_permission('utilities.view') and private.can_access_property(property_id));

-- -----------------------------------------------------------------------------
-- RPCs (utilities.manage). Unidades e vínculos não exigem aprovação.
-- -----------------------------------------------------------------------------
create or replace function public.save_consumer_unit(p_unit_id uuid, p_data jsonb, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_permission('utilities.manage');
  if p_unit_id is null then
    insert into public.consumer_units (organization_id, supplier_id, identifier, complement, holder_name, meter_number, address, status, notes)
    values (private.current_org_id(), (p_data->>'supplier_id')::uuid, upper(btrim(p_data->>'identifier')),
            nullif(btrim(p_data->>'complement'), ''), btrim(p_data->>'holder_name'), nullif(btrim(p_data->>'meter_number'), ''),
            nullif(btrim(p_data->>'address'), ''), coalesce(nullif(p_data->>'status', ''), 'active')::public.unit_status,
            nullif(btrim(p_data->>'notes'), ''))
    returning id into v_id;
  else
    perform private.set_justification(p_reason);
    if not private.can_access_unit(p_unit_id) then
      raise exception 'Unidade consumidora não encontrada.' using errcode = 'P0002';
    end if;
    update public.consumer_units
       set identifier = upper(btrim(p_data->>'identifier')), complement = nullif(btrim(p_data->>'complement'), ''),
           holder_name = btrim(p_data->>'holder_name'), meter_number = nullif(btrim(p_data->>'meter_number'), ''),
           address = nullif(btrim(p_data->>'address'), ''), status = (p_data->>'status')::public.unit_status,
           notes = nullif(btrim(p_data->>'notes'), '')
     where id = p_unit_id and deleted_at is null
    returning id into v_id;
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'Já existe uma unidade com este número/matrícula para o fornecedor.' using errcode = '23505';
end;
$$;

-- Vincula a unidade a um imóvel a partir de uma data. Havendo vínculo aberto
-- anterior, ele é encerrado no dia anterior (transferência).
create or replace function public.assign_consumer_unit(p_unit_id uuid, p_property_id uuid, p_start_date date, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_open public.unit_assignments;
  v_dept uuid;
  v_id uuid;
begin
  select department_id into v_dept from public.properties
  where id = p_property_id and deleted_at is null and organization_id = private.current_org_id();
  if v_dept is null or not private.can_access_property(p_property_id) then
    raise exception 'Imóvel não encontrado ou fora do seu escopo.' using errcode = 'P0002';
  end if;
  perform private.require_permission('utilities.manage', v_dept);
  perform private.set_justification(p_reason);
  if not exists (select 1 from public.consumer_units u where u.id = p_unit_id and u.organization_id = private.current_org_id() and u.deleted_at is null) then
    raise exception 'Unidade consumidora não encontrada.' using errcode = 'P0002';
  end if;

  select * into v_open from public.unit_assignments a where a.unit_id = p_unit_id and a.end_date is null for update;
  if found then
    if v_open.property_id = p_property_id then
      raise exception 'A unidade já está vinculada a este imóvel.' using errcode = '22023';
    end if;
    if p_start_date <= v_open.start_date then
      raise exception 'A transferência deve começar depois do início do vínculo atual (%).', to_char(v_open.start_date, 'DD/MM/YYYY')
        using errcode = '22023';
    end if;
    update public.unit_assignments set end_date = p_start_date - 1 where id = v_open.id;
  end if;

  insert into public.unit_assignments (organization_id, unit_id, property_id, start_date)
  values (private.current_org_id(), p_unit_id, p_property_id, p_start_date)
  returning id into v_id;
  return v_id;
exception when exclusion_violation then
  raise exception 'O período informado se sobrepõe a outro vínculo desta unidade.' using errcode = '23P01';
end;
$$;

create or replace function public.end_consumer_unit_assignment(p_unit_id uuid, p_end_date date, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_open public.unit_assignments;
begin
  perform private.require_permission('utilities.manage');
  perform private.set_justification(p_reason);
  select * into v_open from public.unit_assignments a where a.unit_id = p_unit_id and a.end_date is null for update;
  if not found or not private.can_access_property(v_open.property_id) then
    raise exception 'A unidade não possui vínculo aberto no seu escopo.' using errcode = 'P0002';
  end if;
  if p_end_date < v_open.start_date then
    raise exception 'O encerramento não pode ser anterior ao início do vínculo.' using errcode = '22023';
  end if;
  update public.unit_assignments set end_date = p_end_date where id = v_open.id;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.save_consumer_unit(uuid, jsonb, text)',
    'public.assign_consumer_unit(uuid, uuid, date, text)',
    'public.end_consumer_unit_assignment(uuid, date, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
grant execute on all functions in schema private to authenticated, service_role;
