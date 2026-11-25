-- Isolamento de registros entre usuários e organizações, acesso direto pela API.
begin;
\ir _helpers.psql
select plan(14);

select tests.create_user('admin_a', array['admin']) as admin_a \gset
select tests.create_user('colab_a', array['collaborator']) as colab_a \gset
select tests.create_user('colab_a2', array['collaborator']) as colab_a2 \gset
select tests.create_user('admin_b', array['admin'], p_org => '00000000-0000-4000-8000-00000000000b') as admin_b \gset
select tests.create_user('bloq_a', array['collaborator'], p_status => 'blocked') as blocked_a \gset

-- Notificação para colab_a2 (criada pelo backend)
select private.notify(:'colab_a2', 'welcome', 'Notificação de teste') is not null as created \gset

set local role authenticated;

select tests.set_claims(:'colab_a');
select is((select count(*)::int from public.profiles), 1, 'Colaborador lê somente o próprio perfil');
select is((select count(*)::int from public.organizations), 1, 'Colaborador vê somente a própria organização');
select is((select count(*)::int from public.departments where organization_id = '00000000-0000-4000-8000-00000000000b'), 0, 'Departamentos de outra organização são invisíveis');
select is((select count(*)::int from public.user_directory where id = :'admin_b'), 0, 'Diretório não lista usuários de outra organização');
select ok((select count(*) from public.user_directory) >= 3, 'Diretório lista colegas da mesma organização');
select is((select count(*)::int from public.notifications), 1, 'Colaborador vê somente as próprias notificações (boas-vindas não são de terceiros)')
  ;
select is((select count(*)::int from public.notifications where user_id = :'colab_a2'), 0, 'Notificações de outro usuário são invisíveis');
select is((select count(*)::int from public.audit_logs), 0, 'Colaborador não lê a auditoria');

-- Tentativas de escrita direta pela API (devem falhar ou não afetar linhas)
select throws_ok(
  format($$insert into public.user_roles (organization_id, user_id, role_id) values ('00000000-0000-4000-8000-000000000001', %L, '00000000-0000-4000-8000-000000000201')$$, :'colab_a2'),
  '42501', null, 'Colaborador não insere papéis diretamente (sem política de INSERT)'
);
select throws_ok(format($$update public.profiles set full_name = 'Alterado' where id = %L$$, :'colab_a2'),
  '42501', null, 'UPDATE direto em perfil de terceiro é negado (sem privilégio de escrita)');
select throws_ok(
  $$insert into public.departments (organization_id, kind, name) values ('00000000-0000-4000-8000-000000000001', 'secretariat', 'Secretaria Invasora')$$,
  '42501', null, 'Colaborador não cria departamentos'
);

-- Admin da organização B não enxerga a organização A
select tests.set_claims(:'admin_b', 'aal2');
select is((select count(*)::int from public.profiles where organization_id = '00000000-0000-4000-8000-000000000001'), 0, 'Administrador de outra organização não lê perfis da organização A');

-- Usuário bloqueado com JWT válido
select tests.set_claims(:'blocked_a', 'aal1');
select is((select count(*)::int from public.departments), 0, 'Usuário bloqueado não lê nenhum dado');

-- Papel anônimo
select tests.clear_claims();
reset role;
set local role anon;
select throws_ok('select count(*) from public.departments', '42501', null, 'Anônimo não acessa tabelas');

select * from finish();
rollback;
