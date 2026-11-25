-- Fase 7: matriz de privilégios dos papéis da API (defesa em profundidade além da RLS).
begin;
\ir _helpers.psql
select plan(11);

select is(
  (select count(*)::int from information_schema.role_table_grants g
     join pg_class c on c.relname = g.table_name join pg_namespace n on n.oid = c.relnamespace and n.nspname = g.table_schema
    where g.table_schema = 'public' and c.relkind in ('v', 'm') and g.grantee in ('anon', 'authenticated', 'PUBLIC')
      and g.privilege_type <> 'SELECT'),
  0, 'Visões são somente leitura para os papéis da API');

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')
      and privilege_type in ('DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')),
  0, 'Nenhum DELETE, TRUNCATE, REFERENCES ou TRIGGER para usuários (exclusão só lógica, por função)');

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'PUBLIC') and privilege_type <> 'SELECT'),
  0, 'Anônimo não escreve em nada');

select results_eq(
  $$select (table_name::text || ':' || string_agg(privilege_type::text, ',' order by privilege_type::text)) collate "C"
      from information_schema.role_table_grants
     where table_schema = 'public' and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE')
     group by table_name order by 1$$,
  $$select v collate "C" from (values ('adjustment_indexes:INSERT,UPDATE'), ('alert_rules:UPDATE'), ('approval_rules:UPDATE'),
           ('contract_modalities:INSERT,UPDATE'), ('departments:INSERT,UPDATE'),
           ('notification_preferences:INSERT,UPDATE'), ('registration_drafts:INSERT,UPDATE'),
           ('suppliers:INSERT,UPDATE'), ('task_categories:INSERT,UPDATE')) t(v)$$,
  'Escrita direta somente nas tabelas que a interface grava sem função (lista fechada)');

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE')
      and table_name in (select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                          where n.nspname = 'public' and not c.relrowsecurity)),
  0, 'Toda tabela com escrita direta tem RLS');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
     join pg_attribute a on a.attrelid = c.oid and a.attname = 'deleted_at' and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r'
      and not exists (select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
                       where t.tgrelid = c.oid and p.proname = 'tg_prevent_physical_delete')),
  0, 'Toda tabela com exclusão lógica bloqueia a exclusão física (inclusive pelo servidor)');

create table public.zz_tabela_futura (id int);
select ok(not has_table_privilege('authenticated', 'public.zz_tabela_futura', 'INSERT')
          and not has_table_privilege('anon', 'public.zz_tabela_futura', 'DELETE'),
  'Tabelas novas nascem sem escrita para os papéis da API');
drop table public.zz_tabela_futura;

-- Ataque concreto que motivou a correção: alterar colega pela visão do diretório.
select tests.create_user('pv_vitima', array['collaborator']) as vit \gset
select tests.create_user('pv_atacante', array['collaborator']) as atk \gset
set local role authenticated;
select tests.set_claims(:'atk');
select throws_ok(format($$update public.user_directory set full_name = 'Alterado' where id = %L$$, :'vit'),
  '42501', null, 'Colega não altera perfil de terceiros pela visão user_directory');
select throws_ok($$update public.properties set name = 'Alterado'$$, '42501', null,
  'Sem UPDATE direto em imóveis (somente pelas funções com aprovação)');
select throws_ok($$delete from public.task_categories$$, '42501', null, 'Sem DELETE direto em nenhuma tabela');
reset role;
select is((select full_name from public.profiles where id = :'vit'), 'Usuário Teste pv_vitima', 'Perfil da vítima intacto');

select * from finish();
rollback;
