-- Documentos (acesso por registro associado) e hierarquia de departamentos.
begin;
\ir _helpers.psql
select plan(12);

insert into public.departments (id, organization_id, parent_id, kind, name) values
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'directorate', 'Diretoria Docs'),
  ('40000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', null, 'secretariat', 'Secretaria Docs Fora');

select tests.create_user('doc_admin', array['admin']) as admin_id \gset
select tests.create_user('doc_colab', array['collaborator']) as colab_id \gset
select tests.create_user('doc_out', array['collaborator']) as out_id \gset
select tests.enroll_mfa(:'admin_id');
insert into public.user_department_access (organization_id, user_id, department_id) values
  ('00000000-0000-4000-8000-000000000001', :'colab_id', '40000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000001', :'out_id', '40000000-0000-4000-8000-000000000002');

-- Documento registrado pelo backend (service_role)
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
select (public.service_register_document(
  :'admin_id', 'department', '40000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001/department/' || gen_random_uuid(),
  'portaria.pdf', 'application/pdf', 1024, repeat('a', 64))).id as doc_id \gset
select is((select version from public.documents where id = :'doc_id'), 1, 'Documento registrado na versão 1');
select is((select actor_id from public.audit_logs where record_id = :'doc_id' and operation = 'INSERT'), :'admin_id'::uuid,
  'Envio via Edge Function é auditado com o usuário que enviou');

select (public.service_register_document(
  :'admin_id', 'department', '40000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001/department/' || gen_random_uuid(),
  'portaria-v2.pdf', 'application/pdf', 2048, repeat('b', 64), null, :'doc_id')).id as doc_v2 \gset
select is((select version from public.documents where id = :'doc_v2'), 2, 'Substituição gera a versão 2');
select ok((select not is_current from public.documents where id = :'doc_id'), 'A versão anterior é preservada como não atual');

select tests.clear_claims();
set local role authenticated;

select tests.set_claims(:'colab_id');
select is((select count(*)::int from public.documents), 2, 'Usuário com escopo no registro vê os documentos');
select throws_ok(format($$select public.service_register_document(%L, 'department', '40000000-0000-4000-8000-000000000001', 'x', 'a.pdf', 'application/pdf', 1, %L)$$, :'colab_id', repeat('c', 64)),
  '42501', null, 'Usuário comum não executa o registro de documentos');

select tests.set_claims(:'out_id');
select is((select count(*)::int from public.documents), 0, 'Usuário sem escopo no registro não vê os documentos');
select ok(not public.can_attach_document('department', '40000000-0000-4000-8000-000000000001'), 'Usuário sem permissão não pode anexar');

-- Hierarquia
reset role;
select throws_ok($$insert into public.departments (organization_id, parent_id, kind, name) values ('00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'directorate', 'Diretoria sob diretoria')$$,
  '23514', null, 'Diretoria não pode ficar abaixo de outra diretoria');
select throws_ok($$insert into public.departments (organization_id, parent_id, kind, name) values ('00000000-0000-4000-8000-000000000001', null, 'unit', 'Unidade sem pai')$$,
  '23514', null, 'Unidade exige departamento superior');
select throws_ok($$insert into public.departments (organization_id, parent_id, kind, name) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000001b1', 'directorate', 'Diretoria em outra org')$$,
  '23503', null, 'Departamento superior deve pertencer à mesma organização');
select throws_ok($$update public.documents set original_name = 'renomeado.pdf'$$, '42501', null, 'Metadados de documentos são imutáveis');

select * from finish();
rollback;
