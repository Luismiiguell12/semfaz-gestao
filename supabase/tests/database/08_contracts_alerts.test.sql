-- Contratos, aditivos (vigência/valor efetivos), alertas e documentos contratuais.
begin;
\ir _helpers.psql
select plan(27);

select tests.create_user('ct_admin', array['admin']) as admin \gset
select tests.create_user('ct_gestor', array['manager']) as gestor \gset
select tests.create_user('ct_consulta', array['viewer']) as consulta \gset
select tests.create_user('ct_fora', array['manager']) as fora \gset
select tests.enroll_mfa(:'admin');
insert into public.user_department_access (organization_id, user_id, department_id) values
  ('00000000-0000-4000-8000-000000000001', :'gestor', '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000000001', :'consulta', '00000000-0000-4000-8000-000000000101');

-- Imóvel e locadores de apoio (inseridos diretamente pelo dono do banco).
insert into public.properties (id, organization_id, name, street, address_number, district, postal_code, city, state, department_id, purpose)
values ('60000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Imóvel Contrato Teste', 'Rua Teste', '10',
        'Centro', '49400-000', 'Lagarto', 'SE', '00000000-0000-4000-8000-000000000101', 'Teste de contratos');
insert into public.landlords (id, organization_id, person_type, name, document) values
  ('61000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'individual', 'Locador Teste A', '52998224725'),
  ('61000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'company', 'Locadora Teste B', '11222333000181');

select private.today_local() as today \gset

set local role authenticated;
select tests.set_claims(:'gestor');

-- 1) Validação no envio
select throws_ok(format($$select public.request_contract_create(jsonb_build_object(
    'property_id','60000000-0000-4000-8000-000000000001','contract_number','CT-INV','object','Locação de teste',
    'signed_on',%L,'start_date',%L,'end_date',%L,'global_value','12000.00','monthly_value','1000.00',
    'landlords', jsonb_build_array(jsonb_build_object('landlord_id','61000000-0000-4000-8000-000000000001'))), 'Contrato com datas invertidas')$$,
    :'today', :'today', (:'today'::date - 1)), '23514', null, 'Fim da vigência anterior ao início é recusado');
select throws_ok(format($$select public.request_contract_create(jsonb_build_object(
    'property_id','60000000-0000-4000-8000-000000000001','contract_number','CT-PCT','object','Locação de teste',
    'signed_on',%L,'start_date',%L,'end_date',%L,'global_value','12000.00','monthly_value','1000.00',
    'landlords', jsonb_build_array(
      jsonb_build_object('landlord_id','61000000-0000-4000-8000-000000000001','share_percent',60),
      jsonb_build_object('landlord_id','61000000-0000-4000-8000-000000000002','share_percent',50))), 'Contrato com percentuais inválidos')$$,
    :'today', :'today', (:'today'::date + 30)), '23514', null, 'Percentuais de locadores devem somar 100%');

-- 2) Cadastro com aprovação: vigência terminando em 45 dias (próximo do vencimento)
select (public.request_contract_create(jsonb_build_object(
    'property_id','60000000-0000-4000-8000-000000000001','contract_number','CT-001/2026','process_number','PA-123/2026',
    'object','Locação do imóvel de teste','signed_on',(:'today'::date - 300),'start_date',(:'today'::date - 300),
    'end_date',(:'today'::date + 45),'global_value','12000.00','monthly_value','1000.00',
    'base_date',(:'today'::date - 345),'manager_id',:'gestor',
    'landlords', jsonb_build_array(
      jsonb_build_object('landlord_id','61000000-0000-4000-8000-000000000001','share_percent',50),
      jsonb_build_object('landlord_id','61000000-0000-4000-8000-000000000002','share_percent',50))),
  'Cadastro do contrato de locação')).id as req_ct \gset
select is((select count(*)::int from public.contracts), 0, 'Contrato só existe após a aprovação');
select tests.set_claims(:'admin', 'aal2');
select is((public.decide_approval(:'req_ct', 'approved')).status::text, 'approved', 'Contrato aprovado');
select (select id from public.contracts where contract_number = 'CT-001/2026') as ct \gset
select is((select count(*)::int from public.contract_landlords where contract_id = :'ct'), 2, 'Locadores do contrato gravados');
select is((select validity_status from public.contracts_overview where id = :'ct'), 'expiring', 'Vigência calculada: próximo do vencimento');

-- 3) Aditivo de prazo: altera a vigência efetiva sem tocar o contrato original
select tests.set_claims(:'gestor');
select throws_ok(format($$select public.request_amendment_create(jsonb_build_object('contract_id',%L,'amendment_number','1','kind','value',
    'signed_on',%L,'description','Aditivo de valor sem valor'), 'Aditivo incompleto')$$, :'ct', :'today'),
  '23514', null, 'Aditivo de valor exige novo valor e data de vigência');
select (public.request_amendment_create(jsonb_build_object('contract_id', :'ct', 'amendment_number', '1', 'kind', 'term',
    'signed_on', :'today', 'new_end_date', (:'today'::date + 400), 'description', 'Prorrogação do prazo'), 'Prorrogação contratual')).id as req_a1 \gset
select tests.set_claims(:'admin', 'aal2');
select is((public.decide_approval(:'req_a1', 'approved')).status::text, 'approved', 'Aditivo de prazo aprovado');
select is((select effective_end_date from public.contracts_overview where id = :'ct'), (:'today'::date + 400), 'Vigência efetiva considera o último aditivo aprovado');
select is((select end_date from public.contracts where id = :'ct'), (:'today'::date + 45), 'Data original do contrato é preservada');
select is((select validity_status from public.contracts_overview where id = :'ct'), 'active', 'Contrato volta a vigente com a prorrogação');

-- 4) Aditivo de valor com início em data anterior
select tests.set_claims(:'gestor');
select (public.request_amendment_create(jsonb_build_object('contract_id', :'ct', 'amendment_number', '2', 'kind', 'value',
    'signed_on', :'today', 'new_monthly_value', '1250.50', 'value_effective_from', (:'today'::date - 10), 'description', 'Reajuste anual'), 'Reajuste do aluguel')).id as req_a2 \gset
select tests.set_claims(:'admin', 'aal2');
select is((public.decide_approval(:'req_a2', 'approved')).status::text, 'approved', 'Aditivo de valor aprovado');
select is((select effective_monthly_value from public.contracts_overview where id = :'ct'), 1250.50::numeric, 'Valor mensal vigente vem do aditivo');
select is(private.contract_monthly_value_at(:'ct', :'today'::date - 20), 1000.00::numeric, 'Antes do aditivo vale o valor original');
select is((select monthly_value from public.contracts where id = :'ct'), 1000.00::numeric, 'Valor original do contrato preservado');
reset role;
select throws_ok(format('update public.contract_amendments set description = ''Adulterado'' where contract_id = %L', :'ct'), '42501', null, 'Aditivo aprovado é imutável');
set local role authenticated;

-- 5) Alteração de valor do contrato (aprovação)
select tests.set_claims(:'gestor');
select (public.request_contract_value_change(:'ct', 1100, 13200, 'Correção do valor contratado')).id as req_v \gset
select tests.set_claims(:'admin', 'aal2');
select is((public.decide_approval(:'req_v', 'approved')).status::text, 'approved', 'Alteração de valor aprovada');
select is((select global_value from public.contracts where id = :'ct'), 13200.00::numeric, 'Valor global atualizado após aprovação');

-- 6) Alertas: contrato vencendo em 25 dias e data-base em 20 dias
reset role;
select tests.clear_claims();
insert into public.contracts (id, organization_id, property_id, contract_number, object, signed_on, start_date, end_date,
                              global_value, monthly_value, base_date, manager_id)
values ('62000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001',
        'CT-ALERTA', 'Contrato para teste de alertas', :'today'::date - 340, :'today'::date - 340, :'today'::date + 25,
        6000, 500, :'today'::date - 345, :'gestor');
select is(private.generate_contract_alerts(:'today'::date) >= 4, true, 'Rotina gera alertas de vencimento (90/60/30) e de data-base');
select is(private.generate_contract_alerts(:'today'::date), 0, 'Reexecução no mesmo dia não duplica alertas');
select is((select count(*)::int from public.notifications where user_id = :'gestor' and type_code = 'contract_expiring' and entity_id = '62000000-0000-4000-8000-000000000001'),
  1, 'Uma única notificação de vencimento por contrato (marco mais urgente)');
select is((select count(*)::int from public.notifications where user_id = :'gestor' and type_code = 'contract_adjustment' and entity_id = '62000000-0000-4000-8000-000000000001'),
  1, 'Notificação de data-base enviada ao gestor do contrato');
select is(private.generate_contract_alerts(:'today'::date + 26), 1, 'Contrato vencido gera alerta específico');

-- 7) Escopo e documentos contratuais
set local role authenticated;
select tests.set_claims(:'fora');
select is((select count(*)::int from public.contracts_overview), 0, 'Usuário fora do escopo não vê contratos');
select is((select count(*)::int from public.alerts), 0, 'Usuário fora do escopo não vê alertas');
select tests.set_claims(:'consulta');
select ok(not private.can_access_document_entity('contract', :'ct', 'view'), 'Perfil Consulta não acessa documentos contratuais (permissão própria)');
select tests.set_claims(:'gestor');
select ok(private.can_access_document_entity('contract', :'ct', 'attach'), 'Gestor no escopo anexa documentos ao contrato');

select * from finish();
rollback;
