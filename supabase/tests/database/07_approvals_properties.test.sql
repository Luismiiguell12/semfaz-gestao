-- Motor de aprovações aplicado a imóveis; locadores; escopo por imóvel.
begin;
\ir _helpers.psql
select plan(31);

insert into public.departments (id, organization_id, parent_id, kind, name) values
  ('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', null, 'secretariat', 'Secretaria Teste Imóveis');

select tests.create_user('ap_admin1', array['admin']) as admin1 \gset
select tests.create_user('ap_admin2', array['admin']) as admin2 \gset
select tests.create_user('ap_gestor', array['manager']) as gestor \gset
select tests.create_user('ap_fora', array['viewer']) as fora \gset
select tests.enroll_mfa(:'admin1');
select tests.enroll_mfa(:'admin2');
insert into public.user_department_access (organization_id, user_id, department_id) values
  ('00000000-0000-4000-8000-000000000001', :'gestor', '00000000-0000-4000-8000-000000000101');

\set payload '{"name":"Imóvel Teste 01","street":"Rua Teste","address_number":"100","district":"Centro","postal_code":"49400-000","city":"Lagarto","state":"SE","department_id":"00000000-0000-4000-8000-000000000101","purpose":"Sede administrativa de teste"}'

set local role authenticated;

-- 1) Solicitação do gestor: imóvel ainda não existe como registro oficial
select tests.set_claims(:'gestor');
select (public.request_property_create(:'payload'::jsonb, 'Cadastro de imóvel para teste automatizado')).id as req1 \gset
select is((select status::text from public.approval_requests where id = :'req1'), 'pending', 'Solicitação criada como pendente');
select is((select count(*)::int from public.properties where name = 'Imóvel Teste 01'), 0, 'Imóvel solicitado não aparece antes da aprovação');
select throws_ok(format('select public.decide_approval(%L, ''approved'')', :'req1'), '42501', null, 'Gestor não decide aprovações');

-- 2) Validação no envio: dados inválidos são recusados pelas constraints
select throws_ok($$select public.request_property_create('{"name":"Imóvel CEP inválido","street":"Rua","address_number":"1","district":"Centro","postal_code":"49400000","city":"Lagarto","state":"SE","department_id":"00000000-0000-4000-8000-000000000101","purpose":"Teste de validação"}'::jsonb, 'Solicitação com CEP inválido')$$,
  '23514', null, 'CEP fora do formato 00000-000 é recusado já na solicitação');
select throws_ok($$select public.request_property_create('{"name":"Imóvel fora do escopo","street":"Rua","address_number":"1","district":"Centro","postal_code":"49400-000","city":"Lagarto","state":"SE","department_id":"50000000-0000-4000-8000-000000000001","purpose":"Teste de escopo"}'::jsonb, 'Solicitação fora do escopo')$$,
  '42501', null, 'Gestor não solicita imóvel de secretaria fora do seu escopo');

-- 3) Autoaprovação é proibida, mesmo para administrador
select tests.set_claims(:'admin1', 'aal2');
select (public.request_property_create(replace(:'payload', 'Imóvel Teste 01', 'Imóvel Teste 02')::jsonb, 'Cadastro solicitado por administrador')).id as req2 \gset
select throws_ok(format('select public.decide_approval(%L, ''approved'')', :'req2'), '42501',
  'Você não pode decidir a própria solicitação. Outro administrador deve decidir.', 'Administrador não aprova a própria solicitação');

-- 4) Outro administrador aprova: efetivação transacional
select tests.set_claims(:'admin2', 'aal1');
select throws_ok(format('select public.decide_approval(%L, ''approved'')', :'req1'), '42501', null, 'Decidir exige MFA (AAL2)');
select tests.set_claims(:'admin2', 'aal2');
select lives_ok(format('select public.decide_approval(%L, ''approved'', ''Conferido'')', :'req1'), 'Administrador aprova a solicitação do gestor');
select is((select status::text from public.approval_requests where id = :'req1'), 'approved', 'Solicitação aprovada');
select ok((select result_entity_id is not null and applied_at is not null from public.approval_requests where id = :'req1'), 'Registro efetivado e vinculado à solicitação');
select is((select approval_request_id from public.properties where name = 'Imóvel Teste 01'), :'req1'::uuid, 'Imóvel criado guarda a solicitação de origem');
select throws_ok(format('select public.decide_approval(%L, ''rejected'', ''Tentativa de decidir de novo'')', :'req1'), '22023', null, 'Solicitação já decidida não é decidida de novo');

-- 5) Rejeição exige motivo e preserva os dados
select throws_ok(format('select public.decide_approval(%L, ''rejected'', ''curto'')', :'req2'), '22023', null, 'Rejeição exige comentário');
select lives_ok(format('select public.decide_approval(%L, ''rejected'', ''Imóvel duplicado no teste'')', :'req2'), 'Rejeição com motivo');
select is((select count(*)::int from public.properties where name = 'Imóvel Teste 02'), 0, 'Rejeição não cria o registro');

select (select id from public.properties where name = 'Imóvel Teste 01') as prop \gset

-- 6) Alteração de endereço; registro alterado antes da decisão bloqueia a efetivação
select tests.set_claims(:'gestor');
select (public.request_property_address_change(:'prop', '{"street":"Avenida Nova","address_number":"200","district":"Centro","postal_code":"49400-001","city":"Lagarto","state":"SE"}'::jsonb, 'Mudança de endereço do imóvel')).id as req3 \gset
select throws_ok(format($$select public.request_property_address_change(%L, '{"street":"Outra Rua","address_number":"1","district":"Centro","postal_code":"49400-002","city":"Lagarto","state":"SE"}'::jsonb, 'Segunda solicitação simultânea')$$, :'prop'),
  '23505', null, 'Não há duas solicitações pendentes da mesma operação para o mesmo registro');
select lives_ok(format($$select public.update_property_details(%L, '{"name":"Imóvel Teste 01","purpose":"Sede administrativa alterada","status":"active"}'::jsonb, 'Ajuste da finalidade do imóvel')$$, :'prop'),
  'Alteração direta de campos não sensíveis');
select tests.set_claims(:'admin2', 'aal2');
select is((public.decide_approval(:'req3', 'approved')).status::text, 'failed', 'Efetivação bloqueada: registro mudou depois da solicitação');
select is((select street from public.properties where id = :'prop'), 'Rua Teste', 'Endereço original preservado');
select alike((select failure_reason from public.approval_requests where id = :'req3'), '%alterado depois da solicitação%', 'Motivo da falha registrado');

-- 7) Cancelamento: somente o solicitante
select tests.set_claims(:'gestor');
select throws_ok(format($$select public.request_property_department_change(%L, '00000000-0000-4000-8000-000000000101', null, 'Sem mudança efetiva')$$, :'prop'), '22023', null, 'Solicitação sem alteração real é recusada');
select (public.request_property_address_change(:'prop', '{"street":"Avenida Nova","address_number":"200","district":"Centro","postal_code":"49400-001","city":"Lagarto","state":"SE"}'::jsonb, 'Nova solicitação de endereço')).id as req4 \gset
select tests.set_claims(:'admin2', 'aal2');
select throws_ok(format('select public.cancel_approval_request(%L, ''Cancelamento por terceiro'')', :'req4'), '42501', null, 'Outro usuário não cancela a solicitação');
select tests.set_claims(:'gestor');
select is((public.cancel_approval_request(:'req4', 'Desisti da alteração de endereço')).status::text, 'cancelled', 'Solicitante cancela a própria solicitação pendente');

-- 8) Escopo por imóvel
select tests.set_claims(:'fora');
select is((select count(*)::int from public.properties), 0, 'Usuário sem escopo não vê imóveis');
reset role;
select tests.clear_claims();
insert into public.user_property_access (organization_id, user_id, property_id) values ('00000000-0000-4000-8000-000000000001', :'fora', :'prop');
set local role authenticated;
select tests.set_claims(:'fora');
select is((select count(*)::int from public.properties), 1, 'Imóvel selecionado no escopo fica visível');
select is((select count(*)::int from public.approval_requests), 0, 'Usuário comum não vê solicitações de terceiros');

-- 9) Locadores: CPF validado, mascarado e protegido
select tests.set_claims(:'gestor');
select throws_ok($$select public.save_landlord(null, '{"person_type":"individual","name":"Locador Teste","document":"123.456.789-00"}'::jsonb)$$, '22023', 'CPF inválido.', 'CPF com dígitos verificadores inválidos é recusado');
select public.save_landlord(null, '{"person_type":"individual","name":"Locador Teste Um","document":"529.982.247-25","phone":"(79) 99999-8888"}'::jsonb) as ll1 \gset
select is((select document_masked from public.landlords where id = :'ll1'), '***.982.247-**', 'CPF exibido mascarado por padrão');
select throws_ok(format('select document from public.landlords where id = %L', :'ll1'), '42501', null, 'CPF completo não é legível diretamente');
select throws_ok(format('select public.get_landlord_sensitive(%L)', :'ll1'), '42501', null, 'Gestor sem landlords.view_sensitive não vê o CPF completo');
select tests.set_claims(:'admin2', 'aal2');
select is((public.get_landlord_sensitive(:'ll1')) ->> 'document', '52998224725', 'Com permissão específica, o CPF completo é exibido');

select * from finish();
rollback;
