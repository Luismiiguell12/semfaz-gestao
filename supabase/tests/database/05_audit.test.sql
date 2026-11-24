-- Auditoria: autoria por trigger, justificativa, exclusão lógica, login e imutabilidade.
begin;
\ir _helpers.psql
select plan(11);

select tests.create_user('admin_aud', array['admin']) as admin_id \gset
select tests.create_user('aud_colab', array['collaborator']) as colab_id \gset
select tests.enroll_mfa(:'admin_id');

set local role authenticated;
select tests.set_claims(:'admin_id', 'aal2');

-- created_by enviado pelo cliente é ignorado
insert into public.departments (id, organization_id, parent_id, kind, name, created_by)
values ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000101', 'directorate', 'Diretoria Auditada', :'colab_id');

reset role;
select is((select created_by from public.departments where id = '30000000-0000-4000-8000-000000000001'), :'admin_id'::uuid,
  'created_by é definido por auth.uid(), não pelo cliente');
select is((select count(*)::int from public.audit_logs where record_id = '30000000-0000-4000-8000-000000000001' and operation = 'INSERT' and actor_id = :'admin_id'),
  1, 'Inserção auditada com o autor correto');

set local role authenticated;
select tests.set_claims(:'admin_id', 'aal2');
select lives_ok($$select public.soft_delete_department('30000000-0000-4000-8000-000000000001', 'Departamento criado por engano no teste')$$,
  'Exclusão lógica de departamento com justificativa');
reset role;
select is((select justification from public.audit_logs where record_id = '30000000-0000-4000-8000-000000000001' and operation = 'SOFT_DELETE'),
  'Departamento criado por engano no teste', 'Exclusão lógica auditada como SOFT_DELETE com justificativa');
select ok((select deleted_at is not null from public.departments where id = '30000000-0000-4000-8000-000000000001'),
  'Registro permanece no banco após exclusão lógica');
select throws_ok($$delete from public.departments where id = '30000000-0000-4000-8000-000000000001'$$, 'P0001', null,
  'Exclusão física de departamento é bloqueada');

-- Mudança de permissões auditada
select is((select count(*)::int from public.audit_logs where table_name = 'user_roles' and (new_data ->> 'user_id')::uuid = :'colab_id'),
  1, 'Atribuição de perfil auditada');

-- Login (nova sessão no Supabase Auth)
insert into auth.sessions (id, user_id, created_at, updated_at, aal, ip, user_agent)
values (gen_random_uuid(), :'colab_id', now(), now(), 'aal1', '203.0.113.10', 'Navegador Teste');
select is((select count(*)::int from public.audit_logs where operation = 'LOGIN' and actor_id = :'colab_id' and ip_address = '203.0.113.10'),
  1, 'Login auditado com IP e agente do navegador');

-- Imutabilidade, inclusive para o dono da tabela
select throws_ok('update public.audit_logs set justification = ''adulterado''', '42501', null, 'UPDATE em audit_logs é bloqueado (até para postgres)');
select throws_ok('delete from public.audit_logs', '42501', null, 'DELETE em audit_logs é bloqueado (até para postgres)');
select throws_ok('truncate public.audit_logs', '42501', null, 'TRUNCATE em audit_logs é bloqueado');

select * from finish();
rollback;
