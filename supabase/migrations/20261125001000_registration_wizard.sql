-- =============================================================================
-- SEMFAZ Gestão — Alteração 01 (parte 2): cadastro guiado a partir do contrato.
-- Fluxo real da SEMFAZ: contrato → locador(es) → imóvel → unidades consumidoras.
--  * registration_drafts: rascunho do assistente, visível só para o autor (RLS).
--  * Buscas de duplicidade (locador por CPF/CNPJ, imóvel por CEP/número,
--    unidade por fornecedor/número) que respeitam o escopo do usuário.
--  * Operação de aprovação `registration.package`: UMA solicitação agrupa o
--    imóvel (se novo), o contrato, os vínculos imóvel–locador e os vínculos das
--    unidades consumidoras. A efetivação é transacional (tudo ou nada).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Rascunhos
-- -----------------------------------------------------------------------------
create table public.registration_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null references auth.users (id),
  title text check (title is null or length(title) <= 200),
  current_step smallint not null default 1 check (current_step between 1 and 5),
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 262144),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'discarded')),
  approval_request_id uuid references public.approval_requests (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id)
);
create index registration_drafts_user_idx on public.registration_drafts (user_id, status, updated_at desc);
comment on table public.registration_drafts is
  'Rascunhos do cadastro guiado a partir do contrato. Somente o autor vê e altera. Guarda apenas referências (ids) de locadores; nenhum CPF/CNPJ.';

create trigger registration_drafts_actor before insert or update on public.registration_drafts
  for each row execute function private.tg_set_actor_columns();
create trigger registration_drafts_audit after insert or update or delete on public.registration_drafts
  for each row execute function private.tg_audit();
create trigger registration_drafts_no_delete before delete on public.registration_drafts
  for each row execute function private.tg_prevent_physical_delete();

alter table public.registration_drafts enable row level security;
revoke all on public.registration_drafts from anon;
grant select, insert, update on public.registration_drafts to authenticated;

create policy registration_drafts_select on public.registration_drafts
  for select to authenticated
  using (user_id = auth.uid() and organization_id = private.current_org_id() and private.is_active_user());
create policy registration_drafts_insert on public.registration_drafts
  for insert to authenticated
  with check (user_id = auth.uid() and organization_id = private.current_org_id() and private.is_active_user()
              and status = 'draft' and approval_request_id is null
              and private.has_permission('contracts.manage'));
-- O autor edita o rascunho enquanto não foi enviado; pode descartá-lo.
create policy registration_drafts_update on public.registration_drafts
  for update to authenticated
  using (user_id = auth.uid() and organization_id = private.current_org_id() and private.is_active_user() and status = 'draft')
  with check (user_id = auth.uid() and organization_id = private.current_org_id()
              and status in ('draft', 'discarded') and approval_request_id is null);

-- -----------------------------------------------------------------------------
-- Buscas de duplicidade
-- -----------------------------------------------------------------------------
-- Locador pelo CPF/CNPJ (somente dígitos). Devolve o documento mascarado.
create or replace function public.find_landlord_by_document(p_document text)
returns table (id uuid, name text, person_type public.person_type, document_masked text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_doc text := regexp_replace(coalesce(p_document, ''), '\D', '', 'g');
begin
  perform private.require_permission('landlords.view');
  if length(v_doc) not in (11, 14) then
    return;
  end if;
  return query
    select l.id, l.name, l.person_type, l.document_masked
    from public.landlords l
    where l.organization_id = private.current_org_id() and l.document = v_doc and l.deleted_at is null;
end;
$$;

-- Imóveis com o mesmo CEP e número. Os que estão fora do escopo do usuário
-- aparecem só na contagem (sem dados), para alertar sem expor o cadastro.
create or replace function public.find_similar_properties(p_postal_code text, p_address_number text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_matches jsonb;
  v_restricted int;
begin
  perform private.require_permission('properties.view');
  with m as (
    select p.* from public.properties p
    where p.organization_id = private.current_org_id() and p.deleted_at is null
      and p.postal_code = btrim(p_postal_code)
      and lower(btrim(p.address_number)) = lower(btrim(coalesce(p_address_number, '')))
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'name', m.name,
      'address', concat_ws(', ', m.street, m.address_number, m.complement, m.district, m.city || '/' || m.state))
      order by m.name) filter (where private.can_access_property(m.id)), '[]'::jsonb),
    count(*) filter (where not private.can_access_property(m.id))::int
  into v_matches, v_restricted
  from m;
  return jsonb_build_object('matches', v_matches, 'restricted_count', v_restricted);
end;
$$;

-- Unidade consumidora pelo fornecedor e número da UC/matrícula, com o vínculo atual.
create or replace function public.find_consumer_unit(p_supplier_id uuid, p_identifier text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_unit public.consumer_units;
  v_open public.unit_assignments;
  v_property public.properties;
begin
  perform private.require_permission('consumer_units.view');
  select * into v_unit from public.consumer_units u
  where u.organization_id = private.current_org_id() and u.supplier_id = p_supplier_id
    and upper(u.identifier) = upper(btrim(coalesce(p_identifier, ''))) and u.deleted_at is null;
  if not found then
    return null;
  end if;
  if not private.can_access_unit(v_unit.id) then
    return jsonb_build_object('exists', true, 'accessible', false);
  end if;
  select * into v_open from public.unit_assignments a where a.unit_id = v_unit.id and a.end_date is null;
  if found then
    select * into v_property from public.properties p where p.id = v_open.property_id;
  end if;
  return jsonb_build_object(
    'exists', true, 'accessible', true, 'id', v_unit.id, 'identifier', v_unit.identifier,
    'holder_name', v_unit.holder_name, 'status', v_unit.status,
    'current_property_id', v_open.property_id,
    'current_property_name', case when v_open.id is null then null
                                  when private.can_access_property(v_open.property_id) then v_property.name end,
    'current_start_date', v_open.start_date);
end;
$$;

-- -----------------------------------------------------------------------------
-- Pacote de cadastro (imóvel + contrato + locadores + unidades)
-- -----------------------------------------------------------------------------
insert into public.approval_operations (code, module, entity_type, description, handler, request_permission) values
  ('registration.package', 'contracts', 'contract', 'Cadastro a partir de contrato (imóvel, contrato, locadores e unidades)',
   'apply_registration_package', 'contracts.manage')
on conflict (code) do nothing;

insert into public.approval_rules (organization_id, operation_code, requires_approval)
select o.id, 'registration.package', true from public.organizations o
on conflict (organization_id, operation_code) do nothing;

-- Grava o pacote. Usada na validação (subtransação desfeita) e na efetivação.
-- Formato de p_data:
--   property: {"mode":"existing","id":uuid} | {"mode":"new","data":{...campos do imóvel}}
--   contract: {...campos do contrato, "landlords":[{"landlord_id","share_percent"}]}
--   units:    [{"mode":"new","data":{supplier_id, identifier, holder_name, ...},"start_date"} |
--              {"mode":"existing","unit_id":uuid,"start_date"}]
create or replace function private.write_registration_package(p_org uuid, p_data jsonb, p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_property_id uuid;
  v_contract_id uuid;
  v_contract jsonb := p_data->'contract';
  v_item jsonb;
  v_unit_id uuid;
  v_start date;
  v_open public.unit_assignments;
  v_reason text;
begin
  -- 1) Imóvel
  if p_data->'property'->>'mode' = 'new' then
    execute private.property_insert_sql() into v_property_id
    using (p_data->'property'->'data') || jsonb_build_object('organization_id', p_org, 'approval_request_id', p_request_id);
  elsif p_data->'property'->>'mode' = 'existing' then
    select p.id into v_property_id from public.properties p
    where p.id = (p_data->'property'->>'id')::uuid and p.organization_id = p_org and p.deleted_at is null;
    if v_property_id is null then
      raise exception 'O imóvel selecionado não existe mais ou foi excluído.' using errcode = 'P0002';
    end if;
  else
    raise exception 'Informe o imóvel do contrato.' using errcode = '22023';
  end if;

  -- 2) Contrato e locadores do contrato
  if v_contract is null or jsonb_typeof(v_contract) <> 'object' then
    raise exception 'Informe os dados do contrato.' using errcode = '22023';
  end if;
  execute private.contract_insert_sql() into v_contract_id
  using (v_contract - 'landlords') || jsonb_build_object(
    'organization_id', p_org, 'property_id', v_property_id, 'approval_request_id', p_request_id);
  perform private.write_contract_landlords(v_contract_id, p_org, v_contract->'landlords');

  -- 3) Locadores do imóvel = locadores do contrato (vínculos anteriores são
  --    encerrados por exclusão lógica, com o motivo registrado).
  v_reason := format('Locadores atualizados pelo cadastro do contrato %s.', btrim(v_contract->>'contract_number'));
  update public.property_landlords pl
     set deleted_at = now(), deleted_by = auth.uid(), deletion_reason = v_reason
   where pl.property_id = v_property_id and pl.deleted_at is null
     and not exists (select 1 from jsonb_array_elements(v_contract->'landlords') i
                     where (i->>'landlord_id')::uuid = pl.landlord_id);
  for v_item in select * from jsonb_array_elements(v_contract->'landlords') loop
    update public.property_landlords
       set share_percent = nullif(v_item->>'share_percent', '')::numeric
     where property_id = v_property_id and landlord_id = (v_item->>'landlord_id')::uuid and deleted_at is null;
    if not found then
      insert into public.property_landlords (organization_id, property_id, landlord_id, share_percent)
      values (p_org, v_property_id, (v_item->>'landlord_id')::uuid, nullif(v_item->>'share_percent', '')::numeric);
    end if;
  end loop;
  perform private.assert_landlord_shares('property_landlords', v_property_id);

  -- 4) Unidades consumidoras (opcional)
  for v_item in select * from jsonb_array_elements(coalesce(p_data->'units', '[]'::jsonb)) loop
    v_start := coalesce(nullif(v_item->>'start_date', '')::date, (v_contract->>'start_date')::date);
    if v_item->>'mode' = 'new' then
      begin
        insert into public.consumer_units (organization_id, supplier_id, identifier, complement, holder_name, meter_number, address, status, notes)
        values (p_org, (v_item->'data'->>'supplier_id')::uuid, upper(btrim(v_item->'data'->>'identifier')),
                nullif(btrim(v_item->'data'->>'complement'), ''), btrim(v_item->'data'->>'holder_name'),
                nullif(btrim(v_item->'data'->>'meter_number'), ''), nullif(btrim(v_item->'data'->>'address'), ''),
                'active', nullif(btrim(v_item->'data'->>'notes'), ''))
        returning id into v_unit_id;
      exception when unique_violation then
        raise exception 'A unidade % já está cadastrada para este fornecedor. Use a opção de vincular a unidade existente.',
          upper(btrim(v_item->'data'->>'identifier')) using errcode = '23505';
      end;
    elsif v_item->>'mode' = 'existing' then
      select u.id into v_unit_id from public.consumer_units u
      where u.id = (v_item->>'unit_id')::uuid and u.organization_id = p_org and u.deleted_at is null;
      if v_unit_id is null then
        raise exception 'Unidade consumidora não encontrada.' using errcode = 'P0002';
      end if;
      select * into v_open from public.unit_assignments a where a.unit_id = v_unit_id and a.end_date is null for update;
      if found then
        if v_open.property_id = v_property_id then
          continue; -- já vinculada a este imóvel
        end if;
        if v_start <= v_open.start_date then
          raise exception 'A transferência da unidade deve começar depois do início do vínculo atual (%).',
            to_char(v_open.start_date, 'DD/MM/YYYY') using errcode = '22023';
        end if;
        update public.unit_assignments set end_date = v_start - 1 where id = v_open.id;
      end if;
    else
      raise exception 'Item de unidade consumidora inválido.' using errcode = '22023';
    end if;
    begin
      insert into public.unit_assignments (organization_id, unit_id, property_id, start_date)
      values (p_org, v_unit_id, v_property_id, v_start);
    exception when exclusion_violation then
      raise exception 'O período de vinculação de uma unidade se sobrepõe a outro vínculo dela.' using errcode = '23P01';
    end;
  end loop;

  return v_contract_id;
end;
$$;

create or replace function private.apply_registration_package(p_request public.approval_requests)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.write_registration_package(p_request.organization_id, p_request.proposed_data, p_request.id);
end;
$$;

-- Envia o rascunho para aprovação: confere permissões e escopo, valida o pacote
-- inteiro (gravação real numa subtransação desfeita) e registra UMA solicitação.
create or replace function public.submit_registration_package(p_draft_id uuid, p_justification text)
returns public.approval_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.registration_drafts;
  v_data jsonb;
  v_dept uuid;
  v_item jsonb;
  v_request public.approval_requests;
begin
  select * into v_draft from public.registration_drafts d
  where d.id = p_draft_id and d.user_id = auth.uid() and d.organization_id = private.current_org_id()
  for update;
  if not found then
    raise exception 'Rascunho não encontrado.' using errcode = 'P0002';
  end if;
  if v_draft.status <> 'draft' then
    raise exception 'Este rascunho já foi enviado ou descartado.' using errcode = '22023';
  end if;

  v_data := jsonb_build_object(
    'property', v_draft.data->'property',
    'contract', v_draft.data->'contract',
    'units', coalesce(v_draft.data->'units', '[]'::jsonb));

  if v_data->'property'->>'mode' = 'new' then
    v_dept := nullif(v_data->'property'->'data'->>'department_id', '')::uuid;
    perform private.require_permission('properties.create', v_dept);
  elsif v_data->'property'->>'mode' = 'existing' then
    select p.department_id into v_dept from public.properties p
    where p.id = (v_data->'property'->>'id')::uuid and p.deleted_at is null and p.organization_id = private.current_org_id();
    if v_dept is null or not private.can_access_property((v_data->'property'->>'id')::uuid) then
      raise exception 'Imóvel não encontrado ou fora do seu escopo.' using errcode = 'P0002';
    end if;
  else
    raise exception 'Informe o imóvel do contrato.' using errcode = '22023';
  end if;
  perform private.require_permission('contracts.manage', v_dept);
  perform private.require_permission('landlords.view');
  if jsonb_array_length(v_data->'units') > 0 then
    perform private.require_permission('consumer_units.manage', v_dept);
    for v_item in select * from jsonb_array_elements(v_data->'units') loop
      if v_item->>'mode' = 'existing' and not private.can_access_unit((v_item->>'unit_id')::uuid) then
        raise exception 'Uma das unidades consumidoras está vinculada a um imóvel fora do seu escopo. Peça a um administrador para transferi-la.'
          using errcode = '42501';
      end if;
    end loop;
  end if;

  -- Validação completa (constraints e triggers reais), sem gravar nada.
  begin
    perform private.write_registration_package(private.current_org_id(), v_data, null);
    raise exception 'validation_ok' using errcode = 'P0099';
  exception when sqlstate 'P0099' then
    null;
  end;

  v_request := private.submit_approval_request('registration.package', null, v_dept, null, v_data, null, p_justification);
  update public.registration_drafts set status = 'submitted', approval_request_id = v_request.id where id = v_draft.id;
  return v_request;
end;
$$;

-- Reabre um rascunho cuja solicitação foi rejeitada, cancelada ou não efetivada.
create or replace function public.reopen_registration_draft(p_draft_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.approval_status;
begin
  select r.status into v_status
  from public.registration_drafts d join public.approval_requests r on r.id = d.approval_request_id
  where d.id = p_draft_id and d.user_id = auth.uid() and d.organization_id = private.current_org_id()
    and d.status = 'submitted';
  if v_status is null then
    raise exception 'Rascunho não encontrado.' using errcode = 'P0002';
  end if;
  if v_status::text not in ('rejected', 'cancelled', 'failed') then
    raise exception 'Só é possível reabrir um cadastro rejeitado, cancelado ou não efetivado.' using errcode = '22023';
  end if;
  update public.registration_drafts
     set status = 'draft', approval_request_id = null, current_step = 5
   where id = p_draft_id;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.find_landlord_by_document(text)',
    'public.find_similar_properties(text, text)',
    'public.find_consumer_unit(uuid, text)',
    'public.submit_registration_package(uuid, text)',
    'public.reopen_registration_draft(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
revoke all on function private.write_registration_package(uuid, jsonb, uuid) from public, anon, authenticated;
revoke all on function private.apply_registration_package(public.approval_requests) from public, anon, authenticated;
