-- Linha de base de segurança: RLS em todas as tabelas e nenhum acesso anônimo.
begin;
\ir _helpers.psql
select plan(7);

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  0,
  'Todas as tabelas do schema public têm RLS habilitada'
);

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon'),
  0,
  'O papel anon não possui nenhum privilégio em tabelas/views do schema public'
);

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')),
  0,
  'O papel anon não executa nenhuma função do schema public'
);

select ok(
  not has_table_privilege('authenticated', 'public.audit_logs', 'INSERT')
  and not has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.audit_logs', 'DELETE')
  and not has_table_privilege('service_role', 'public.audit_logs', 'DELETE'),
  'audit_logs não aceita INSERT/UPDATE/DELETE de authenticated nem DELETE de service_role'
);

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  0,
  'Toda função SECURITY DEFINER possui search_path fixo'
);

select ok(
  (select not public from storage.buckets where id = 'documents'),
  'O bucket de documentos é privado'
);

select is(
  (select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects'
     and policyname like 'documents_%' and cmd in ('INSERT', 'UPDATE', 'DELETE')),
  0,
  'Não há políticas de escrita/exclusão no Storage para usuários'
);

select * from finish();
rollback;
