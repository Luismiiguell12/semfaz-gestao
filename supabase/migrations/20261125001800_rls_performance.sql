-- =============================================================================
-- SEMFAZ Gestão — Fase 7: desempenho das políticas RLS (mesmas regras de acesso).
--
-- Achado da varredura de telas: com ~200 aluguéis, o Relatório de despesas levava
-- 11 s. As políticas chamavam private.can_access_property(property_id) para CADA
-- linha, refazendo a verificação de escopo (secretaria, subárvore, imóveis
-- selecionados) linha a linha.
--
-- Correção (recomendação de desempenho de RLS do Supabase): o conjunto de imóveis
-- e unidades acessíveis é calculado UMA vez por consulta, dentro de (select ...),
-- que o PostgreSQL executa como InitPlan. Os critérios são exatamente os de
-- can_access_property / can_access_unit, que continuam existindo para as
-- verificações de um único registro nas funções do banco.
-- =============================================================================

-- Imóveis acessíveis ao usuário atual: mesma regra de can_access_property.
create or replace function private.accessible_property_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.id), '{}')
  from public.properties p
  where p.organization_id = private.current_org_id()
    and (
      private.department_in_scope(p.department_id)
      or exists (select 1 from public.user_property_access upa where upa.property_id = p.id and upa.user_id = (select auth.uid()))
    );
$$;

-- Unidades consumidoras acessíveis: mesma regra de can_access_unit.
create or replace function private.accessible_unit_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(u.id), '{}')
  from public.consumer_units u
  where u.organization_id = private.current_org_id()
    and (
      private.has_org_wide_scope()
      or exists (select 1 from public.unit_assignments a
                  where a.unit_id = u.id and a.property_id = any (private.accessible_property_ids()))
    );
$$;

revoke all on function private.accessible_property_ids() from public, anon;
revoke all on function private.accessible_unit_ids() from public, anon;
grant execute on function private.accessible_property_ids() to authenticated;
grant execute on function private.accessible_unit_ids() to authenticated;

-- Políticas reescritas: (select ...) = avaliado uma vez por consulta.
drop policy properties_select on public.properties;
create policy properties_select on public.properties for select to authenticated using (
  deleted_at is null
  and (select private.has_permission('properties.view'))
  and id = any ((select private.accessible_property_ids())::uuid[])
);

drop policy contracts_select on public.contracts;
create policy contracts_select on public.contracts for select to authenticated using (
  deleted_at is null
  and (select private.has_permission('contracts.view'))
  and property_id = any ((select private.accessible_property_ids())::uuid[])
);

drop policy invoices_select on public.invoices;
create policy invoices_select on public.invoices for select to authenticated using (
  deleted_at is null
  and (select private.has_permission('invoices.view'))
  and property_id = any ((select private.accessible_property_ids())::uuid[])
);

drop policy rent_charges_select on public.rent_charges;
create policy rent_charges_select on public.rent_charges for select to authenticated using (
  (select private.has_permission('invoices.view'))
  and property_id = any ((select private.accessible_property_ids())::uuid[])
);

drop policy property_landlords_select on public.property_landlords;
create policy property_landlords_select on public.property_landlords for select to authenticated using (
  deleted_at is null
  and (select private.has_permission('landlords.view'))
  and property_id = any ((select private.accessible_property_ids())::uuid[])
);

drop policy unit_assignments_select on public.unit_assignments;
create policy unit_assignments_select on public.unit_assignments for select to authenticated using (
  (select private.has_permission('consumer_units.view'))
  and property_id = any ((select private.accessible_property_ids())::uuid[])
);

drop policy consumer_units_select on public.consumer_units;
create policy consumer_units_select on public.consumer_units for select to authenticated using (
  deleted_at is null
  and (select private.has_permission('consumer_units.view'))
  and id = any ((select private.accessible_unit_ids())::uuid[])
);

drop policy consumption_records_select on public.consumption_records;
create policy consumption_records_select on public.consumption_records for select to authenticated using (
  ((select private.has_permission('consumer_units.view')) or (select private.has_permission('invoices.view')))
  and unit_id = any ((select private.accessible_unit_ids())::uuid[])
);

drop policy landlords_select on public.landlords;
create policy landlords_select on public.landlords for select to authenticated using (
  organization_id = (select private.current_org_id())
  and deleted_at is null
  and (select private.has_permission('landlords.view'))
);

drop policy contract_landlords_select on public.contract_landlords;
create policy contract_landlords_select on public.contract_landlords for select to authenticated using (
  deleted_at is null
  and (select private.has_permission('landlords.view'))
  and exists (select 1 from public.contracts c where c.id = contract_landlords.contract_id)
);
