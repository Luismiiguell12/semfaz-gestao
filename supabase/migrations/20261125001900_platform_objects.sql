-- =============================================================================
-- SEMFAZ Gestão — Fase 7: objetos fora dos schemas da aplicação.
--
-- Achado do teste de restauração: o backup de estrutura (supabase db dump) cobre
-- os schemas da aplicação (public, private), mas NÃO estes objetos, criados em
-- schemas da plataforma:
--   - gatilho de auditoria de login/logout em auth.sessions;
--   - política de leitura de arquivos em storage.objects;
--   - bucket privado "documents" (os dados vêm do backup, a configuração é garantida aqui);
--   - rotinas agendadas (pg_cron): alertas de contratos, financeiro diário,
--     lembretes de demandas e consolidação da produtividade.
-- Sem eles, um sistema restaurado funcionaria "em silêncio" sem auditar logins,
-- sem abrir anexos e sem as rotinas diárias.
--
-- private.ensure_platform_objects() recria tudo de forma idempotente. É executada
-- aqui (toda implantação) e é o ÚLTIMO PASSO OBRIGATÓRIO de qualquer restauração
-- (scripts/backup/restore-test.sh e docs/deployment.md).
-- As definições são as mesmas das migrations de origem (0400, 0600, 0400/0600/1300/1400).
-- =============================================================================
create or replace function private.ensure_platform_objects()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Auditoria de sessões (migration 20261124000400).
  drop trigger if exists semfaz_audit_session on auth.sessions;
  create trigger semfaz_audit_session
    after insert or update of aal or delete on auth.sessions
    for each row execute function private.tg_audit_auth_session();

  -- Bucket privado de documentos (migration 20261124000600).
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'documents', 'documents', false, 10485760,
    array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  )
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Leitura de arquivos somente quando o registro associado é acessível (migration 20261124000600).
  drop policy if exists "documents_bucket_select_authorized" on storage.objects;
  create policy "documents_bucket_select_authorized"
    on storage.objects for select to authenticated
    using (
      bucket_id = 'documents'
      and exists (
        select 1 from public.documents d
        where d.storage_path = storage.objects.name
          and d.deleted_at is null
          and private.can_access_document_entity(d.entity_type, d.entity_id, 'view')
      )
    );

  -- Rotinas agendadas (horários em UTC; 09h UTC = 06h de Maceió). cron.schedule
  -- com o mesmo nome atualiza a rotina existente, sem duplicar.
  perform cron.schedule('semfaz-contract-alerts', '0 9 * * *', 'select private.generate_contract_alerts()');
  perform cron.schedule('semfaz-finance-daily', '5 9 * * *',
    'select private.generate_rent_charges(); select private.generate_invoice_alerts();');
  perform cron.schedule('semfaz-task-reminders', '10 9 * * *', 'select private.generate_task_reminders()');
  perform cron.schedule('semfaz-productivity-snapshots', '20 9 1 * *', 'select private.consolidate_productivity()');

  return jsonb_build_object(
    'auth_session_trigger', exists (select 1 from pg_trigger where tgname = 'semfaz_audit_session'),
    'storage_policies', (select count(*) from pg_policies where schemaname = 'storage' and policyname = 'documents_bucket_select_authorized'),
    'cron_jobs', (select count(*) from cron.job where jobname like 'semfaz-%'));
end;
$$;
revoke all on function private.ensure_platform_objects() from public, anon, authenticated;

select private.ensure_platform_objects();
