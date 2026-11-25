-- Fase 7: objetos fora dos schemas da aplicação (não entram no backup de estrutura).
-- Também é executado no banco restaurado pelo exercício de restauração.
begin;
\ir _helpers.psql
select plan(5);

select ok(exists (select 1 from pg_trigger where tgrelid = 'auth.sessions'::regclass and tgname = 'semfaz_audit_session'),
  'Login e logout auditados (gatilho em auth.sessions)');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                   and policyname = 'documents_bucket_select_authorized'),
  'Leitura de arquivos condicionada ao acesso ao registro (política do Storage)');
select ok((select not public from storage.buckets where id = 'documents'), 'Bucket de documentos existe e é privado');
select results_eq(
  $$select jobname::text collate "C" from cron.job where jobname like 'semfaz-%' order by 1$$,
  $$values ('semfaz-contract-alerts' collate "C"), ('semfaz-finance-daily'), ('semfaz-productivity-snapshots'), ('semfaz-task-reminders')$$,
  'As quatro rotinas diárias/mensais estão agendadas');
select is((private.ensure_platform_objects()->>'cron_jobs')::int, 4, 'Recriação idempotente (não duplica rotinas)');

select * from finish();
rollback;
