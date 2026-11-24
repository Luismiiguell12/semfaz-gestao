-- Regras administrativas: MFA, autoalteração, último administrador e escalonamento de privilégios.
begin;
\ir _helpers.psql
select plan(17);

select tests.create_user('admin1', array['admin']) as admin1 \gset
select tests.create_user('gestor1', array['manager']) as manager1 \gset
select tests.create_user('colab1', array['collaborator']) as colab1 \gset
select tests.enroll_mfa(:'admin1');

-- Perfil "RH Teste": possui users.manage, mas não é administrador.
insert into public.roles (id, organization_id, code, name) values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'rh_teste', 'RH Teste');
insert into public.role_permissions (role_id, permission_code, organization_id) values
  ('20000000-0000-4000-8000-000000000001', 'users.manage', '00000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001', 'tasks.create', '00000000-0000-4000-8000-000000000001');
select tests.create_user('rh1', array['rh_teste']) as rh1 \gset

set local role authenticated;

-- Sem permissão
select tests.set_claims(:'colab1');
select throws_ok('select * from public.admin_list_users()', '42501', null, 'Colaborador não lista usuários');
select throws_ok(format('select public.admin_set_user_status(%L, ''blocked'', ''Tentativa indevida de bloqueio'')', :'manager1'),
  '42501', null, 'Colaborador não altera a situação de usuários');

-- Administrador sem AAL2
select tests.set_claims(:'admin1', 'aal1');
select throws_ok('select * from public.admin_list_users()', '42501', 'Esta operação exige verificação em duas etapas (MFA).',
  'Administrador sem MFA verificado na sessão é bloqueado');

-- Administrador com AAL2
select tests.set_claims(:'admin1', 'aal2');
select ok((select count(*) from public.admin_list_users()) >= 4, 'Administrador com AAL2 lista usuários');

select throws_ok(format('select public.admin_set_user_status(%L, ''inactive'', ''Teste de autoalteração'')', :'admin1'),
  '42501', null, 'Administrador não altera a própria situação');
select throws_ok(format('select public.admin_set_user_access(%L, array[''00000000-0000-4000-8000-000000000203''::uuid], ''{}'', false, ''Teste de autoalteração'')', :'admin1'),
  '42501', null, 'Administrador não altera as próprias permissões');

select throws_ok(format('select public.admin_set_user_status(%L, ''blocked'', ''curta'')', :'colab1'),
  '22023', null, 'Justificativa curta é rejeitada');
select lives_ok(format('select public.admin_set_user_status(%L, ''blocked'', ''Bloqueio para teste automatizado'')', :'colab1'),
  'Administrador bloqueia outro usuário com justificativa');
select is((select status::text from public.profiles where id = :'colab1'), 'blocked', 'Situação persistida');

-- Último administrador ativo (operação feita fora da sessão do próprio admin).
reset role;
select tests.clear_claims();
select is(private.active_admin_count('00000000-0000-4000-8000-000000000001'), 1, 'Existe um único administrador ativo no cenário');
select throws_ok(format('delete from public.user_roles where user_id = %L', :'admin1'),
  '42501', 'Não é possível remover ou desativar o último administrador ativo.', 'O último administrador ativo não pode perder o perfil');
select throws_ok(format('update public.profiles set status = ''inactive'', status_reason = ''Inativação de teste do último admin'' where id = %L', :'admin1'),
  '42501', 'Não é possível remover ou desativar o último administrador ativo.', 'O último administrador ativo não pode ser desativado');

-- Escalonamento: usuário com users.manage (não admin) não concede Administrador nem Gestor.
set local role authenticated;
select tests.set_claims(:'rh1', 'aal1');
select throws_ok(format('select public.admin_set_user_access(%L, array[''00000000-0000-4000-8000-000000000201''::uuid], ''{}'', false, ''Tentativa de escalonamento'')', :'manager1'),
  '42501', null, 'Não administrador não concede o perfil Administrador');
select throws_ok(format('select public.admin_set_user_access(%L, array[''00000000-0000-4000-8000-000000000202''::uuid], ''{}'', false, ''Tentativa de escalonamento'')', :'rh1'),
  '42501', null, 'Ninguém altera o próprio acesso');

-- Perfil Administrador não é editável e permissões de perfil próprio não podem ser alteradas
reset role;
select throws_ok($$insert into public.role_permissions (role_id, permission_code, organization_id) values ('00000000-0000-4000-8000-000000000201', 'tasks.create', '00000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'Permissões do perfil Administrador não são editáveis');
set local role authenticated;
select tests.set_claims(:'admin1', 'aal2');
select throws_ok($$select public.admin_save_role('00000000-0000-4000-8000-000000000201', 'admin', 'Administrador', null, array['tasks.create'], 'Tentativa de alterar admin')$$,
  '42501', null, 'admin_save_role também respeita a proteção do perfil Administrador');
select lives_ok($$select public.admin_save_role(null, 'auditor_teste', 'Auditor Teste', 'Perfil de teste', array['audit.view'], 'Criação de perfil de teste')$$,
  'Administrador cria novo perfil de acesso');

select * from finish();
rollback;
