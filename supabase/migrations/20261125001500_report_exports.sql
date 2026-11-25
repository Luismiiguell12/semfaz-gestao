-- =============================================================================
-- SEMFAZ Gestão — Fase 6: auditoria de exportações.
-- As exportações (Excel e PDF) são geradas pela Edge Function reports-export com
-- o token do próprio usuário (RLS aplicada). Antes de devolver o arquivo, ela
-- registra a exportação aqui: quem, qual relatório, quais filtros, formato,
-- quantidade de linhas e quando. Sem esse registro, o arquivo não é entregue.
-- =============================================================================
create or replace function public.log_report_export(p_report text, p_format text, p_filters jsonb, p_row_count integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_active_user() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  perform private.require_permission('reports.export');
  if p_report !~ '^[a-z_]{3,40}$' then
    raise exception 'Relatório inválido.' using errcode = '22023';
  end if;
  if p_format not in ('xlsx', 'pdf') then
    raise exception 'Formato inválido.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_filters, '{}'::jsonb)) <> 'object' or pg_column_size(p_filters) > 4000 then
    raise exception 'Filtros inválidos.' using errcode = '22023';
  end if;
  if p_row_count is null or p_row_count < 0 then
    raise exception 'Quantidade de linhas inválida.' using errcode = '22023';
  end if;
  return private.log_event('EXPORT', 'reports', null, null, null, null, null, null,
    jsonb_build_object('report', p_report, 'format', p_format, 'filters', coalesce(p_filters, '{}'::jsonb), 'rows', p_row_count));
end;
$$;
revoke all on function public.log_report_export(text, text, jsonb, integer) from public, anon;
grant execute on function public.log_report_export(text, text, jsonb, integer) to authenticated;
