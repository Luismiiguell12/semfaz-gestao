-- =============================================================================
-- SEMFAZ Gestão — Alteração 01 (parte 1): permissões próprias de unidades
-- consumidoras e permissão de relatórios financeiros.
-- Unidades consumidoras passam ao grupo Gestão: `utilities.view/manage` são
-- substituídas por `consumer_units.view/manage`, com os MESMOS perfis que tinham
-- as antigas (sem ampliar nem reduzir acessos). `finance.reports.view` é
-- concedida aos perfis que já viam os indicadores financeiros (`invoices.view`).
-- =============================================================================
insert into public.permissions (code, module, description, is_privileged) values
  ('consumer_units.view',   'consumer_units', 'Consultar unidades consumidoras', false),
  ('consumer_units.manage', 'consumer_units', 'Cadastrar unidades consumidoras e vínculos', false),
  ('finance.reports.view',  'finance',        'Consultar relatórios de despesas', false)
on conflict (code) do update
  set module = excluded.module, description = excluded.description, is_privileged = excluded.is_privileged;

-- Perfis: mesma concessão das permissões antigas.
insert into public.role_permissions (role_id, permission_code, organization_id)
select rp.role_id, case rp.permission_code when 'utilities.view' then 'consumer_units.view' else 'consumer_units.manage' end,
       rp.organization_id
from public.role_permissions rp
where rp.permission_code in ('utilities.view', 'utilities.manage')
on conflict (role_id, permission_code) do nothing;

insert into public.role_permissions (role_id, permission_code, organization_id)
select rp.role_id, 'finance.reports.view', rp.organization_id
from public.role_permissions rp
where rp.permission_code = 'invoices.view'
on conflict (role_id, permission_code) do nothing;

-- Funções que verificavam as permissões antigas: recriadas com os novos códigos
-- (mesmo corpo, privilégios preservados pelo CREATE OR REPLACE).
do $$
declare
  r record;
  v_def text;
begin
  for r in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and (p.prosrc like '%''utilities.view''%' or p.prosrc like '%''utilities.manage''%')
  loop
    v_def := pg_get_functiondef(r.oid);
    v_def := replace(v_def, '''utilities.view''', '''consumer_units.view''');
    v_def := replace(v_def, '''utilities.manage''', '''consumer_units.manage''');
    execute v_def;
  end loop;
end;
$$;

-- Políticas que usavam as permissões antigas (mesma regra, novo código).
drop policy consumer_units_select on public.consumer_units;
create policy consumer_units_select on public.consumer_units
  for select to authenticated
  using (deleted_at is null and private.has_permission('consumer_units.view') and private.can_access_unit(id));

drop policy unit_assignments_select on public.unit_assignments;
create policy unit_assignments_select on public.unit_assignments
  for select to authenticated
  using (private.has_permission('consumer_units.view') and private.can_access_property(property_id));

drop policy consumption_records_select on public.consumption_records;
create policy consumption_records_select on public.consumption_records
  for select to authenticated
  using ((private.has_permission('consumer_units.view') or private.has_permission('invoices.view')) and private.can_access_unit(unit_id));

-- Remove as permissões antigas (concessões são configuração de acesso; a
-- remoção fica registrada na auditoria pelos triggers de role_permissions).
delete from public.role_permissions where permission_code in ('utilities.view', 'utilities.manage');
delete from public.permissions where code in ('utilities.view', 'utilities.manage');
