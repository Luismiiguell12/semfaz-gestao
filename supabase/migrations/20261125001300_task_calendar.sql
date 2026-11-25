-- =============================================================================
-- SEMFAZ Gestão — Fase 4 (parte 2): calendário, anexos de demandas, rotina de
-- prazos e indicadores do painel.
--  * task_events: reuniões, compromissos, prazos e lembretes (com participantes).
--  * calendar_items(de, até): demandas (pelo prazo) + eventos, com RLS do usuário.
--  * Anexos de demandas pela infraestrutura de documentos (entity_type 'task').
--  * Rotina diária: notificações de prazo próximo e de atraso (uma vez por pessoa).
--  * dashboard_task_stats(): demandas por status, atrasadas e próximos compromissos.
-- =============================================================================

create type public.task_event_kind as enum ('meeting', 'appointment', 'deadline', 'reminder');

create table public.task_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  kind public.task_event_kind not null,
  title text not null check (length(btrim(title)) between 3 and 200),
  description text check (description is null or length(description) <= 4000),
  location text check (location is null or length(location) <= 200),
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  task_id uuid,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  constraint task_events_id_org_key unique (id, organization_id),
  constraint task_events_task_fk foreign key (task_id, organization_id) references public.tasks (id, organization_id),
  constraint task_events_period check (ends_at is null or ends_at >= starts_at)
);
create index task_events_period_idx on public.task_events (organization_id, starts_at) where cancelled_at is null;
create index task_events_task_idx on public.task_events (task_id);

create table public.task_event_attendees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  event_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  constraint task_event_attendees_unique unique (event_id, user_id),
  constraint task_event_attendees_event_fk foreign key (event_id, organization_id) references public.task_events (id, organization_id),
  constraint task_event_attendees_user_fk foreign key (user_id, organization_id) references public.profiles (id, organization_id)
);
create index task_event_attendees_user_idx on public.task_event_attendees (user_id);

create trigger task_events_actor before insert or update on public.task_events
  for each row execute function private.tg_set_actor_columns();
create trigger task_events_audit after insert or update or delete on public.task_events
  for each row execute function private.tg_audit('tasks');
create trigger task_events_no_delete before delete on public.task_events
  for each row execute function private.tg_prevent_physical_delete();
create trigger task_event_attendees_actor before insert or update on public.task_event_attendees
  for each row execute function private.tg_set_actor_columns();
create trigger task_event_attendees_audit after insert or update or delete on public.task_event_attendees
  for each row execute function private.tg_audit('tasks');

-- Vê o evento: quem criou, participantes do evento ou quem vê a demanda vinculada.
create or replace function private.can_view_task_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.task_events e
    where e.id = p_event_id and e.organization_id = private.current_org_id() and private.is_active_user()
      and (e.created_by = (select auth.uid())
           or exists (select 1 from public.task_event_attendees a where a.event_id = e.id and a.user_id = (select auth.uid()))
           or (e.task_id is not null and private.can_view_task(e.task_id)))
  );
$$;

create or replace function private.can_edit_task_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.task_events e
    where e.id = p_event_id and e.organization_id = private.current_org_id() and private.is_active_user()
      and e.cancelled_at is null
      and (e.created_by = (select auth.uid()) or (e.task_id is not null and private.can_edit_task(e.task_id)))
  );
$$;
alter function private.can_view_task_event(uuid) cost 1000;
alter function private.can_edit_task_event(uuid) cost 1000;

alter table public.task_events enable row level security;
alter table public.task_event_attendees enable row level security;
revoke all on public.task_events, public.task_event_attendees from anon;
revoke insert, update, delete, truncate on public.task_events, public.task_event_attendees from authenticated;
grant select on public.task_events, public.task_event_attendees to authenticated;
create policy task_events_select on public.task_events
  for select to authenticated using (private.can_view_task_event(id));
create policy task_event_attendees_select on public.task_event_attendees
  for select to authenticated using (private.can_view_task_event(event_id));

-- Cria ou edita um evento. p_data: kind, title, description, location, starts_at,
-- ends_at, all_day, task_id, attendees (uuid[]).
create or replace function public.save_task_event(p_event_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_org_id();
  v_task uuid := nullif(p_data->>'task_id', '')::uuid;
  v_attendees uuid[];
  v_id uuid;
  v_u uuid;
begin
  if not private.is_active_user() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if v_task is not null and not private.can_work_task(v_task) then
    raise exception 'Demanda vinculada não encontrada ou sem permissão.' using errcode = '42501';
  end if;
  if v_task is null then
    perform private.require_permission('tasks.create');
  end if;
  select coalesce(array_agg(distinct x::uuid), '{}') into v_attendees
  from jsonb_array_elements_text(coalesce(p_data->'attendees', '[]'::jsonb)) x where x <> '';
  foreach v_u in array v_attendees loop
    perform private.assert_task_user(v_u, 'Participante');
  end loop;

  if p_event_id is null then
    insert into public.task_events (organization_id, kind, title, description, location, starts_at, ends_at, all_day, task_id)
    values (v_org, (p_data->>'kind')::public.task_event_kind, btrim(p_data->>'title'),
            nullif(btrim(p_data->>'description'), ''), nullif(btrim(p_data->>'location'), ''),
            (p_data->>'starts_at')::timestamptz, nullif(p_data->>'ends_at', '')::timestamptz,
            coalesce((p_data->>'all_day')::boolean, false), v_task)
    returning id into v_id;
  else
    if not private.can_edit_task_event(p_event_id) then
      raise exception 'Evento não encontrado ou sem permissão para editar.' using errcode = '42501';
    end if;
    update public.task_events
       set kind = (p_data->>'kind')::public.task_event_kind, title = btrim(p_data->>'title'),
           description = nullif(btrim(p_data->>'description'), ''), location = nullif(btrim(p_data->>'location'), ''),
           starts_at = (p_data->>'starts_at')::timestamptz, ends_at = nullif(p_data->>'ends_at', '')::timestamptz,
           all_day = coalesce((p_data->>'all_day')::boolean, false), task_id = v_task
     where id = p_event_id
    returning id into v_id;
    delete from public.task_event_attendees a where a.event_id = v_id and not (a.user_id = any (v_attendees));
  end if;
  insert into public.task_event_attendees (organization_id, event_id, user_id)
  select v_org, v_id, u from unnest(v_attendees) u
  on conflict (event_id, user_id) do nothing;
  return v_id;
end;
$$;

create or replace function public.cancel_task_event(p_event_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_edit_task_event(p_event_id) then
    raise exception 'Evento não encontrado ou sem permissão.' using errcode = '42501';
  end if;
  perform private.set_justification(p_reason);
  update public.task_events set cancelled_at = now(), cancellation_reason = btrim(p_reason) where id = p_event_id;
end;
$$;

-- Itens do calendário no período (datas no fuso de Maceió), com a RLS do usuário.
create or replace function public.calendar_items(p_from date, p_to date)
returns table (
  item_type text, id uuid, title text, starts_at timestamptz, ends_at timestamptz, all_day boolean,
  event_kind text, task_id uuid, task_status text, is_overdue boolean, responsible_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select 'event', e.id, e.title, e.starts_at, e.ends_at, e.all_day, e.kind::text, e.task_id, null, false, null
  from public.task_events e
  where e.cancelled_at is null
    and e.starts_at < ((p_to + 1)::timestamp at time zone 'America/Maceio')
    and coalesce(e.ends_at, e.starts_at) >= (p_from::timestamp at time zone 'America/Maceio')
  union all
  select 'task', t.id, t.title,
         ((t.due_date + coalesce(t.due_time, time '00:00'))::timestamp at time zone 'America/Maceio'),
         null, t.due_time is null, null, t.id, t.status::text, t.is_overdue, t.responsible_name
  from public.tasks_overview t
  where t.due_date between p_from and p_to and t.status <> 'cancelled'
  order by 4;
$$;

-- -----------------------------------------------------------------------------
-- Anexos de demandas (documentos)
-- -----------------------------------------------------------------------------
alter table public.documents drop constraint documents_entity_type_check;
alter table public.documents add constraint documents_entity_type_check
  check (entity_type in ('department', 'property', 'contract', 'amendment', 'approval_request',
                         'invoice', 'rent_charge', 'payment', 'consumer_unit', 'task'));

alter function private.can_access_document_entity(text, uuid, text) rename to can_access_document_entity_finance;
create or replace function private.can_access_document_entity(p_entity_type text, p_entity_id uuid, p_action text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_entity_type = 'task' then
    if not private.is_active_user() or p_action not in ('view', 'attach') then
      return false;
    end if;
    return case when p_action = 'view' then private.can_view_task(p_entity_id) else private.can_work_task(p_entity_id) end;
  end if;
  return private.can_access_document_entity_finance(p_entity_type, p_entity_id, p_action);
end;
$$;

-- -----------------------------------------------------------------------------
-- Rotina diária: prazo próximo e atraso (cada pessoa é avisada uma vez).
-- -----------------------------------------------------------------------------
insert into public.system_settings (organization_id, key, value, description)
select o.id, 'tasks.due_soon_days', '2'::jsonb, 'Dias antes do prazo para avisar que a demanda está próxima do vencimento.'
from public.organizations o
on conflict (organization_id, key) do nothing;

create or replace function private.generate_task_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := private.today_local();
  v_now_time time := (now() at time zone 'America/Maceio')::time;
  r record;
  v_user uuid;
  v_type text;
  v_count int := 0;
  v_days int;
begin
  for r in
    select t.*, coalesce((s.value #>> '{}')::int, 2) as soon_days
    from public.tasks t
    left join public.system_settings s on s.organization_id = t.organization_id and s.key = 'tasks.due_soon_days'
    where t.deleted_at is null and t.status not in ('done', 'cancelled') and t.due_date is not null
      and t.due_date <= v_today + 30
  loop
    v_days := r.soon_days;
    if r.due_date < v_today or (r.due_date = v_today and r.due_time is not null and r.due_time < v_now_time) then
      v_type := 'task_overdue';
    elsif r.due_date <= v_today + v_days then
      v_type := 'task_due_soon';
    else
      continue;
    end if;
    for v_user in
      select distinct u from (
        select r.responsible_id as u
        union all select a.user_id from public.task_assignees a where a.task_id = r.id
      ) s
    loop
      if not exists (select 1 from public.notifications n
                     where n.user_id = v_user and n.type_code = v_type and n.entity_id = r.id) then
        perform private.notify(v_user, v_type,
          case when v_type = 'task_overdue' then 'Demanda em atraso' else 'Prazo próximo' end,
          format('Demanda "%s": prazo em %s.', r.title, to_char(r.due_date, 'DD/MM/YYYY')),
          format('/demandas/detalhe/?id=%s', r.id), 'tasks', r.id);
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;
  return v_count;
end;
$$;
revoke all on function private.generate_task_reminders() from public, anon, authenticated;

-- 06:10 de Maceió (09:10 UTC).
select cron.schedule('semfaz-task-reminders', '10 9 * * *', 'select private.generate_task_reminders()');

-- -----------------------------------------------------------------------------
-- Painel: demandas (RLS do usuário)
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_task_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with t as (select * from public.tasks_overview)
  select jsonb_build_object(
    'open', (select count(*) from t where status in ('todo', 'in_progress', 'waiting', 'review')),
    'in_progress', (select count(*) from t where status = 'in_progress'),
    'done', (select count(*) from t where status = 'done'),
    'overdue', (select count(*) from t where is_overdue),
    'mine_open', (select count(*) from t where status in ('todo', 'in_progress', 'waiting', 'review')
                    and (responsible_id = auth.uid()
                         or exists (select 1 from public.task_assignees a where a.task_id = t.id and a.user_id = auth.uid()))),
    'by_status', (select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb)
                  from (select status::text, count(*) as n from t group by status) s),
    'upcoming', (select coalesce(jsonb_agg(c order by c.starts_at), '[]'::jsonb) from (
                   select * from public.calendar_items(private.today_local(), private.today_local() + 7) ci
                   where ci.item_type = 'event' or ci.task_status not in ('done', 'cancelled')
                   order by ci.starts_at limit 8) c),
    'can_create', private.has_permission('tasks.create')
  );
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.save_task_event(uuid, jsonb)',
    'public.cancel_task_event(uuid, text)',
    'public.calendar_items(date, date)',
    'public.dashboard_task_stats()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
grant execute on function private.can_view_task_event(uuid), private.can_edit_task_event(uuid),
  private.can_access_document_entity(text, uuid, text), private.can_access_document_entity_finance(text, uuid, text)
  to authenticated, service_role;
