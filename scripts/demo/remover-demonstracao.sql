-- =============================================================================
-- SEMFAZ Gestão — REMOÇÃO da carga de demonstração (somente HOMOLOGAÇÃO / local).
--
-- Remove os registros criados por scripts/demo/carga-demonstracao.sql e tudo o que
-- deriva deles (aluguéis, faturas, pagamentos, alertas, notificações, solicitações
-- e o que for criado a partir delas, como um imóvel aprovado na demonstração).
--
-- Segurança: as chaves estrangeiras continuam ativas. Só os bloqueios de exclusão
-- física das tabelas envolvidas são suspensos, dentro desta transação. Se algum
-- registro REAL estiver ligado a um fictício (ex.: demanda real com responsável
-- fictício), o banco recusa e NADA é removido.
-- A auditoria (imutável) mantém o registro da carga e da remoção.
-- Arquivos anexados a registros fictícios: os metadados são removidos e os caminhos
-- dos arquivos são listados (avisos) para remoção pelo painel do Supabase.
-- =============================================================================
begin;

create temporary table demo_ids (kind text, id uuid) on commit drop;
insert into demo_ids select 'user', id from public.profiles where id::text like 'd2000000-%';
insert into demo_ids select 'dept', id from public.departments where id::text like 'd1000000-%';
insert into demo_ids select 'landlord', id from public.landlords where id::text like 'd3000000-%';
insert into demo_ids select 'unit', id from public.consumer_units where id::text like 'd6000000-%';
insert into demo_ids select 'task', id from public.tasks where id::text like 'd7000000-%';

do $$
begin
  if not exists (select 1 from demo_ids) then
    raise exception 'Não há carga de demonstração neste banco (nada foi alterado).';
  end if;
end $$;

-- Solicitações feitas por pessoas fictícias e o que foi criado a partir delas.
insert into demo_ids select 'request', id from public.approval_requests where requested_by in (select id from demo_ids where kind = 'user');
insert into demo_ids select 'property', id from public.properties
  where id::text like 'd4000000-%' or approval_request_id in (select id from demo_ids where kind = 'request');
insert into demo_ids select 'contract', id from public.contracts
  where id::text like 'd5000000-%' or property_id in (select id from demo_ids where kind = 'property');
insert into demo_ids select 'invoice', id from public.invoices where unit_id in (select id from demo_ids where kind = 'unit');
insert into demo_ids select 'rent', id from public.rent_charges where contract_id in (select id from demo_ids where kind = 'contract');
insert into demo_ids select 'event', id from public.task_events
  where id::text like 'd8000000-%' or task_id in (select id from demo_ids where kind = 'task');
-- Solicitações (de qualquer pessoa) sobre registros fictícios.
insert into demo_ids select 'request', r.id from public.approval_requests r
  where (r.entity_id in (select id from demo_ids) or r.result_entity_id in (select id from demo_ids)
         or r.proposed_data->>'invoice_id' in (select id::text from demo_ids where kind = 'invoice')
         or r.proposed_data->>'rent_charge_id' in (select id::text from demo_ids where kind = 'rent'))
    and r.id not in (select id from demo_ids where kind = 'request');

-- Suspende só os bloqueios de exclusão física/imutabilidade nesta transação.
create temporary table demo_triggers (tbl text, trg text) on commit drop;
insert into demo_triggers
select c.relname, t.tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_proc p on p.oid = t.tgfoid
where c.relnamespace = 'public'::regnamespace and not t.tgisinternal and t.tgenabled <> 'D'
  and p.proname in ('tg_prevent_physical_delete', 'tg_immutable_row')
  and c.relname in ('alerts', 'approval_decisions', 'approval_requests', 'consumer_units', 'contract_amendments', 'contract_landlords',
                    'contracts', 'departments', 'documents', 'invoices', 'landlords', 'payments', 'productivity_snapshots', 'profiles',
                    'properties', 'property_landlords', 'rent_charges', 'task_comments', 'task_events', 'task_status_history', 'tasks',
                    'unit_assignments', 'registration_drafts');
do $$ declare r record; begin
  for r in select * from demo_triggers loop execute format('alter table public.%I disable trigger %I', r.tbl, r.trg); end loop;
end $$;

-- Ordem: dos registros dependentes para os principais.
delete from public.notifications where user_id in (select id from demo_ids where kind = 'user') or entity_id in (select id from demo_ids);
delete from public.alerts where entity_id in (select id from demo_ids);
-- O Supabase não permite apagar arquivos do Storage por SQL: lista os que ficam
-- para remoção pelo painel (Storage → documents).
do $$ declare r record; begin
  for r in select storage_path from public.documents where entity_id in (select id from demo_ids) loop
    raise notice 'Arquivo de demonstração a apagar pelo painel do Storage: documents/%', r.storage_path;
  end loop;
end $$;
delete from public.documents where entity_id in (select id from demo_ids);
delete from public.approval_decisions where request_id in (select id from demo_ids where kind = 'request');
delete from public.approval_steps where request_id in (select id from demo_ids where kind = 'request');
delete from public.payments where invoice_id in (select id from demo_ids where kind = 'invoice')
                               or rent_charge_id in (select id from demo_ids where kind = 'rent');
delete from public.consumption_records where unit_id in (select id from demo_ids where kind = 'unit');
delete from public.invoices where id in (select id from demo_ids where kind = 'invoice');
delete from public.rent_charges where id in (select id from demo_ids where kind = 'rent');
delete from public.unit_assignments where unit_id in (select id from demo_ids where kind = 'unit')
                                       or property_id in (select id from demo_ids where kind = 'property');
delete from public.consumer_units where id in (select id from demo_ids where kind = 'unit');
delete from public.contract_amendments where contract_id in (select id from demo_ids where kind = 'contract');
delete from public.contract_landlords where contract_id in (select id from demo_ids where kind = 'contract');
delete from public.contracts where id in (select id from demo_ids where kind = 'contract');
delete from public.property_landlords where property_id in (select id from demo_ids where kind = 'property')
                                         or landlord_id in (select id from demo_ids where kind = 'landlord');
delete from public.properties where id in (select id from demo_ids where kind = 'property');
delete from public.landlords where id in (select id from demo_ids where kind = 'landlord');
delete from public.task_event_attendees where event_id in (select id from demo_ids where kind = 'event')
                                          or user_id in (select id from demo_ids where kind = 'user');
delete from public.task_events where id in (select id from demo_ids where kind = 'event');
delete from public.task_comments where task_id in (select id from demo_ids where kind = 'task');
delete from public.task_status_history where task_id in (select id from demo_ids where kind = 'task');
delete from public.task_assignees where task_id in (select id from demo_ids where kind = 'task');
delete from public.tasks where id in (select id from demo_ids where kind = 'task');
delete from public.approval_requests where id in (select id from demo_ids where kind = 'request');
delete from public.productivity_snapshots where user_id in (select id from demo_ids where kind = 'user');
delete from public.user_department_access where user_id in (select id from demo_ids where kind = 'user');
delete from public.user_property_access where user_id in (select id from demo_ids where kind = 'user');
delete from public.user_roles where user_id in (select id from demo_ids where kind = 'user');
delete from public.notifications where user_id in (select id from demo_ids where kind = 'user');
delete from public.profiles where id in (select id from demo_ids where kind = 'user');
delete from auth.users where id in (select id from demo_ids where kind = 'user');
delete from public.departments where id in (select id from demo_ids where kind = 'dept') and parent_id is not null;
delete from public.departments where id in (select id from demo_ids where kind = 'dept');

do $$ declare r record; begin
  for r in select * from demo_triggers loop execute format('alter table public.%I enable trigger %I', r.tbl, r.trg); end loop;
end $$;

select 'Carga de demonstração removida' as resultado,
  (select count(*) from demo_ids where kind = 'property') as imoveis,
  (select count(*) from demo_ids where kind = 'contract') as contratos,
  (select count(*) from demo_ids where kind = 'invoice') as faturas,
  (select count(*) from demo_ids where kind = 'task') as demandas,
  (select count(*) from demo_ids where kind = 'user') as pessoas,
  (select count(*) from public.profiles where id::text like 'd2000000-%')
    + (select count(*) from public.properties where id::text like 'd4000000-%')
    + (select count(*) from public.departments where id::text like 'd1000000-%') as restantes;
commit;
