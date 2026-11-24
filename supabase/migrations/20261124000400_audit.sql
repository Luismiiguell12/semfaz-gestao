-- =============================================================================
-- SEMFAZ Gestão — Fase 1B
-- Auditoria por triggers. Tabela somente de inserção (imutável).
-- =============================================================================

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id),
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  actor_type text not null check (actor_type in ('user', 'system')),
  operation text not null check (operation ~ '^[A-Z_]{3,40}$'),
  module text not null check (module ~ '^[a-z_]{2,40}$'),
  table_name text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  justification text,
  ip_address inet,
  user_agent text check (user_agent is null or length(user_agent) <= 500),
  metadata jsonb not null default '{}'::jsonb
);
create index audit_logs_org_time_idx on public.audit_logs (organization_id, occurred_at desc);
create index audit_logs_record_idx on public.audit_logs (table_name, record_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id, occurred_at desc);
create index audit_logs_module_idx on public.audit_logs (module, occurred_at desc);
comment on table public.audit_logs is 'Trilha de auditoria imutável: nenhuma alteração ou exclusão é permitida, inclusive para administradores.';

-- Imutabilidade: bloqueia UPDATE, DELETE e TRUNCATE para qualquer papel.
create or replace function private.tg_audit_logs_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Registros de auditoria são imutáveis.' using errcode = '42501';
end;
$$;

create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function private.tg_audit_logs_immutable();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function private.tg_audit_logs_immutable();

revoke all on public.audit_logs from anon, authenticated, service_role;
-- Leitura controlada pela RLS (audit.view). Inserções só por funções SECURITY DEFINER.
grant select on public.audit_logs to authenticated;

-- -----------------------------------------------------------------------------
-- Registro de eventos (uso interno pelas funções do banco)
-- -----------------------------------------------------------------------------
create or replace function private.log_event(
  p_operation text,
  p_module text,
  p_table_name text default null,
  p_record_id uuid default null,
  p_old_data jsonb default null,
  p_new_data jsonb default null,
  p_organization_id uuid default null,
  p_actor_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_ip inet default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_actor uuid := coalesce(p_actor_id, auth.uid());
  v_org uuid := coalesce(p_organization_id, private.current_org_id());
  v_changed text[];
begin
  if p_old_data is not null and p_new_data is not null then
    select array_agg(k order by k) into v_changed
    from (
      select key as k from jsonb_each(p_new_data)
      except
      select key from jsonb_each(p_old_data) o where p_new_data -> o.key = o.value
    ) changed;
  end if;

  insert into public.audit_logs (
    organization_id, actor_id, actor_type, operation, module, table_name, record_id,
    old_data, new_data, changed_fields, justification, ip_address, user_agent, metadata
  ) values (
    v_org,
    v_actor,
    case when v_actor is null then 'system' else 'user' end,
    p_operation,
    p_module,
    p_table_name,
    p_record_id,
    p_old_data,
    p_new_data,
    v_changed,
    nullif(current_setting('app.justification', true), ''),
    coalesce(p_ip, private.try_inet(split_part(private.request_header('x-forwarded-for'), ',', 1))),
    left(coalesce(p_user_agent, private.request_header('user-agent')), 500),
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object('db_role', coalesce(auth.role(), current_user))
  ) returning id into v_id;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Trigger genérico de auditoria: AFTER INSERT/UPDATE/DELETE.
-- TG_ARGV[0] = módulo. Exclusão lógica (deleted_at preenchido) vira SOFT_DELETE.
-- -----------------------------------------------------------------------------
create or replace function private.tg_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_module text := coalesce(tg_argv[0], 'system');
  v_old jsonb;
  v_new jsonb;
  v_operation text := tg_op;
  v_row jsonb;
  v_org uuid;
  v_actor uuid := auth.uid();
  v_record uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;
  v_row := coalesce(v_new, v_old);

  if tg_op = 'UPDATE' then
    -- Ignora atualizações sem mudança real (apenas colunas de controle).
    if (v_old - array['updated_at', 'updated_by']) = (v_new - array['updated_at', 'updated_by']) then
      return null;
    end if;
    if v_new ? 'deleted_at' and (v_old ->> 'deleted_at') is null and (v_new ->> 'deleted_at') is not null then
      v_operation := 'SOFT_DELETE';
    elsif v_new ? 'deleted_at' and (v_old ->> 'deleted_at') is not null and (v_new ->> 'deleted_at') is null then
      v_operation := 'RESTORE';
    end if;
  end if;

  v_org := case
    when tg_table_name = 'organizations' then (v_row ->> 'id')::uuid
    else (v_row ->> 'organization_id')::uuid
  end;

  -- Chamadas via service_role (Edge Functions) não têm auth.uid(): atribui ao
  -- autor registrado na própria linha.
  if v_actor is null then
    v_actor := coalesce(
      (v_new ->> 'updated_by')::uuid,
      (v_new ->> 'created_by')::uuid,
      (v_new ->> 'uploaded_by')::uuid
    );
  end if;

  v_record := case when v_row ? 'id' then (v_row ->> 'id')::uuid else null end;

  perform private.log_event(
    v_operation, v_module, tg_table_name, v_record, v_old, v_new, v_org, v_actor,
    case when auth.uid() is null then jsonb_build_object('via', coalesce(auth.role(), current_user)) else '{}'::jsonb end
  );
  return null;
end;
$$;

-- Aplica auditoria às tabelas da fundação.
create trigger organizations_audit after insert or update or delete on public.organizations
  for each row execute function private.tg_audit('organization');
create trigger departments_audit after insert or update or delete on public.departments
  for each row execute function private.tg_audit('departments');
create trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function private.tg_audit('users');
create trigger roles_audit after insert or update or delete on public.roles
  for each row execute function private.tg_audit('permissions');
create trigger role_permissions_audit after insert or update or delete on public.role_permissions
  for each row execute function private.tg_audit('permissions');
create trigger user_roles_audit after insert or update or delete on public.user_roles
  for each row execute function private.tg_audit('permissions');
create trigger user_department_access_audit after insert or update or delete on public.user_department_access
  for each row execute function private.tg_audit('permissions');

-- -----------------------------------------------------------------------------
-- Auditoria de login e logout: novas sessões no Supabase Auth.
-- -----------------------------------------------------------------------------
create or replace function private.tg_audit_auth_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_user uuid := coalesce(new.user_id, old.user_id);
begin
  select p.organization_id into v_org from public.profiles p where p.id = v_user;

  if tg_op = 'INSERT' then
    perform private.log_event(
      'LOGIN', 'auth', 'sessions', new.id, null, null, v_org, v_user,
      jsonb_build_object('aal', new.aal::text),
      new.ip, new.user_agent
    );
  elsif tg_op = 'UPDATE' and new.aal is distinct from old.aal then
    perform private.log_event(
      'MFA_VERIFIED', 'auth', 'sessions', new.id, null, null, v_org, v_user,
      jsonb_build_object('aal', new.aal::text),
      new.ip, new.user_agent
    );
  elsif tg_op = 'DELETE' then
    perform private.log_event(
      'LOGOUT', 'auth', 'sessions', old.id, null, null, v_org, v_user,
      '{}'::jsonb, old.ip, old.user_agent
    );
  end if;
  return null;
exception when others then
  -- A auditoria de sessão nunca pode impedir o login.
  raise warning 'Falha ao auditar sessão: %', sqlerrm;
  return null;
end;
$$;

create trigger semfaz_audit_session
  after insert or update of aal or delete on auth.sessions
  for each row execute function private.tg_audit_auth_session();

-- RPC de auditoria para eventos da aplicação que não passam por tabelas
-- (por exemplo, exportações registradas por Edge Functions na Fase 6).
create or replace function public.log_client_event(p_operation text, p_module text, p_metadata jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_active_user() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  -- Apenas operações informativas e não sensíveis podem ser registradas pelo cliente.
  if p_operation not in ('PAGE_ERROR', 'DOCUMENT_VIEW') then
    raise exception 'Operação de auditoria não permitida.' using errcode = '22023';
  end if;
  if pg_column_size(p_metadata) > 4000 then
    raise exception 'Metadados muito grandes.' using errcode = '22023';
  end if;
  return private.log_event(p_operation, p_module, null, null, null, null, null, null, p_metadata);
end;
$$;
revoke execute on function public.log_client_event(text, text, jsonb) from public, anon;
grant execute on function public.log_client_event(text, text, jsonb) to authenticated;
