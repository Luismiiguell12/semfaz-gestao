-- Alteração 01: cadastro guiado a partir do contrato, rascunhos, duplicidades,
-- pacote de aprovação (tudo ou nada) e permissões próprias de unidades consumidoras.
begin;
\ir _helpers.psql
select plan(39);

-- Permissão concedida ao usuário pelos seus perfis (sem depender da sessão).
create function tests.user_has(p_user uuid, p_code text) returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id = ur.role_id
                 where ur.user_id = p_user and rp.permission_code = p_code);
$$;

select tests.create_user('cw_admin1', array['admin']) as admin1 \gset
select tests.create_user('cw_admin2', array['admin']) as admin2 \gset
select tests.create_user('cw_gestor', array['manager']) as gestor \gset
select tests.create_user('cw_colab', array['collaborator']) as colab \gset
select tests.create_user('cw_consulta', array['viewer']) as consulta \gset
select tests.create_user('cw_fora', array['manager']) as fora \gset
select tests.enroll_mfa(:'admin1');
select tests.enroll_mfa(:'admin2');
insert into public.departments (id, organization_id, kind, name) values
  ('91000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', 'secretariat', 'Secretaria Fora Cadastro');
insert into public.user_department_access (organization_id, user_id, department_id) values
  ('00000000-0000-4000-8000-000000000001', :'gestor', '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000000001', :'colab', '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000000001', :'consulta', '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000000001', :'fora', '91000000-0000-4000-8000-000000000009');

-- Imóveis já existentes (renovação) e unidade vinculada a outro imóvel.
insert into public.properties (id, organization_id, name, street, address_number, district, postal_code, city, state, department_id, purpose) values
  ('91000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Imóvel Renovação', 'Rua R', '10', 'Centro', '49400-100', 'Lagarto', 'SE', '00000000-0000-4000-8000-000000000101', 'Teste'),
  ('91000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Imóvel Antigo da UC', 'Rua U', '20', 'Centro', '49400-200', 'Lagarto', 'SE', '00000000-0000-4000-8000-000000000101', 'Teste'),
  ('91000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Imóvel Fora do Escopo', 'Rua F', '30', 'Centro', '49400-300', 'Lagarto', 'SE', '91000000-0000-4000-8000-000000000009', 'Teste');
select id as energisa from public.suppliers where name = 'Energisa' \gset
select id as igua from public.suppliers where name = 'Iguá' \gset
insert into public.consumer_units (id, organization_id, supplier_id, identifier, holder_name) values
  ('91000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', :'energisa', 'UC-ANTIGA', 'Titular Teste'),
  ('91000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', :'igua', 'MAT-FORA', 'Titular Teste');
insert into public.unit_assignments (organization_id, unit_id, property_id, start_date) values
  ('00000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000011', '91000000-0000-4000-8000-000000000002', '2026-01-01'),
  ('00000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000012', '91000000-0000-4000-8000-000000000003', '2026-01-01');

-- ------------------------------------------------------------ Permissões (Alteração 01)
select is((select count(*)::int from public.permissions where code like 'utilities.%'), 0, 'Permissões antigas utilities.* removidas do catálogo');
select is((select count(*)::int from pg_proc where prosrc like '%''utilities.%'), 0, 'Nenhuma função verifica as permissões antigas');
select ok(tests.user_has(:'gestor', 'consumer_units.manage') and tests.user_has(:'gestor', 'consumer_units.view'),
  'Gestor mantém consultar e cadastrar unidades');
select ok(tests.user_has(:'colab', 'consumer_units.view') and not tests.user_has(:'colab', 'consumer_units.manage'),
  'Colaborador continua só consultando unidades');
select ok(tests.user_has(:'consulta', 'consumer_units.view') and not tests.user_has(:'consulta', 'consumer_units.manage'),
  'Consulta continua só consultando unidades');
select ok(tests.user_has(:'consulta', 'finance.reports.view') and tests.user_has(:'colab', 'finance.reports.view'),
  'Relatórios de despesas para quem já via os indicadores financeiros');

-- ------------------------------------------------------------ Locadores e duplicidades
set local role authenticated;
select tests.set_claims(:'gestor');
select public.save_landlord(null, jsonb_build_object('person_type', 'individual', 'name', 'Locador Assistente Teste', 'document', '529.982.247-25')) as ll1 \gset
select throws_ok($$select public.save_landlord(null, '{"person_type":"individual","name":"Outro Nome","document":"52998224725"}')$$,
  '23505', null, 'CPF já cadastrado não gera duplicidade');
select is((select name from public.find_landlord_by_document('529.982.247-25')), 'Locador Assistente Teste', 'Busca por CPF devolve o cadastro existente');
select is((select document_masked from public.find_landlord_by_document('52998224725')) <> '52998224725', true, 'Documento devolvido mascarado');
select public.save_landlord(null, jsonb_build_object('person_type', 'company', 'name', 'Empresa Locadora Teste', 'document', '11.222.333/0001-81')) as ll2 \gset

select is(jsonb_array_length(public.find_similar_properties('49400-100', '10')->'matches'), 1, 'Possível duplicidade de imóvel (mesmo CEP e número)');
select tests.set_claims(:'fora');
select is((public.find_similar_properties('49400-100', '10')->>'restricted_count')::int, 1, 'Imóvel fora do escopo aparece só na contagem');
select tests.set_claims(:'gestor');
select is(public.find_consumer_unit(:'energisa', 'uc-antiga')->>'current_property_name', 'Imóvel Antigo da UC', 'Busca de UC mostra o vínculo atual');
select is(public.find_consumer_unit(:'igua', 'MAT-FORA')->>'accessible', 'false', 'UC de imóvel fora do escopo: apenas indicação de acesso restrito');

-- ------------------------------------------------------------ Rascunhos (RLS)
insert into public.registration_drafts (organization_id, user_id, data) values
  ('00000000-0000-4000-8000-000000000001', :'gestor', '{}') returning id as d_rej \gset
select tests.set_claims(:'colab');
select is((select count(*)::int from public.registration_drafts), 0, 'Rascunho visível somente para o autor');
select throws_ok(format($$insert into public.registration_drafts (organization_id, user_id, data) values ('00000000-0000-4000-8000-000000000001', %L, '{}')$$, :'gestor'),
  '42501', null, 'Não é possível criar rascunho em nome de outro usuário');
select tests.set_claims(:'consulta');
select throws_ok(format($$insert into public.registration_drafts (organization_id, user_id, data) values ('00000000-0000-4000-8000-000000000001', %L, '{}')$$, :'consulta'),
  '42501', null, 'Sem contracts.manage não há assistente');

-- ------------------------------------------------------------ Pacote 1: tudo novo
select tests.set_claims(:'gestor');
insert into public.registration_drafts (organization_id, user_id, current_step, data) values
  ('00000000-0000-4000-8000-000000000001', :'gestor', 5, jsonb_build_object(
    'property', jsonb_build_object('mode', 'new', 'data', jsonb_build_object(
      'name', 'Imóvel Novo do Assistente', 'street', 'Rua Nova', 'address_number', '99', 'district', 'Centro',
      'postal_code', '49400-999', 'city', 'Lagarto', 'state', 'SE',
      'department_id', '00000000-0000-4000-8000-000000000101', 'purpose', 'Sede de teste')),
    'contract', jsonb_build_object('contract_number', 'CT-ASSIST-1', 'object', 'Locação de teste do assistente',
      'signed_on', '2026-01-05', 'start_date', '2026-01-10', 'end_date', '2026-12-31',
      'monthly_value', '1000.00', 'global_value', '12000.00',
      'landlords', jsonb_build_array(jsonb_build_object('landlord_id', :'ll1', 'share_percent', 60), jsonb_build_object('landlord_id', :'ll2', 'share_percent', 40))),
    'units', jsonb_build_array(
      jsonb_build_object('mode', 'new', 'data', jsonb_build_object('supplier_id', :'energisa', 'identifier', 'uc-nova-1', 'holder_name', 'Prefeitura Teste')),
      jsonb_build_object('mode', 'new', 'start_date', '2026-02-01', 'data', jsonb_build_object('supplier_id', :'igua', 'identifier', 'mat-nova-1', 'holder_name', 'Prefeitura Teste', 'address', 'Rua Nova, 99')))))
  returning id as d1 \gset
select (public.submit_registration_package(:'d1', 'Novo contrato de locação recebido pela SEMFAZ')).id as r1 \gset
select is((select status::text from public.approval_requests where id = :'r1'), 'pending', 'Pacote gera UMA solicitação pendente');
select is((select status from public.registration_drafts where id = :'d1'), 'submitted', 'Rascunho marcado como enviado');
reset role;
select is((select count(*)::int from public.properties where name = 'Imóvel Novo do Assistente')
        + (select count(*)::int from public.contracts where contract_number = 'CT-ASSIST-1')
        + (select count(*)::int from public.consumer_units where identifier in ('UC-NOVA-1', 'MAT-NOVA-1')), 0,
  'Nada é criado antes da aprovação');
set local role authenticated;

select tests.set_claims(:'admin2', 'aal2');
select is((public.decide_approval(:'r1', 'approved')).status::text, 'approved', 'Administrador aprova o pacote');
reset role;
select id as p1 from public.properties where name = 'Imóvel Novo do Assistente' \gset
select is((select property_id from public.contracts where contract_number = 'CT-ASSIST-1'), :'p1'::uuid, 'Contrato criado no imóvel novo');
select is((select count(*)::int from public.property_landlords where property_id = :'p1' and deleted_at is null), 2, 'Locadores vinculados ao imóvel');
select is((select count(*)::int from public.unit_assignments a join public.consumer_units u on u.id = a.unit_id
           where a.property_id = :'p1' and a.end_date is null), 2, 'Unidades novas vinculadas ao imóvel');
select is((select a.start_date from public.unit_assignments a join public.consumer_units u on u.id = a.unit_id where u.identifier = 'UC-NOVA-1'),
  '2026-01-10'::date, 'Data de vinculação padrão = início da vigência');
select is((select result_entity_id from public.approval_requests where id = :'r1'),
  (select id from public.contracts where contract_number = 'CT-ASSIST-1'), 'Solicitação aponta para o contrato criado');
set local role authenticated;

-- ------------------------------------------------------------ Pacote 2: renovação (existentes) + transferência
select tests.set_claims(:'gestor');
select throws_ok(format($$select public.submit_registration_package(%L, 'x')$$, :'d1'), '22023', null, 'Rascunho enviado não é reenviado');
insert into public.registration_drafts (organization_id, user_id, data) values
  ('00000000-0000-4000-8000-000000000001', :'gestor', jsonb_build_object(
    'property', jsonb_build_object('mode', 'existing', 'id', '91000000-0000-4000-8000-000000000001'),
    'contract', jsonb_build_object('contract_number', 'CT-RENOV-1', 'object', 'Renovação da locação de teste',
      'signed_on', '2026-03-01', 'start_date', '2026-03-01', 'end_date', '2027-02-28', 'monthly_value', '1500.00', 'global_value', '18000.00',
      'landlords', jsonb_build_array(jsonb_build_object('landlord_id', :'ll1'))),
    'units', jsonb_build_array(jsonb_build_object('mode', 'existing', 'unit_id', '91000000-0000-4000-8000-000000000011', 'start_date', '2026-03-01'))))
  returning id as d2 \gset
select (public.submit_registration_package(:'d2', 'Renovação do contrato com transferência da UC')).id as r2 \gset
select tests.set_claims(:'admin2', 'aal2');
select is((public.decide_approval(:'r2', 'approved')).status::text, 'approved', 'Renovação aprovada');
reset role;
select is((select count(*)::int from public.unit_assignments where unit_id = '91000000-0000-4000-8000-000000000011'), 2, 'Transferência preserva o histórico de vínculos');
select is((select end_date from public.unit_assignments where unit_id = '91000000-0000-4000-8000-000000000011' and property_id = '91000000-0000-4000-8000-000000000002'),
  '2026-02-28'::date, 'Vínculo anterior encerrado na véspera da transferência');
select is((select count(*)::int from public.contracts where property_id = '91000000-0000-4000-8000-000000000001'), 1, 'Contrato de renovação no imóvel existente');
set local role authenticated;

-- ------------------------------------------------------------ Validações no envio
select tests.set_claims(:'gestor');
insert into public.registration_drafts (organization_id, user_id, data) values
  ('00000000-0000-4000-8000-000000000001', :'gestor', jsonb_build_object(
    'property', jsonb_build_object('mode', 'existing', 'id', '91000000-0000-4000-8000-000000000001'),
    'contract', jsonb_build_object('contract_number', 'CT-DUP-UC', 'object', 'Contrato com UC duplicada',
      'signed_on', '2026-03-01', 'start_date', '2026-03-01', 'end_date', '2027-02-28', 'monthly_value', '100.00', 'global_value', '1200.00',
      'landlords', jsonb_build_array(jsonb_build_object('landlord_id', :'ll1'))),
    'units', jsonb_build_array(jsonb_build_object('mode', 'new', 'data', jsonb_build_object('supplier_id', :'energisa', 'identifier', 'UC-NOVA-1', 'holder_name', 'Titular Teste')))))
  returning id as d3 \gset
select throws_ok(format($$select public.submit_registration_package(%L, 'Teste de UC duplicada no pacote')$$, :'d3'),
  '23505', null, 'Número de UC já existente é bloqueado no envio');
insert into public.registration_drafts (organization_id, user_id, data) values
  ('00000000-0000-4000-8000-000000000001', :'gestor', jsonb_build_object(
    'property', jsonb_build_object('mode', 'existing', 'id', '91000000-0000-4000-8000-000000000001'),
    'contract', jsonb_build_object('contract_number', 'CT-FORA', 'object', 'Contrato com UC fora do escopo',
      'signed_on', '2026-03-01', 'start_date', '2026-03-01', 'end_date', '2027-02-28', 'monthly_value', '100.00', 'global_value', '1200.00',
      'landlords', jsonb_build_array(jsonb_build_object('landlord_id', :'ll1'))),
    'units', jsonb_build_array(jsonb_build_object('mode', 'existing', 'unit_id', '91000000-0000-4000-8000-000000000012', 'start_date', '2026-04-01'))))
  returning id as d4 \gset
select throws_ok(format($$select public.submit_registration_package(%L, 'Teste de UC fora do escopo')$$, :'d4'),
  '42501', null, 'Não transfere unidade de imóvel fora do escopo');

-- ------------------------------------------------------------ Autoaprovação, rejeição e tudo-ou-nada
select tests.set_claims(:'admin1', 'aal2');
insert into public.registration_drafts (organization_id, user_id, data) values
  ('00000000-0000-4000-8000-000000000001', :'admin1', jsonb_build_object(
    'property', jsonb_build_object('mode', 'new', 'data', jsonb_build_object(
      'name', 'Imóvel Rejeitado Teste', 'street', 'Rua Rejeição', 'address_number', '1', 'district', 'Centro',
      'postal_code', '49400-111', 'city', 'Lagarto', 'state', 'SE', 'department_id', '00000000-0000-4000-8000-000000000101', 'purpose', 'Teste')),
    'contract', jsonb_build_object('contract_number', 'CT-REJ-1', 'object', 'Contrato a ser rejeitado',
      'signed_on', '2026-03-01', 'start_date', '2026-03-01', 'end_date', '2027-02-28', 'monthly_value', '100.00', 'global_value', '1200.00',
      'landlords', jsonb_build_array(jsonb_build_object('landlord_id', :'ll2')))))
  returning id as d5 \gset
select (public.submit_registration_package(:'d5', 'Pacote enviado pelo próprio administrador')).id as r5 \gset
select throws_ok(format($$select public.decide_approval(%L, 'approved')$$, :'r5'), '42501', null, 'Autoaprovação do pacote bloqueada');
select tests.set_claims(:'admin2', 'aal2');
select is((public.decide_approval(:'r5', 'rejected', 'Contrato com dados divergentes do processo')).status::text, 'rejected', 'Pacote rejeitado');
reset role;
select is((select count(*)::int from public.properties where name = 'Imóvel Rejeitado Teste') + (select count(*)::int from public.contracts where contract_number = 'CT-REJ-1'),
  0, 'Rejeição: nenhum registro do pacote é criado');
select is((select count(*)::int from public.landlords where id = :'ll2'), 1, 'Locador cadastrado no assistente permanece');
set local role authenticated;
select tests.set_claims(:'admin1', 'aal2');
select lives_ok(format($$select public.reopen_registration_draft(%L)$$, :'d5'), 'Rascunho rejeitado pode ser reaberto');

-- Tudo ou nada: depois do envio, outra pessoa cadastra a mesma UC; a efetivação falha inteira.
select tests.set_claims(:'gestor');
insert into public.registration_drafts (organization_id, user_id, data) values
  ('00000000-0000-4000-8000-000000000001', :'gestor', jsonb_build_object(
    'property', jsonb_build_object('mode', 'new', 'data', jsonb_build_object(
      'name', 'Imóvel Tudo ou Nada', 'street', 'Rua Atomica', 'address_number', '7', 'district', 'Centro',
      'postal_code', '49400-777', 'city', 'Lagarto', 'state', 'SE', 'department_id', '00000000-0000-4000-8000-000000000101', 'purpose', 'Teste')),
    'contract', jsonb_build_object('contract_number', 'CT-ATOM-1', 'object', 'Contrato do teste tudo ou nada',
      'signed_on', '2026-03-01', 'start_date', '2026-03-01', 'end_date', '2027-02-28', 'monthly_value', '100.00', 'global_value', '1200.00',
      'landlords', jsonb_build_array(jsonb_build_object('landlord_id', :'ll1'))),
    'units', jsonb_build_array(jsonb_build_object('mode', 'new', 'data', jsonb_build_object('supplier_id', :'energisa', 'identifier', 'UC-CORRIDA', 'holder_name', 'Titular Teste')))))
  returning id as d6 \gset
select (public.submit_registration_package(:'d6', 'Pacote para testar efetivação atômica')).id as r6 \gset
select public.save_consumer_unit(null, jsonb_build_object('supplier_id', :'energisa', 'identifier', 'UC-CORRIDA', 'holder_name', 'Titular Outro',
  'property_id', '91000000-0000-4000-8000-000000000001', 'start_date', '2026-03-01')) is not null as uc_ok \gset
select tests.set_claims(:'admin2', 'aal2');
select is((public.decide_approval(:'r6', 'approved')).status::text, 'failed', 'Conflito na efetivação: solicitação "não efetivada"');
reset role;
select is((select count(*)::int from public.properties where name = 'Imóvel Tudo ou Nada') + (select count(*)::int from public.contracts where contract_number = 'CT-ATOM-1'),
  0, 'Efetivação transacional: nada do pacote foi criado');

select * from finish();
rollback;
