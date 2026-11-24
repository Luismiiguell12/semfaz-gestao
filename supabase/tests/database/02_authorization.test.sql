-- Funções de autorização: permissões, MFA (AAL2), escopo por departamento e usuários inativos.
begin;
\ir _helpers.psql
select plan(16);

-- Estrutura de teste: SEMFAZ > Diretoria Teste > Unidade Teste; outra secretaria fora do escopo.
insert into public.departments (id, organization_id, parent_id, kind, name) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'directorate', 'Diretoria Teste'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'unit', 'Unidade Teste'),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', null, 'secretariat', 'Secretaria Teste Fora');

select tests.create_user('admin_t', array['admin']) as admin_id \gset
select tests.create_user('colab_t', array['collaborator']) as colab_id \gset
select tests.create_user('inativo_t', array['manager'], p_status => 'inactive') as inactive_id \gset
select tests.create_user('gestor_t', array['manager']) as manager_id \gset
insert into public.user_department_access (organization_id, user_id, department_id)
values ('00000000-0000-4000-8000-000000000001', :'colab_id', '10000000-0000-4000-8000-000000000001');

set local role authenticated;

-- Colaborador
select tests.set_claims(:'colab_id');
select ok(private.has_permission('tasks.create'), 'Colaborador possui tasks.create');
select ok(not private.has_permission('users.manage'), 'Colaborador não possui users.manage');
select ok(not private.has_permission('nao.existe'), 'Permissão inexistente é negada');
select ok(private.department_in_scope('10000000-0000-4000-8000-000000000002'), 'Escopo inclui a subárvore (unidade abaixo da diretoria concedida)');
select ok(not private.department_in_scope('00000000-0000-4000-8000-000000000101'), 'Escopo não inclui o departamento superior');
select ok(not private.department_in_scope('10000000-0000-4000-8000-000000000003'), 'Escopo não inclui outra secretaria');
select ok(not private.has_permission('properties.view', '10000000-0000-4000-8000-000000000003'), 'Permissão com departamento fora do escopo é negada');
select ok(private.has_permission('properties.view', '10000000-0000-4000-8000-000000000002'), 'Permissão com departamento no escopo é concedida');

-- Administrador sem MFA: permissões privilegiadas bloqueadas
select tests.set_claims(:'admin_id', 'aal1');
select ok(not private.has_permission('users.manage'), 'Administrador em AAL1 não exerce permissão privilegiada');
select ok(private.has_permission('properties.view'), 'Administrador em AAL1 mantém permissões comuns');
select is((public.get_my_access() -> 'mfa' ->> 'satisfied')::boolean, false, 'get_my_access indica MFA pendente para o administrador');

-- Administrador com AAL2
select tests.set_claims(:'admin_id', 'aal2');
select ok(private.has_permission('users.manage'), 'Administrador em AAL2 exerce users.manage');
select ok(private.department_in_scope('10000000-0000-4000-8000-000000000003'), 'Administrador acessa toda a organização');

-- Gestor com MFA ativo, mas sessão AAL1: MFA passa a ser exigido
reset role;
select tests.enroll_mfa(:'manager_id');
set local role authenticated;
select tests.set_claims(:'manager_id', 'aal1');
select is((public.get_my_access() -> 'mfa' ->> 'satisfied')::boolean, false, 'Usuário com MFA ativo em sessão AAL1 não satisfaz o MFA');

-- Usuário inativo com JWT válido
select tests.set_claims(:'inactive_id', 'aal2');
select ok(not private.has_permission('properties.view'), 'Usuário inativo não possui nenhuma permissão');
select is(public.get_my_access() ->> 'status', 'inactive', 'get_my_access informa a situação inativa');

select * from finish();
rollback;
