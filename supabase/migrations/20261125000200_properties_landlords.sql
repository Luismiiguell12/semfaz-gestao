-- =============================================================================
-- SEMFAZ Gestão — Fase 2B
-- Imóveis, locadores, vínculo imóvel–locador e escopo por imóvel selecionado.
-- =============================================================================

create type public.property_status as enum ('active', 'inactive', 'vacated');
create type public.person_type as enum ('individual', 'company');

-- -----------------------------------------------------------------------------
-- Validação de CPF/CNPJ (dígitos verificadores)
-- -----------------------------------------------------------------------------
create or replace function private.is_valid_cpf(p_value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  d int[];
  s int;
  r int;
  i int;
begin
  if p_value !~ '^\d{11}$' or p_value ~ '^(\d)\1{10}$' then
    return false;
  end if;
  d := array(select substr(p_value, g, 1)::int from generate_series(1, 11) g);
  s := 0;
  for i in 1..9 loop s := s + d[i] * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> d[10] then return false; end if;
  s := 0;
  for i in 1..10 loop s := s + d[i] * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  return r = d[11];
end;
$$;

create or replace function private.is_valid_cnpj(p_value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  d int[];
  w1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  w2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s int;
  r int;
  i int;
begin
  if p_value !~ '^\d{14}$' or p_value ~ '^(\d)\1{13}$' then
    return false;
  end if;
  d := array(select substr(p_value, g, 1)::int from generate_series(1, 14) g);
  s := 0;
  for i in 1..12 loop s := s + d[i] * w1[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  if r <> d[13] then return false; end if;
  s := 0;
  for i in 1..13 loop s := s + d[i] * w2[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  return r = d[14];
end;
$$;

-- Máscaras para exibição padrão (LGPD).
create or replace function private.mask_document(p_type public.person_type, p_document text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_type = 'individual' then '***.' || substr(p_document, 4, 3) || '.' || substr(p_document, 7, 3) || '-**'
    else substr(p_document, 1, 2) || '.' || substr(p_document, 3, 3) || '.' || substr(p_document, 6, 3) || '/'
         || substr(p_document, 9, 4) || '-' || substr(p_document, 13, 2)
  end;
$$;

create or replace function private.mask_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_phone is null then null
    when length(p_phone) >= 10 then '(' || substr(p_phone, 1, 2) || ') *****-' || right(p_phone, 4)
    else '****' || right(p_phone, 4)
  end;
$$;

-- -----------------------------------------------------------------------------
-- Imóveis
-- -----------------------------------------------------------------------------
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null check (length(btrim(name)) between 3 and 200),
  street text not null check (length(btrim(street)) between 2 and 200),
  address_number text not null check (length(btrim(address_number)) between 1 and 20),
  complement text check (complement is null or length(complement) <= 120),
  district text not null check (length(btrim(district)) between 2 and 120),
  postal_code text not null check (postal_code ~ '^\d{5}-\d{3}$'),
  city text not null check (length(btrim(city)) between 2 and 120),
  state text not null check (state in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  -- Secretaria (ou outro departamento) responsável: define o escopo de acesso.
  department_id uuid not null,
  -- Unidade administrativa que ocupa o imóvel (dentro da estrutura do responsável).
  unit_department_id uuid,
  purpose text not null check (length(btrim(purpose)) between 3 and 300),
  internal_responsible_id uuid,
  occupation_date date,
  status public.property_status not null default 'active',
  notes text check (notes is null or length(notes) <= 4000),
  approval_request_id uuid references public.approval_requests (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id),
  deletion_reason text,
  constraint properties_id_org_key unique (id, organization_id),
  constraint properties_department_fk foreign key (department_id, organization_id)
    references public.departments (id, organization_id),
  constraint properties_unit_fk foreign key (unit_department_id, organization_id)
    references public.departments (id, organization_id),
  constraint properties_responsible_fk foreign key (internal_responsible_id, organization_id)
    references public.profiles (id, organization_id)
);
create index properties_org_idx on public.properties (organization_id) where deleted_at is null;
create index properties_department_idx on public.properties (department_id);
create index properties_name_idx on public.properties (organization_id, lower(name));
comment on table public.properties is 'Imóveis ocupados pela Prefeitura. Criação e alteração de endereço/secretaria passam pela Central de Aprovações.';

-- A unidade administrativa deve estar na estrutura do departamento responsável.
create or replace function private.tg_properties_validate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.unit_department_id is not null
     and not exists (select 1 from private.department_subtree(new.department_id) t where t = new.unit_department_id) then
    raise exception 'A unidade administrativa deve pertencer à estrutura do departamento responsável.' using errcode = '23514';
  end if;
  if exists (select 1 from public.departments d where d.id in (new.department_id, new.unit_department_id) and d.deleted_at is not null) then
    raise exception 'Departamento excluído não pode ser utilizado.' using errcode = '23514';
  end if;
  new.name := btrim(new.name);
  new.city := btrim(new.city);
  return new;
end;
$$;
create trigger properties_validate before insert or update on public.properties
  for each row execute function private.tg_properties_validate();
create trigger properties_actor before insert or update on public.properties
  for each row execute function private.tg_set_actor_columns();
create trigger properties_audit after insert or update or delete on public.properties
  for each row execute function private.tg_audit('properties');
create trigger properties_no_delete before delete on public.properties
  for each row execute function private.tg_prevent_physical_delete();

-- Escopo por imóveis selecionados.
create table public.user_property_access (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null,
  property_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  constraint user_property_access_unique unique (user_id, property_id),
  constraint user_property_access_user_fk foreign key (user_id, organization_id)
    references public.profiles (id, organization_id),
  constraint user_property_access_property_fk foreign key (property_id, organization_id)
    references public.properties (id, organization_id)
);
create trigger user_property_access_creator before insert on public.user_property_access
  for each row execute function private.tg_set_creator_columns();
create trigger user_property_access_audit after insert or update or delete on public.user_property_access
  for each row execute function private.tg_audit('permissions');
create trigger user_property_access_no_self_change before insert or update or delete on public.user_property_access
  for each row execute function private.tg_prevent_self_access_change();

-- O usuário atual alcança o imóvel? (organização inteira, departamento no
-- escopo ou imóvel selecionado)
create or replace function private.can_access_property(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.properties p
    where p.id = p_property_id
      and p.organization_id = private.current_org_id()
      and (
        private.department_in_scope(p.department_id)
        or exists (select 1 from public.user_property_access upa where upa.property_id = p.id and upa.user_id = (select auth.uid()))
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- Locadores (sem dados bancários, por decisão da SEMFAZ)
-- -----------------------------------------------------------------------------
create table public.landlords (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  person_type public.person_type not null,
  name text not null check (length(btrim(name)) between 3 and 200),
  -- Somente dígitos. Acesso direto bloqueado; leitura completa só com permissão específica.
  document text not null,
  document_masked text generated always as (private.mask_document(person_type, document)) stored,
  phone text check (phone is null or phone ~ '^\d{10,11}$'),
  phone_masked text generated always as (private.mask_phone(phone)) stored,
  email extensions.citext check (email is null or (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254)),
  address text check (address is null or length(address) <= 400),
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id),
  deletion_reason text,
  constraint landlords_id_org_key unique (id, organization_id),
  constraint landlords_document_valid check (
    (person_type = 'individual' and private.is_valid_cpf(document))
    or (person_type = 'company' and private.is_valid_cnpj(document))
  )
);
create unique index landlords_document_per_org on public.landlords (organization_id, document);
create index landlords_name_idx on public.landlords (organization_id, lower(name));
comment on column public.landlords.document is 'CPF/CNPJ (somente dígitos). Dado pessoal no caso de CPF: lido apenas via get_landlord_sensitive (landlords.view_sensitive).';

create trigger landlords_actor before insert or update on public.landlords
  for each row execute function private.tg_set_actor_columns();
create trigger landlords_audit after insert or update or delete on public.landlords
  for each row execute function private.tg_audit('landlords');
create trigger landlords_no_delete before delete on public.landlords
  for each row execute function private.tg_prevent_physical_delete();

-- Vínculo N:N imóvel–locador, com percentual quando houver mais de um locador.
create table public.property_landlords (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  property_id uuid not null,
  landlord_id uuid not null,
  share_percent numeric(5, 2) check (share_percent is null or (share_percent > 0 and share_percent <= 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id),
  deletion_reason text,
  constraint property_landlords_property_fk foreign key (property_id, organization_id)
    references public.properties (id, organization_id),
  constraint property_landlords_landlord_fk foreign key (landlord_id, organization_id)
    references public.landlords (id, organization_id)
);
create unique index property_landlords_active_unique on public.property_landlords (property_id, landlord_id) where deleted_at is null;
create trigger property_landlords_actor before insert or update on public.property_landlords
  for each row execute function private.tg_set_actor_columns();
create trigger property_landlords_audit after insert or update or delete on public.property_landlords
  for each row execute function private.tg_audit('properties');
create trigger property_landlords_no_delete before delete on public.property_landlords
  for each row execute function private.tg_prevent_physical_delete();

-- Com mais de um locador ativo, todos têm percentual e a soma é 100%.
create or replace function private.assert_landlord_shares(p_table text, p_parent_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_count int;
  v_nulls int;
  v_sum numeric;
begin
  execute format(
    'select count(*), count(*) filter (where share_percent is null), coalesce(sum(share_percent), 0)
       from public.%I where %I = $1 and deleted_at is null',
    p_table, case when p_table = 'property_landlords' then 'property_id' else 'contract_id' end)
  into v_count, v_nulls, v_sum using p_parent_id;
  if v_count > 1 and (v_nulls > 0 or v_sum <> 100) then
    raise exception 'Com mais de um locador, informe o percentual de cada um; a soma deve ser 100%%.' using errcode = '23514';
  end if;
  if v_count = 1 and v_nulls = 0 and v_sum <> 100 then
    raise exception 'Com um único locador, o percentual deve ser 100%% (ou não informado).' using errcode = '23514';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.properties enable row level security;
alter table public.user_property_access enable row level security;
alter table public.landlords enable row level security;
alter table public.property_landlords enable row level security;
revoke all on public.properties, public.user_property_access, public.landlords, public.property_landlords from anon;

create policy properties_select on public.properties
  for select to authenticated
  using (deleted_at is null and private.has_permission('properties.view') and private.can_access_property(id));

create policy user_property_access_select on public.user_property_access
  for select to authenticated
  using (organization_id = private.current_org_id()
         and (user_id = (select auth.uid()) or private.has_permission('users.manage')));

-- Locadores: leitura com landlords.view. CPF/CNPJ e telefone completos NÃO são
-- legíveis diretamente (privilégio de coluna); só pela função auditada.
create policy landlords_select on public.landlords
  for select to authenticated
  using (organization_id = private.current_org_id() and deleted_at is null and private.has_permission('landlords.view'));
revoke select on public.landlords from authenticated;
grant select (id, organization_id, person_type, name, document_masked, phone_masked, email, address, notes,
              created_at, updated_at, deleted_at) on public.landlords to authenticated;

create policy property_landlords_select on public.property_landlords
  for select to authenticated
  using (deleted_at is null and private.has_permission('landlords.view') and private.can_access_property(property_id));

-- -----------------------------------------------------------------------------
-- Operações com aprovação
-- -----------------------------------------------------------------------------
insert into public.approval_operations (code, module, entity_type, description, handler, request_permission) values
  ('property.create', 'properties', 'property', 'Cadastro de imóvel', 'apply_property_create', 'properties.create'),
  ('property.update_address', 'properties', 'property', 'Alteração de endereço de imóvel', 'apply_property_update_address', 'properties.update'),
  ('property.update_department', 'properties', 'property', 'Alteração da secretaria responsável pelo imóvel', 'apply_property_update_department', 'properties.update')
on conflict (code) do nothing;

-- Valida dados propostos executando a gravação real numa subtransação desfeita:
-- as mesmas constraints e triggers do banco validam a solicitação.
create or replace function private.validate_by_rollback(p_sql text, p_args jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    execute p_sql using p_args;
    raise exception 'validation_ok' using errcode = 'P0099';
  exception when sqlstate 'P0099' then
    null;
  end;
end;
$$;

create or replace function private.property_insert_sql()
returns text
language sql
immutable
set search_path = ''
as $$
  select $q$
    insert into public.properties (
      organization_id, name, street, address_number, complement, district, postal_code, city, state,
      department_id, unit_department_id, purpose, internal_responsible_id, occupation_date, status, notes, approval_request_id
    )
    select
      ($1->>'organization_id')::uuid, $1->>'name', $1->>'street', $1->>'address_number', nullif($1->>'complement', ''),
      $1->>'district', $1->>'postal_code', $1->>'city', upper($1->>'state'),
      ($1->>'department_id')::uuid, nullif($1->>'unit_department_id', '')::uuid, $1->>'purpose',
      nullif($1->>'internal_responsible_id', '')::uuid, nullif($1->>'occupation_date', '')::date,
      coalesce(nullif($1->>'status', ''), 'active')::public.property_status, nullif($1->>'notes', ''),
      nullif($1->>'approval_request_id', '')::uuid
    returning id
  $q$;
$$;

-- Solicita o cadastro de um imóvel. O imóvel só existe após a aprovação.
create or replace function public.request_property_create(p_data jsonb, p_justification text)
returns public.approval_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_data jsonb := p_data || jsonb_build_object('organization_id', private.current_org_id());
begin
  perform private.require_permission('properties.create', (p_data->>'department_id')::uuid);
  perform private.validate_by_rollback(private.property_insert_sql(), v_data);
  return private.submit_approval_request('property.create', null, (p_data->>'department_id')::uuid,
    null, v_data - 'organization_id', null, p_justification);
end;
$$;

create or replace function private.apply_property_create(p_request public.approval_requests)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  execute private.property_insert_sql() into v_id
  using p_request.proposed_data || jsonb_build_object(
    'organization_id', p_request.organization_id, 'approval_request_id', p_request.id);
  return v_id;
end;
$$;

-- Alteração de endereço (com aprovação).
create or replace function public.request_property_address_change(p_property_id uuid, p_data jsonb, p_justification text)
returns public.approval_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.properties;
  v_new jsonb;
begin
  select * into v_p from public.properties p
  where p.id = p_property_id and p.deleted_at is null and p.organization_id = private.current_org_id();
  if not found or not private.can_access_property(p_property_id) then
    raise exception 'Imóvel não encontrado.' using errcode = 'P0002';
  end if;
  v_new := jsonb_build_object(
    'street', btrim(p_data->>'street'), 'address_number', btrim(p_data->>'address_number'),
    'complement', nullif(btrim(p_data->>'complement'), ''), 'district', btrim(p_data->>'district'),
    'postal_code', p_data->>'postal_code', 'city', btrim(p_data->>'city'), 'state', upper(p_data->>'state'));
  if v_new = jsonb_build_object('street', v_p.street, 'address_number', v_p.address_number, 'complement', v_p.complement,
       'district', v_p.district, 'postal_code', v_p.postal_code, 'city', v_p.city, 'state', v_p.state) then
    raise exception 'Nenhuma alteração de endereço informada.' using errcode = '22023';
  end if;
  perform private.validate_by_rollback(
    $q$ update public.properties set street = $1->>'street', address_number = $1->>'address_number',
          complement = $1->>'complement', district = $1->>'district', postal_code = $1->>'postal_code',
          city = $1->>'city', state = $1->>'state' where id = ($1->>'id')::uuid $q$,
    v_new || jsonb_build_object('id', p_property_id));
  return private.submit_approval_request('property.update_address', p_property_id, v_p.department_id,
    jsonb_build_object('street', v_p.street, 'address_number', v_p.address_number, 'complement', v_p.complement,
      'district', v_p.district, 'postal_code', v_p.postal_code, 'city', v_p.city, 'state', v_p.state),
    v_new, private.row_hash('properties', p_property_id), p_justification);
end;
$$;

create or replace function private.apply_property_update_address(p_request public.approval_requests)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb := p_request.proposed_data;
begin
  perform 1 from public.properties where id = p_request.entity_id for update;
  perform private.assert_not_stale('properties', p_request.entity_id, p_request.base_hash);
  update public.properties
     set street = d->>'street', address_number = d->>'address_number', complement = d->>'complement',
         district = d->>'district', postal_code = d->>'postal_code', city = d->>'city', state = d->>'state'
   where id = p_request.entity_id;
  return p_request.entity_id;
end;
$$;

-- Alteração da secretaria responsável / unidade (com aprovação).
create or replace function public.request_property_department_change(
  p_property_id uuid, p_department_id uuid, p_unit_department_id uuid, p_justification text
)
returns public.approval_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.properties;
begin
  select * into v_p from public.properties p
  where p.id = p_property_id and p.deleted_at is null and p.organization_id = private.current_org_id();
  if not found or not private.can_access_property(p_property_id) then
    raise exception 'Imóvel não encontrado.' using errcode = 'P0002';
  end if;
  if v_p.department_id = p_department_id and v_p.unit_department_id is not distinct from p_unit_department_id then
    raise exception 'Nenhuma alteração de secretaria ou unidade informada.' using errcode = '22023';
  end if;
  -- O solicitante precisa ter escopo também sobre o novo departamento.
  perform private.require_permission('properties.update', p_department_id);
  perform private.validate_by_rollback(
    $q$ update public.properties set department_id = ($1->>'department_id')::uuid,
          unit_department_id = nullif($1->>'unit_department_id', '')::uuid where id = ($1->>'id')::uuid $q$,
    jsonb_build_object('id', p_property_id, 'department_id', p_department_id, 'unit_department_id', p_unit_department_id));
  return private.submit_approval_request('property.update_department', p_property_id, v_p.department_id,
    jsonb_build_object('department_id', v_p.department_id, 'unit_department_id', v_p.unit_department_id),
    jsonb_build_object('department_id', p_department_id, 'unit_department_id', p_unit_department_id),
    private.row_hash('properties', p_property_id), p_justification);
end;
$$;

create or replace function private.apply_property_update_department(p_request public.approval_requests)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.properties where id = p_request.entity_id for update;
  perform private.assert_not_stale('properties', p_request.entity_id, p_request.base_hash);
  update public.properties
     set department_id = (p_request.proposed_data->>'department_id')::uuid,
         unit_department_id = nullif(p_request.proposed_data->>'unit_department_id', '')::uuid
   where id = p_request.entity_id;
  return p_request.entity_id;
end;
$$;

-- Demais campos: alteração direta (properties.update + escopo), auditada.
create or replace function public.update_property_details(p_property_id uuid, p_data jsonb, p_reason text)
returns public.properties
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.properties;
begin
  select * into v_p from public.properties p
  where p.id = p_property_id and p.deleted_at is null and p.organization_id = private.current_org_id() for update;
  if not found or not private.can_access_property(p_property_id) then
    raise exception 'Imóvel não encontrado.' using errcode = 'P0002';
  end if;
  perform private.require_permission('properties.update', v_p.department_id);
  perform private.set_justification(p_reason);
  update public.properties
     set name = btrim(p_data->>'name'),
         purpose = btrim(p_data->>'purpose'),
         internal_responsible_id = nullif(p_data->>'internal_responsible_id', '')::uuid,
         occupation_date = nullif(p_data->>'occupation_date', '')::date,
         status = (p_data->>'status')::public.property_status,
         notes = nullif(btrim(p_data->>'notes'), '')
   where id = p_property_id
  returning * into v_p;
  return v_p;
end;
$$;

-- Locadores do imóvel (substitui o conjunto ativo; remoções são lógicas).
create or replace function public.set_property_landlords(p_property_id uuid, p_items jsonb, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.properties;
  v_item jsonb;
begin
  select * into v_p from public.properties p
  where p.id = p_property_id and p.deleted_at is null and p.organization_id = private.current_org_id() for update;
  if not found or not private.can_access_property(p_property_id) then
    raise exception 'Imóvel não encontrado.' using errcode = 'P0002';
  end if;
  perform private.require_permission('properties.update', v_p.department_id);
  perform private.require_permission('landlords.view');
  perform private.set_justification(p_reason);

  update public.property_landlords pl
     set deleted_at = now(), deleted_by = auth.uid(), deletion_reason = btrim(p_reason)
   where pl.property_id = p_property_id and pl.deleted_at is null
     and not exists (select 1 from jsonb_array_elements(coalesce(p_items, '[]')) i
                     where (i->>'landlord_id')::uuid = pl.landlord_id);

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    update public.property_landlords
       set share_percent = nullif(v_item->>'share_percent', '')::numeric
     where property_id = p_property_id and landlord_id = (v_item->>'landlord_id')::uuid and deleted_at is null;
    if not found then
      insert into public.property_landlords (organization_id, property_id, landlord_id, share_percent)
      values (v_p.organization_id, p_property_id, (v_item->>'landlord_id')::uuid, nullif(v_item->>'share_percent', '')::numeric);
    end if;
  end loop;

  perform private.assert_landlord_shares('property_landlords', p_property_id);
end;
$$;

-- Cadastro/edição de locador (landlords.manage). CPF/CNPJ validados no banco.
create or replace function public.save_landlord(p_landlord_id uuid, p_data jsonb, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_doc text := regexp_replace(coalesce(p_data->>'document', ''), '\D', '', 'g');
  v_phone text := nullif(regexp_replace(coalesce(p_data->>'phone', ''), '\D', '', 'g'), '');
begin
  perform private.require_permission('landlords.manage');
  if p_landlord_id is not null then
    perform private.set_justification(p_reason);
  end if;
  if (p_data->>'person_type') = 'individual' and not private.is_valid_cpf(v_doc) then
    raise exception 'CPF inválido.' using errcode = '22023';
  end if;
  if (p_data->>'person_type') = 'company' and not private.is_valid_cnpj(v_doc) then
    raise exception 'CNPJ inválido.' using errcode = '22023';
  end if;
  if exists (select 1 from public.landlords l where l.organization_id = private.current_org_id()
             and l.document = v_doc and l.id is distinct from p_landlord_id) then
    raise exception 'Já existe um locador com este CPF/CNPJ.' using errcode = '23505';
  end if;

  if p_landlord_id is null then
    insert into public.landlords (organization_id, person_type, name, document, phone, email, address, notes)
    values (private.current_org_id(), (p_data->>'person_type')::public.person_type, btrim(p_data->>'name'), v_doc,
            v_phone, nullif(btrim(p_data->>'email'), ''), nullif(btrim(p_data->>'address'), ''), nullif(btrim(p_data->>'notes'), ''))
    returning id into v_id;
  else
    update public.landlords l
       set person_type = (p_data->>'person_type')::public.person_type, name = btrim(p_data->>'name'), document = v_doc,
           phone = v_phone, email = nullif(btrim(p_data->>'email'), ''), address = nullif(btrim(p_data->>'address'), ''),
           notes = nullif(btrim(p_data->>'notes'), '')
     where l.id = p_landlord_id and l.organization_id = private.current_org_id() and l.deleted_at is null
    returning id into v_id;
    if v_id is null then
      raise exception 'Locador não encontrado.' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end;
$$;

-- Dados sensíveis completos (CPF/CNPJ e telefone), com registro na auditoria.
create or replace function public.get_landlord_sensitive(p_landlord_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_l public.landlords;
begin
  perform private.require_permission('landlords.view_sensitive');
  select * into v_l from public.landlords l
  where l.id = p_landlord_id and l.organization_id = private.current_org_id() and l.deleted_at is null;
  if not found then
    raise exception 'Locador não encontrado.' using errcode = 'P0002';
  end if;
  perform private.log_event('VIEW_SENSITIVE', 'landlords', 'landlords', v_l.id, null, null, v_l.organization_id, null,
    jsonb_build_object('fields', array['document', 'phone']));
  return jsonb_build_object('document', v_l.document, 'phone', v_l.phone);
end;
$$;

-- Escopo por imóveis selecionados (administração de usuários).
create or replace function public.admin_set_user_property_access(p_user_id uuid, p_property_ids uuid[], p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_org_id();
begin
  perform private.require_permission('users.manage');
  perform private.set_justification(p_reason);
  if p_user_id = auth.uid() then
    raise exception 'Você não pode alterar o próprio escopo de acesso.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id and p.organization_id = v_org and p.deleted_at is null) then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;
  delete from public.user_property_access upa
   where upa.user_id = p_user_id and not (upa.property_id = any (coalesce(p_property_ids, '{}')));
  insert into public.user_property_access (organization_id, user_id, property_id)
  select v_org, p_user_id, pid from unnest(coalesce(p_property_ids, '{}')) pid
  join public.properties p on p.id = pid and p.organization_id = v_org and p.deleted_at is null
  on conflict (user_id, property_id) do nothing;
end;
$$;

-- Lista enxuta de imóveis para o administrador montar escopos (users.manage).
create or replace function public.admin_list_properties_for_scope()
returns table (id uuid, name text, department_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_permission('users.manage');
  return query select p.id, p.name, p.department_id from public.properties p
  where p.organization_id = private.current_org_id() and p.deleted_at is null order by p.name;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.request_property_create(jsonb, text)',
    'public.request_property_address_change(uuid, jsonb, text)',
    'public.request_property_department_change(uuid, uuid, uuid, text)',
    'public.update_property_details(uuid, jsonb, text)',
    'public.set_property_landlords(uuid, jsonb, text)',
    'public.save_landlord(uuid, jsonb, text)',
    'public.get_landlord_sensitive(uuid)',
    'public.admin_set_user_property_access(uuid, uuid[], text)',
    'public.admin_list_properties_for_scope()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
grant execute on all functions in schema private to authenticated, service_role;
