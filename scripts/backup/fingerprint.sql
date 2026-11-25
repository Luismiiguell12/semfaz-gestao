-- Impressão digital do banco para comparar antes e depois de uma restauração.
-- Contagem de linhas de cada tabela de negócio, usuários, arquivos e um hash de
-- toda a auditoria (qualquer linha a mais, a menos ou alterada muda o hash).
\pset format unaligned
\pset tuples_only on
\pset footer off
select 'tabelas_public=' || count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r';
select format('%s=%s', t.relname, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', t.relname), false, true, '')))[1]::text)
  from pg_class t join pg_namespace n on n.oid = t.relnamespace
 where n.nspname = 'public' and t.relkind = 'r'
 order by t.relname;
select 'auth.users=' || count(*) from auth.users;
select 'auth.mfa_factors=' || count(*) from auth.mfa_factors;
select 'storage.objects=' || count(*) from storage.objects;
select 'audit_logs.md5=' || md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from public.audit_logs t;
select 'contracts.valores=' || coalesce(sum(monthly_value), 0) || '/' || coalesce(sum(global_value), 0) from public.contracts;
select 'payments.total=' || coalesce(sum(amount), 0) from public.payments;
