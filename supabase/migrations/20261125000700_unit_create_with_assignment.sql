-- =============================================================================
-- SEMFAZ Gestão — Fase 3 (ajuste)
-- O cadastro de unidade consumidora passa a exigir o imóvel e a data de
-- vinculação, gravados na mesma transação. Sem isso, uma unidade recém-criada
-- ficava fora do escopo de quem não tem acesso à organização inteira.
-- =============================================================================
create or replace function public.save_consumer_unit(p_unit_id uuid, p_data jsonb, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_property uuid := nullif(p_data->>'property_id', '')::uuid;
  v_start date := nullif(p_data->>'start_date', '')::date;
  v_dept uuid;
begin
  perform private.require_permission('utilities.manage');
  if p_unit_id is null then
    if v_property is null or v_start is null then
      raise exception 'Informe o imóvel e a data de vinculação da unidade.' using errcode = '22023';
    end if;
    select department_id into v_dept from public.properties
    where id = v_property and deleted_at is null and organization_id = private.current_org_id();
    if v_dept is null or not private.can_access_property(v_property) then
      raise exception 'Imóvel não encontrado ou fora do seu escopo.' using errcode = 'P0002';
    end if;
    perform private.require_permission('utilities.manage', v_dept);

    insert into public.consumer_units (organization_id, supplier_id, identifier, complement, holder_name, meter_number, address, status, notes)
    values (private.current_org_id(), (p_data->>'supplier_id')::uuid, upper(btrim(p_data->>'identifier')),
            nullif(btrim(p_data->>'complement'), ''), btrim(p_data->>'holder_name'), nullif(btrim(p_data->>'meter_number'), ''),
            nullif(btrim(p_data->>'address'), ''), coalesce(nullif(p_data->>'status', ''), 'active')::public.unit_status,
            nullif(btrim(p_data->>'notes'), ''))
    returning id into v_id;
    insert into public.unit_assignments (organization_id, unit_id, property_id, start_date)
    values (private.current_org_id(), v_id, v_property, v_start);
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
