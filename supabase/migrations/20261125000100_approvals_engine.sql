-- =============================================================================
-- SEMFAZ Gestão — Fase 2A
-- Motor genérico de aprovações (nível único nesta versão, modelagem multinível).
--
-- Fluxo: solicitação (snapshot atual + dados propostos + justificativa)
--        → decisão por administrador diferente do solicitante
--        → efetivação transacional por função "handler" da operação, que
--          bloqueia a efetivação se o registro mudou desde a solicitação.
-- =============================================================================

create type public.approval_status as enum ('pending', 'approved', 'rejected', 'cancelled', 'failed');

-- Catálogo de operações aprováveis (global, mantido por migrations).
-- handler = função em private que recebe a solicitação e devolve o id do registro afetado.
create table public.approval_operations (
  code text primary key check (code ~ '^[a-z_]+\.[a-z_]+$'),
  module text not null check (module ~ '^[a-z_]+$'),
  entity_type text not null check (entity_type ~ '^[a-z_]+$'),
  description text not null check (length(btrim(description)) between 5 and 200),
  handler text not null check (handler ~ '^[a-z_]+$'),
  request_permission text not null references public.permissions (code),
  created_at timestamptz not null default now()
);
comment on table public.approval_operations is 'Operações que podem exigir aprovação. Novas operações são registradas pela migration do respectivo módulo.';

-- Regras por organização: quais operações exigem aprovação (configurável).
create table public.approval_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  operation_code text not null references public.approval_operations (code),
  requires_approval boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  constraint approval_rules_unique unique (organization_id, operation_code)
);

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  operation_code text not null references public.approval_operations (code),
  entity_type text not null,
  -- Nulo em operações de criação (o registro só existe após a aprovação).
  entity_id uuid,
  -- Departamento do registro, para escopo e indicadores.
  department_id uuid references public.departments (id),
  status public.approval_status not null default 'pending',
  justification text not null check (length(btrim(justification)) between 10 and 1000),
  current_snapshot jsonb,
  proposed_data jsonb not null,
  -- Impressão digital (hash) do conteúdo do registro no momento da solicitação.
  -- Na efetivação, qualquer diferença bloqueia a operação.
  base_hash text check (base_hash is null or base_hash ~ '^[0-9a-f]{32}$'),
  requested_by uuid not null references public.profiles (id),
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  decision_comment text,
  applied_at timestamptz,
  result_entity_id uuid,
  failure_reason text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  constraint approval_requests_decision_consistency check (
    (status = 'pending' and decided_at is null and applied_at is null)
    or status <> 'pending'
  )
);
create index approval_requests_status_idx on public.approval_requests (organization_id, status, requested_at desc);
create index approval_requests_requester_idx on public.approval_requests (requested_by, requested_at desc);
create index approval_requests_entity_idx on public.approval_requests (entity_type, entity_id);
-- Uma única solicitação pendente por operação e registro.
create unique index approval_requests_one_pending
  on public.approval_requests (operation_code, entity_id)
  where status = 'pending' and entity_id is not null;

-- Etapas: nesta versão há uma única etapa (Administrador). A tabela permite
-- múltiplos níveis no futuro sem migração destrutiva.
create table public.approval_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  request_id uuid not null references public.approval_requests (id),
  step_order integer not null default 1 check (step_order >= 1),
  required_permission text not null default 'approvals.review' references public.permissions (code),
  status public.approval_status not null default 'pending',
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint approval_steps_unique unique (request_id, step_order)
);

-- Decisões: registro imutável.
create table public.approval_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  request_id uuid not null references public.approval_requests (id),
  step_id uuid not null references public.approval_steps (id),
  decision text not null check (decision in ('approved', 'rejected')),
  comment text check (comment is null or length(comment) <= 1000),
  decided_by uuid not null references public.profiles (id),
  decided_at timestamptz not null default now()
);
create index approval_decisions_request_idx on public.approval_decisions (request_id);

create or replace function private.tg_immutable_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Registros de % são imutáveis.', tg_table_name using errcode = '42501';
end;
$$;
create trigger approval_decisions_immutable before update or delete on public.approval_decisions
  for each row execute function private.tg_immutable_row();

create trigger approval_rules_actor before insert or update on public.approval_rules
  for each row execute function private.tg_set_actor_columns();
create trigger approval_requests_actor before insert or update on public.approval_requests
  for each row execute function private.tg_set_actor_columns();
create trigger approval_rules_audit after insert or update or delete on public.approval_rules
  for each row execute function private.tg_audit('approvals');
create trigger approval_requests_audit after insert or update or delete on public.approval_requests
  for each row execute function private.tg_audit('approvals');
create trigger approval_decisions_audit after insert on public.approval_decisions
  for each row execute function private.tg_audit('approvals');
create trigger approval_requests_no_delete before delete on public.approval_requests
  for each row execute function private.tg_prevent_physical_delete();
create trigger approval_rules_no_delete before delete on public.approval_rules
  for each row execute function private.tg_prevent_physical_delete();

-- -----------------------------------------------------------------------------
-- Funções do motor
-- -----------------------------------------------------------------------------

-- Usuários que podem decidir (exceto o solicitante): administradores ativos
-- e quem tiver um perfil com approvals.review.
create or replace function private.approval_reviewers(p_organization_id uuid, p_exclude uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct p.id
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  join public.roles r on r.id = ur.role_id and r.deleted_at is null
  where p.organization_id = p_organization_id
    and p.status = 'active' and p.deleted_at is null
    and p.id <> p_exclude
    and (
      r.code = 'admin'
      or exists (select 1 from public.role_permissions rp where rp.role_id = r.id and rp.permission_code = 'approvals.review')
    );
$$;

-- Hash do conteúdo de um registro (sem as colunas de controle de atualização).
create or replace function private.row_hash(p_table text, p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hash text;
begin
  execute format(
    'select md5((to_jsonb(t) - ''updated_at'' - ''updated_by'')::text) from public.%I t where t.id = $1', p_table)
  into v_hash using p_id;
  return v_hash;
end;
$$;

-- Lança erro se o registro foi alterado depois da solicitação.
-- Deve ser chamada após bloquear a linha (select ... for update).
create or replace function private.assert_not_stale(p_table text, p_id uuid, p_base_hash text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.row_hash(p_table, p_id) is distinct from p_base_hash then
    raise exception 'O registro foi alterado depois da solicitação. A efetivação foi bloqueada; refaça a solicitação com os dados atuais.'
      using errcode = '40001';
  end if;
end;
$$;

-- Efetiva uma solicitação chamando o handler da operação (uso interno).
create or replace function private.execute_approval(p_request public.approval_requests)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_handler text;
  v_entity uuid;
begin
  select o.handler into v_handler from public.approval_operations o where o.code = p_request.operation_code;
  execute format('select private.%I($1)', v_handler) into v_entity using p_request;
  return v_entity;
end;
$$;

-- Registra uma solicitação. Chamada pelas RPCs de cada módulo, que validam os
-- dados propostos antes. Se a regra da organização não exigir aprovação, a
-- operação é efetivada imediatamente (e o histórico fica registrado do mesmo jeito).
create or replace function private.submit_approval_request(
  p_operation_code text,
  p_entity_id uuid,
  p_department_id uuid,
  p_snapshot jsonb,
  p_proposed jsonb,
  p_base_hash text,
  p_justification text
)
returns public.approval_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_org_id();
  v_op public.approval_operations;
  v_requires boolean;
  v_request public.approval_requests;
  v_reviewer uuid;
begin
  select * into v_op from public.approval_operations o where o.code = p_operation_code;
  if not found then
    raise exception 'Operação desconhecida.' using errcode = '22023';
  end if;
  perform private.require_permission(v_op.request_permission, p_department_id);
  perform private.set_justification(p_justification);

  insert into public.approval_requests (
    organization_id, operation_code, entity_type, entity_id, department_id, justification,
    current_snapshot, proposed_data, base_hash, requested_by
  ) values (
    v_org, p_operation_code, v_op.entity_type, p_entity_id, p_department_id, btrim(p_justification),
    p_snapshot, p_proposed, p_base_hash, auth.uid()
  ) returning * into v_request;

  insert into public.approval_steps (organization_id, request_id, step_order) values (v_org, v_request.id, 1);

  select coalesce(
    (select ar.requires_approval from public.approval_rules ar where ar.organization_id = v_org and ar.operation_code = p_operation_code),
    true
  ) into v_requires;

  if not v_requires then
    -- Regra desativada: efetiva imediatamente, com registro no histórico.
    update public.approval_requests r
       set result_entity_id = private.execute_approval(v_request),
           status = 'approved', applied_at = now(), decided_at = now(),
           decision_comment = 'Efetivada automaticamente: a regra da organização não exige aprovação para esta operação.'
     where r.id = v_request.id
    returning * into v_request;
    update public.approval_steps set status = 'approved', decided_at = now() where request_id = v_request.id;
    return v_request;
  end if;

  for v_reviewer in select * from private.approval_reviewers(v_org, auth.uid()) loop
    perform private.notify(
      v_reviewer, 'approval_pending', 'Aprovação pendente',
      format('%s: solicitação aguardando sua decisão.', v_op.description),
      format('/aprovacoes/detalhe/?id=%s', v_request.id), 'approval_requests', v_request.id
    );
  end loop;

  return v_request;
end;
$$;

-- Decide uma solicitação (aprovar ou rejeitar).
create or replace function public.decide_approval(p_request_id uuid, p_decision text, p_comment text default null)
returns public.approval_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.approval_requests;
  v_step public.approval_steps;
  v_entity uuid;
  v_error text;
  v_desc text;
begin
  perform private.require_permission('approvals.review');

  select * into v_request from public.approval_requests r
  where r.id = p_request_id and r.organization_id = private.current_org_id()
  for update;
  if not found then
    raise exception 'Solicitação não encontrada.' using errcode = 'P0002';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'Esta solicitação já foi decidida ou cancelada.' using errcode = '22023';
  end if;
  if v_request.requested_by = auth.uid() then
    raise exception 'Você não pode decidir a própria solicitação. Outro administrador deve decidir.' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decisão inválida.' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and (p_comment is null or length(btrim(p_comment)) < 10) then
    raise exception 'Informe o motivo da rejeição (mínimo de 10 caracteres).' using errcode = '22023';
  end if;

  select * into v_step from public.approval_steps s
  where s.request_id = v_request.id and s.status = 'pending'
  order by s.step_order limit 1 for update;

  select o.description into v_desc from public.approval_operations o where o.code = v_request.operation_code;
  perform set_config('app.justification',
    coalesce(nullif(btrim(p_comment), ''), case when p_decision = 'approved' then 'Solicitação aprovada.' else 'Solicitação rejeitada.' end),
    true);

  insert into public.approval_decisions (organization_id, request_id, step_id, decision, comment, decided_by)
  values (v_request.organization_id, v_request.id, v_step.id, p_decision, nullif(btrim(p_comment), ''), auth.uid());
  update public.approval_steps set status = p_decision::public.approval_status, decided_by = auth.uid(), decided_at = now()
  where id = v_step.id;

  if p_decision = 'rejected' then
    update public.approval_requests
       set status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_comment = btrim(p_comment)
     where id = v_request.id
    returning * into v_request;
    perform private.notify(v_request.requested_by, 'approval_rejected', 'Solicitação rejeitada',
      format('%s: %s', v_desc, btrim(p_comment)), format('/aprovacoes/detalhe/?id=%s', v_request.id),
      'approval_requests', v_request.id);
    return v_request;
  end if;

  -- Efetivação transacional. Se falhar (ex.: registro alterado), as alterações
  -- da efetivação são desfeitas e a solicitação fica como "failed".
  begin
    v_entity := private.execute_approval(v_request);
    update public.approval_requests
       set status = 'approved', decided_by = auth.uid(), decided_at = now(),
           decision_comment = nullif(btrim(p_comment), ''), applied_at = now(), result_entity_id = v_entity
     where id = v_request.id
    returning * into v_request;
    perform private.notify(v_request.requested_by, 'approval_approved', 'Solicitação aprovada',
      format('%s: aprovada e efetivada.', v_desc), format('/aprovacoes/detalhe/?id=%s', v_request.id),
      'approval_requests', v_request.id);
  exception when others then
    get stacked diagnostics v_error = message_text;
    update public.approval_requests
       set status = 'failed', decided_by = auth.uid(), decided_at = now(),
           decision_comment = nullif(btrim(p_comment), ''), failure_reason = left(v_error, 500)
     where id = v_request.id
    returning * into v_request;
    perform private.notify(v_request.requested_by, 'approval_rejected', 'Solicitação não efetivada',
      format('%s: %s', v_desc, left(v_error, 300)), format('/aprovacoes/detalhe/?id=%s', v_request.id),
      'approval_requests', v_request.id);
  end;
  return v_request;
end;
$$;

-- O solicitante pode cancelar a própria solicitação pendente.
create or replace function public.cancel_approval_request(p_request_id uuid, p_reason text)
returns public.approval_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.approval_requests;
begin
  if not private.is_active_user() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  perform private.set_justification(p_reason);
  update public.approval_requests r
     set status = 'cancelled', cancelled_at = now(), decision_comment = btrim(p_reason)
   where r.id = p_request_id and r.requested_by = auth.uid() and r.status = 'pending'
  returning * into v_request;
  if not found then
    raise exception 'Somente o solicitante pode cancelar uma solicitação pendente.' using errcode = '42501';
  end if;
  update public.approval_steps set status = 'cancelled' where request_id = v_request.id and status = 'pending';
  return v_request;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.approval_operations enable row level security;
alter table public.approval_rules enable row level security;
alter table public.approval_requests enable row level security;
alter table public.approval_steps enable row level security;
alter table public.approval_decisions enable row level security;
revoke all on public.approval_operations, public.approval_rules, public.approval_requests,
  public.approval_steps, public.approval_decisions from anon;

create policy approval_operations_select on public.approval_operations
  for select to authenticated using (private.is_active_user());

create policy approval_rules_select on public.approval_rules
  for select to authenticated using (organization_id = private.current_org_id());
create policy approval_rules_update on public.approval_rules
  for update to authenticated
  using (organization_id = private.current_org_id() and private.has_permission('settings.manage'))
  with check (organization_id = private.current_org_id() and private.has_permission('settings.manage'));

-- Solicitações: o próprio solicitante ou quem decide.
create policy approval_requests_select on public.approval_requests
  for select to authenticated
  using (
    organization_id = private.current_org_id()
    and (requested_by = (select auth.uid()) or private.has_permission('approvals.review'))
  );
create policy approval_steps_select on public.approval_steps
  for select to authenticated
  using (exists (select 1 from public.approval_requests r where r.id = approval_steps.request_id));
create policy approval_decisions_select on public.approval_decisions
  for select to authenticated
  using (exists (select 1 from public.approval_requests r where r.id = approval_decisions.request_id));

-- Tipos de notificação do módulo passam a estar disponíveis.
update public.notification_types set is_available = true
 where code in ('approval_pending', 'approval_approved', 'approval_rejected');

revoke execute on function public.decide_approval(uuid, text, text) from public, anon;
revoke execute on function public.cancel_approval_request(uuid, text) from public, anon;
grant execute on function public.decide_approval(uuid, text, text) to authenticated;
grant execute on function public.cancel_approval_request(uuid, text) to authenticated;
grant execute on all functions in schema private to authenticated, service_role;
