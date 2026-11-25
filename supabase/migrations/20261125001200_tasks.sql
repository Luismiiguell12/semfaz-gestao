-- =============================================================================
-- SEMFAZ Gestão — Fase 4 (parte 1): demandas.
-- Tabelas: task_categories, tasks, task_assignees, task_comments,
-- task_status_history; visão task_deletion_requests (sobre a Central de
-- Aprovações) e tasks_overview. Anexos usam a infraestrutura de documentos
-- (entity_type 'task'). Escritas somente por RPC com verificação de acesso.
-- Exclusão: sempre lógica e sempre por aprovação (não pode ser desativada).
-- =============================================================================

create type public.task_status as enum ('todo', 'in_progress', 'waiting', 'review', 'done', 'cancelled');
create type public.task_urgency as enum ('low', 'medium', 'high', 'critical');
create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.task_complexity as enum ('simple', 'medium', 'complex', 'very_complex');

-- -----------------------------------------------------------------------------
-- Categorias
-- -----------------------------------------------------------------------------
create table public.task_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null check (length(btrim(name)) between 2 and 80),
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  constraint task_categories_id_org_key unique (id, organization_id)
);
create unique index task_categories_name_per_org on public.task_categories (organization_id, lower(name));
create trigger task_categories_actor before insert or update on public.task_categories
  for each row execute function private.tg_set_actor_columns();
create trigger task_categories_audit after insert or update or delete on public.task_categories
  for each row execute function private.tg_audit('tasks');
create trigger task_categories_no_delete before delete on public.task_categories
  for each row execute function private.tg_prevent_physical_delete();

-- Categorias iniciais (também no seed, para bancos novos).
insert into public.task_categories (organization_id, name, is_system)
select o.id, c.name, true
from public.organizations o
cross join (values ('Financeiro'), ('Contratos'), ('Licitações e compras'), ('Atendimento'),
                   ('Controle administrativo'), ('Relatórios'), ('Outros')) as c(name)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Demandas
-- -----------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  -- Secretaria (ou outro departamento) da demanda: define o escopo de quem
  -- acompanha todas as demandas (tasks.view_all). Participantes sempre veem.
  department_id uuid not null,
  title text not null check (length(btrim(title)) between 3 and 200),
  description text check (description is null or length(description) <= 10000),
  requester_user_id uuid,
  requester_name text check (requester_name is null or length(btrim(requester_name)) between 2 and 200),
  responsible_id uuid not null,
  category_id uuid not null,
  start_date date,
  due_date date,
  due_time time,
  urgency public.task_urgency not null default 'medium',
  priority public.task_priority not null default 'normal',
  complexity public.task_complexity not null default 'medium',
  status public.task_status not null default 'todo',
  completed_at timestamptz,
  completed_by uuid references auth.users (id),
  completion_note text check (completion_note is null or length(completion_note) <= 2000),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Criador: preenchido pelo trigger com auth.uid(), nunca aceito do cliente.
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id),
  deletion_reason text,
  constraint tasks_id_org_key unique (id, organization_id),
  constraint tasks_department_fk foreign key (department_id, organization_id) references public.departments (id, organization_id),
  constraint tasks_category_fk foreign key (category_id, organization_id) references public.task_categories (id, organization_id),
  constraint tasks_responsible_fk foreign key (responsible_id, organization_id) references public.profiles (id, organization_id),
  constraint tasks_requester_fk foreign key (requester_user_id, organization_id) references public.profiles (id, organization_id),
  constraint tasks_dates check (start_date is null or due_date is null or due_date >= start_date),
  constraint tasks_time_needs_date check (due_time is null or due_date is not null)
);
create index tasks_org_status_idx on public.tasks (organization_id, status) where deleted_at is null;
create index tasks_responsible_idx on public.tasks (responsible_id) where deleted_at is null;
create index tasks_due_idx on public.tasks (due_date) where deleted_at is null;
create index tasks_department_idx on public.tasks (department_id);
comment on table public.tasks is 'Demandas. Atraso é calculado pelo prazo (America/Maceio), sem alterar o status. Exclusão somente lógica, por aprovação.';

-- Participantes. O responsável principal também consta aqui (papel "responsible").
-- participation_weight: RESERVADO para a pontuação futura (Fase 5+); não usado nesta versão.
create table public.task_assignees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  task_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('responsible', 'participant')),
  participation_weight numeric(5, 2) check (participation_weight is null or participation_weight between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  constraint task_assignees_unique unique (task_id, user_id),
  constraint task_assignees_task_fk foreign key (task_id, organization_id) references public.tasks (id, organization_id),
  constraint task_assignees_user_fk foreign key (user_id, organization_id) references public.profiles (id, organization_id)
);
create index task_assignees_user_idx on public.task_assignees (user_id);
create unique index task_assignees_one_responsible on public.task_assignees (task_id) where role = 'responsible';

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  task_id uuid not null,
  author_id uuid not null default auth.uid() references auth.users (id),
  body text not null check (length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  constraint task_comments_task_fk foreign key (task_id, organization_id) references public.tasks (id, organization_id)
);
create index task_comments_task_idx on public.task_comments (task_id, created_at);

create table public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  task_id uuid not null,
  from_status public.task_status,
  to_status public.task_status not null,
  changed_by uuid references auth.users (id),
  changed_at timestamptz not null default now(),
  note text check (note is null or length(note) <= 2000),
  constraint task_status_history_task_fk foreign key (task_id, organization_id) references public.tasks (id, organization_id)
);
create index task_status_history_task_idx on public.task_status_history (task_id, changed_at);

-- Triggers ------------------------------------------------------------------
create or replace function private.tg_task_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status = 'done' then
      new.completed_at := now();
      new.completed_by := auth.uid();
    elsif tg_op = 'UPDATE' and old.status = 'done' then
      new.completed_at := null;
      new.completed_by := null;
      new.completion_note := null;
    end if;
    if new.status = 'cancelled' then
      new.cancelled_at := now();
    elsif tg_op = 'UPDATE' and old.status = 'cancelled' then
      new.cancelled_at := null;
    end if;
  elsif tg_op = 'UPDATE' then
    -- Registro de conclusão só muda junto com o status.
    new.completed_at := old.completed_at;
    new.completed_by := old.completed_by;
    new.cancelled_at := old.cancelled_at;
  end if;
  return new;
end;
$$;

create or replace function private.tg_task_status_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.task_status_history (organization_id, task_id, from_status, to_status, changed_by, note)
    values (new.organization_id, new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid(),
            nullif(btrim(current_setting('app.task_status_note', true)), ''));
  end if;
  return null;
end;
$$;

create trigger tasks_status before insert or update on public.tasks
  for each row execute function private.tg_task_status();
create trigger tasks_actor before insert or update on public.tasks
  for each row execute function private.tg_set_actor_columns();
create trigger tasks_status_history after insert or update on public.tasks
  for each row execute function private.tg_task_status_history();
create trigger tasks_audit after insert or update or delete on public.tasks
  for each row execute function private.tg_audit('tasks');
create trigger tasks_no_delete before delete on public.tasks
  for each row execute function private.tg_prevent_physical_delete();

create trigger task_assignees_actor before insert or update on public.task_assignees
  for each row execute function private.tg_set_actor_columns();
create trigger task_assignees_audit after insert or update or delete on public.task_assignees
  for each row execute function private.tg_audit('tasks');

create trigger task_comments_audit after insert on public.task_comments
  for each row execute function private.tg_audit('tasks');
create trigger task_comments_immutable before update or delete on public.task_comments
  for each row execute function private.tg_immutable_row();
create trigger task_status_history_immutable before update or delete on public.task_status_history
  for each row execute function private.tg_immutable_row();

-- -----------------------------------------------------------------------------
-- Autorização
-- -----------------------------------------------------------------------------
-- Participa da demanda: criador, responsável ou participante.
create or replace function private.task_is_member(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and (t.created_by = (select auth.uid()) or t.responsible_id = (select auth.uid())
           or exists (select 1 from public.task_assignees a where a.task_id = t.id and a.user_id = (select auth.uid())))
  );
$$;

-- Vê a demanda: participa dela ou acompanha as demandas do escopo (tasks.view_all).
create or replace function private.can_view_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id and t.deleted_at is null and t.organization_id = private.current_org_id()
      and private.is_active_user()
      and (private.task_is_member(t.id) or private.has_permission('tasks.view_all', t.department_id))
  );
$$;

-- Edita dados: criador, responsável ou quem acompanha o escopo (gestor).
create or replace function private.can_edit_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id and t.deleted_at is null and t.organization_id = private.current_org_id()
      and private.is_active_user()
      and (t.created_by = (select auth.uid()) or t.responsible_id = (select auth.uid())
           or private.has_permission('tasks.view_all', t.department_id))
  );
$$;

-- Trabalha na demanda (status, comentários, anexos): quem edita ou participa.
create or replace function private.can_work_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_edit_task(p_task_id)
      or (private.can_view_task(p_task_id) and private.task_is_member(p_task_id));
$$;

alter function private.task_is_member(uuid) cost 500;
alter function private.can_view_task(uuid) cost 1000;
alter function private.can_edit_task(uuid) cost 1000;
alter function private.can_work_task(uuid) cost 1000;

-- -----------------------------------------------------------------------------
-- RLS (escrita somente por RPC)
-- -----------------------------------------------------------------------------
alter table public.task_categories enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_status_history enable row level security;
revoke all on public.task_categories, public.tasks, public.task_assignees, public.task_comments,
  public.task_status_history from anon;
revoke insert, update, delete, truncate on public.tasks, public.task_assignees, public.task_comments,
  public.task_status_history from authenticated;
grant select on public.task_categories, public.tasks, public.task_assignees, public.task_comments,
  public.task_status_history to authenticated;
grant insert, update on public.task_categories to authenticated;

create policy task_categories_select on public.task_categories
  for select to authenticated using (organization_id = private.current_org_id() and private.is_active_user());
create policy task_categories_insert on public.task_categories
  for insert to authenticated
  with check (organization_id = private.current_org_id() and private.has_permission('tasks.categories.manage') and not is_system);
create policy task_categories_update on public.task_categories
  for update to authenticated
  using (organization_id = private.current_org_id() and private.has_permission('tasks.categories.manage'))
  with check (organization_id = private.current_org_id() and private.has_permission('tasks.categories.manage'));

create policy tasks_select on public.tasks
  for select to authenticated using (deleted_at is null and private.can_view_task(id));
create policy task_assignees_select on public.task_assignees
  for select to authenticated using (private.can_view_task(task_id));
create policy task_comments_select on public.task_comments
  for select to authenticated using (private.can_view_task(task_id));
create policy task_status_history_select on public.task_status_history
  for select to authenticated using (private.can_view_task(task_id));

-- -----------------------------------------------------------------------------
-- Visão com atraso calculado (America/Maceio) e nomes para a interface.
-- -----------------------------------------------------------------------------
create view public.tasks_overview
with (security_invoker = true)
as
select
  t.*,
  c.name as category_name,
  d.name as department_name,
  rp.full_name as responsible_name,
  (t.status not in ('done', 'cancelled') and t.due_date is not null
   and (t.due_date < private.today_local()
        or (t.due_date = private.today_local() and t.due_time is not null
            and t.due_time < (now() at time zone 'America/Maceio')::time))) as is_overdue,
  (select count(*) from public.task_comments tc where tc.task_id = t.id)::int as comments_count,
  (select count(*) from public.task_assignees ta where ta.task_id = t.id and ta.role = 'participant')::int as participants_count
from public.tasks t
join public.task_categories c on c.id = t.category_id
left join public.departments d on d.id = t.department_id
left join public.user_directory rp on rp.id = t.responsible_id
where t.deleted_at is null;
revoke all on public.tasks_overview from anon;
grant select on public.tasks_overview to authenticated;

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------
-- Valida o usuário atribuído (ativo, mesma organização).
create or replace function private.assert_task_user(p_user_id uuid, p_label text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p
                 where p.id = p_user_id and p.organization_id = private.current_org_id()
                   and p.status = 'active' and p.deleted_at is null) then
    raise exception '%: selecione um usuário ativo.', p_label using errcode = '22023';
  end if;
end;
$$;

-- Notifica os envolvidos (exceto quem fez a ação).
create or replace function private.notify_task(p_task_id uuid, p_type text, p_title text, p_body text, p_users uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  for v_user in select distinct u from unnest(p_users) u where u is not null and u is distinct from auth.uid() loop
    perform private.notify(v_user, p_type, p_title, p_body, format('/demandas/detalhe/?id=%s', p_task_id), 'tasks', p_task_id);
  end loop;
end;
$$;

create or replace function private.task_people(p_task_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_agg(distinct u) from (
    select t.created_by as u from public.tasks t where t.id = p_task_id
    union all select t.responsible_id from public.tasks t where t.id = p_task_id
    union all select a.user_id from public.task_assignees a where a.task_id = p_task_id
  ) s where u is not null;
$$;

-- Cria ou edita a demanda. Status muda por set_task_status.
-- p_data: title, description, department_id, category_id, responsible_id, participants (uuid[]),
--         requester_user_id, requester_name, start_date, due_date, due_time, urgency, priority, complexity
create or replace function public.save_task(p_task_id uuid, p_data jsonb, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_org_id();
  v_dept uuid := nullif(p_data->>'department_id', '')::uuid;
  v_resp uuid := nullif(p_data->>'responsible_id', '')::uuid;
  v_cat uuid := nullif(p_data->>'category_id', '')::uuid;
  v_participants uuid[];
  v_old public.tasks;
  v_id uuid;
  v_p uuid;
  v_title text := btrim(coalesce(p_data->>'title', ''));
begin
  select coalesce(array_agg(distinct x::uuid), '{}') into v_participants
  from jsonb_array_elements_text(coalesce(p_data->'participants', '[]'::jsonb)) x where x <> '';
  v_participants := array_remove(v_participants, v_resp);

  if v_dept is null or not exists (select 1 from public.departments d where d.id = v_dept and d.organization_id = v_org and d.deleted_at is null) then
    raise exception 'Selecione a secretaria da demanda.' using errcode = '22023';
  end if;
  if v_resp is null then
    raise exception 'Selecione o responsável principal.' using errcode = '22023';
  end if;
  perform private.assert_task_user(v_resp, 'Responsável');
  foreach v_p in array v_participants loop
    perform private.assert_task_user(v_p, 'Participante');
  end loop;
  if nullif(p_data->>'requester_user_id', '') is not null then
    perform private.assert_task_user((p_data->>'requester_user_id')::uuid, 'Solicitante');
  end if;

  if p_task_id is null then
    perform private.require_permission('tasks.create');
    if not private.department_in_scope(v_dept) then
      raise exception 'A secretaria escolhida está fora do seu escopo.' using errcode = '42501';
    end if;
    if not exists (select 1 from public.task_categories c where c.id = v_cat and c.organization_id = v_org and c.is_active) then
      raise exception 'Selecione uma categoria ativa.' using errcode = '22023';
    end if;
    insert into public.tasks (organization_id, department_id, title, description, requester_user_id, requester_name,
                              responsible_id, category_id, start_date, due_date, due_time, urgency, priority, complexity)
    values (v_org, v_dept, v_title, nullif(btrim(p_data->>'description'), ''),
            nullif(p_data->>'requester_user_id', '')::uuid, nullif(btrim(p_data->>'requester_name'), ''),
            v_resp, v_cat, nullif(p_data->>'start_date', '')::date, nullif(p_data->>'due_date', '')::date,
            nullif(p_data->>'due_time', '')::time,
            coalesce(nullif(p_data->>'urgency', ''), 'medium')::public.task_urgency,
            coalesce(nullif(p_data->>'priority', ''), 'normal')::public.task_priority,
            coalesce(nullif(p_data->>'complexity', ''), 'medium')::public.task_complexity)
    returning id into v_id;
    insert into public.task_assignees (organization_id, task_id, user_id, role) values (v_org, v_id, v_resp, 'responsible');
    insert into public.task_assignees (organization_id, task_id, user_id, role)
    select v_org, v_id, u, 'participant' from unnest(v_participants) u;
    perform private.notify_task(v_id, 'task_created', 'Nova demanda',
      format('Você foi incluído na demanda "%s".', v_title), array_append(v_participants, v_resp));
    return v_id;
  end if;

  select * into v_old from public.tasks t where t.id = p_task_id and t.organization_id = v_org and t.deleted_at is null for update;
  if not found or not private.can_edit_task(p_task_id) then
    raise exception 'Demanda não encontrada ou sem permissão para editar.' using errcode = '42501';
  end if;
  if v_dept <> v_old.department_id and not private.department_in_scope(v_dept) then
    raise exception 'A secretaria escolhida está fora do seu escopo.' using errcode = '42501';
  end if;
  if v_cat <> v_old.category_id and not exists (select 1 from public.task_categories c where c.id = v_cat and c.organization_id = v_org and c.is_active) then
    raise exception 'Selecione uma categoria ativa.' using errcode = '22023';
  end if;
  perform set_config('app.justification', coalesce(nullif(btrim(p_reason), ''), 'Edição da demanda.'), true);
  update public.tasks
     set title = v_title, description = nullif(btrim(p_data->>'description'), ''), department_id = v_dept,
         requester_user_id = nullif(p_data->>'requester_user_id', '')::uuid,
         requester_name = nullif(btrim(p_data->>'requester_name'), ''),
         responsible_id = v_resp, category_id = v_cat,
         start_date = nullif(p_data->>'start_date', '')::date, due_date = nullif(p_data->>'due_date', '')::date,
         due_time = nullif(p_data->>'due_time', '')::time,
         urgency = coalesce(nullif(p_data->>'urgency', ''), urgency::text)::public.task_urgency,
         priority = coalesce(nullif(p_data->>'priority', ''), priority::text)::public.task_priority,
         complexity = coalesce(nullif(p_data->>'complexity', ''), complexity::text)::public.task_complexity
   where id = p_task_id;

  -- Participantes: remove os que saíram, inclui os novos (vínculos auditados).
  delete from public.task_assignees a
   where a.task_id = p_task_id and (a.user_id <> v_resp or a.role <> 'responsible')
     and not (a.user_id = any (v_participants) and a.role = 'participant');
  if v_resp <> v_old.responsible_id then
    delete from public.task_assignees a where a.task_id = p_task_id and a.role = 'responsible';
    insert into public.task_assignees (organization_id, task_id, user_id, role) values (v_org, p_task_id, v_resp, 'responsible')
    on conflict (task_id, user_id) do update set role = 'responsible';
    perform private.notify_task(p_task_id, 'task_assignee_changed', 'Você é o novo responsável',
      format('Você passou a ser o responsável pela demanda "%s".', v_title), array[v_resp]);
  end if;
  insert into public.task_assignees (organization_id, task_id, user_id, role)
  select v_org, p_task_id, u, 'participant' from unnest(v_participants) u
  where not exists (select 1 from public.task_assignees a where a.task_id = p_task_id and a.user_id = u);
  return p_task_id;
end;
$$;

-- Muda o status (kanban, detalhe). Conclusão exige tasks.complete.
create or replace function public.set_task_status(p_task_id uuid, p_status public.task_status, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tasks;
begin
  select * into v_t from public.tasks t
  where t.id = p_task_id and t.organization_id = private.current_org_id() and t.deleted_at is null for update;
  if not found or not private.can_work_task(p_task_id) then
    raise exception 'Demanda não encontrada ou sem permissão.' using errcode = '42501';
  end if;
  if v_t.status = p_status then
    return;
  end if;
  if p_status = 'done' then
    perform private.require_permission('tasks.complete');
  end if;
  if (p_status = 'cancelled' or v_t.status in ('done', 'cancelled')) and not private.can_edit_task(p_task_id) then
    raise exception 'Somente o criador, o responsável ou o gestor podem cancelar ou reabrir a demanda.' using errcode = '42501';
  end if;
  if p_status = 'cancelled' and length(btrim(coalesce(p_note, ''))) < 10 then
    raise exception 'Informe o motivo do cancelamento (mínimo de 10 caracteres).' using errcode = '22023';
  end if;
  perform set_config('app.task_status_note', coalesce(p_note, ''), true);
  perform set_config('app.justification', coalesce(nullif(btrim(p_note), ''), 'Alteração de status da demanda.'), true);
  update public.tasks
     set status = p_status,
         completion_note = case when p_status = 'done' then nullif(btrim(p_note), '') else completion_note end
   where id = p_task_id;
  if p_status = 'done' then
    perform private.notify_task(p_task_id, 'task_completed', 'Demanda concluída',
      format('A demanda "%s" foi concluída.', v_t.title), private.task_people(p_task_id));
  elsif p_status = 'review' then
    perform private.notify_task(p_task_id, 'task_review', 'Demanda em revisão',
      format('A demanda "%s" aguarda revisão.', v_t.title), array[v_t.created_by, v_t.responsible_id]);
  end if;
end;
$$;

create or replace function public.add_task_comment(p_task_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tasks;
  v_id uuid;
begin
  select * into v_t from public.tasks t where t.id = p_task_id and t.deleted_at is null;
  if not found or not private.can_view_task(p_task_id) then
    raise exception 'Demanda não encontrada.' using errcode = 'P0002';
  end if;
  if length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'Escreva o comentário.' using errcode = '22023';
  end if;
  insert into public.task_comments (organization_id, task_id, author_id, body)
  values (v_t.organization_id, p_task_id, auth.uid(), btrim(p_body))
  returning id into v_id;
  perform private.notify_task(p_task_id, 'task_comment', 'Novo comentário',
    format('Novo comentário na demanda "%s".', v_t.title), private.task_people(p_task_id));
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Exclusão: sempre por aprovação (não existe exclusão imediata).
-- -----------------------------------------------------------------------------
alter table public.approval_operations add column approval_mandatory boolean not null default false;
comment on column public.approval_operations.approval_mandatory is
  'Quando verdadeiro, a operação sempre exige aprovação: a regra da organização não pode desativá-la.';

insert into public.approval_operations (code, module, entity_type, description, handler, request_permission, approval_mandatory) values
  ('task.delete', 'tasks', 'task', 'Exclusão de demanda (solicitada pelo criador)', 'apply_task_delete', 'tasks.delete_own', true),
  ('task.delete_exceptional', 'tasks', 'task', 'Exclusão excepcional de demanda', 'apply_task_delete', 'tasks.delete_any', true)
on conflict (code) do nothing;
insert into public.approval_rules (organization_id, operation_code, requires_approval)
select o.id, op.code, true from public.organizations o
cross join (values ('task.delete'), ('task.delete_exceptional')) op(code)
on conflict (organization_id, operation_code) do update set requires_approval = true;

create or replace function private.tg_approval_rules_mandatory()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not new.requires_approval and exists (
    select 1 from public.approval_operations o where o.code = new.operation_code and o.approval_mandatory) then
    raise exception 'Esta operação sempre exige aprovação e não pode ser dispensada.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger approval_rules_mandatory before insert or update on public.approval_rules
  for each row execute function private.tg_approval_rules_mandatory();

-- Motor: a obrigatoriedade prevalece sobre a regra da organização.
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

  select v_op.approval_mandatory or coalesce(
    (select ar.requires_approval from public.approval_rules ar where ar.organization_id = v_org and ar.operation_code = p_operation_code),
    true
  ) into v_requires;

  if not v_requires then
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

-- Criador solicita a exclusão da própria demanda.
create or replace function public.request_task_deletion(p_task_id uuid, p_justification text)
returns public.approval_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tasks;
begin
  select * into v_t from public.tasks t
  where t.id = p_task_id and t.organization_id = private.current_org_id() and t.deleted_at is null;
  if not found or not private.can_view_task(p_task_id) then
    raise exception 'Demanda não encontrada.' using errcode = 'P0002';
  end if;
  if v_t.created_by is distinct from auth.uid() then
    raise exception 'Somente o criador pode solicitar a exclusão da demanda.' using errcode = '42501';
  end if;
  return private.submit_approval_request('task.delete', p_task_id, null,
    jsonb_build_object('title', v_t.title, 'status', v_t.status),
    jsonb_build_object('title', v_t.title, 'deleted', true), null, p_justification);
end;
$$;

-- Exclusão excepcional (ex.: criador inativo), solicitada por administrador e
-- decidida por OUTRO administrador.
create or replace function public.request_task_exceptional_deletion(p_task_id uuid, p_justification text)
returns public.approval_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tasks;
begin
  perform private.require_permission('tasks.delete_any');
  select * into v_t from public.tasks t
  where t.id = p_task_id and t.organization_id = private.current_org_id() and t.deleted_at is null;
  if not found then
    raise exception 'Demanda não encontrada.' using errcode = 'P0002';
  end if;
  return private.submit_approval_request('task.delete_exceptional', p_task_id, null,
    jsonb_build_object('title', v_t.title, 'status', v_t.status),
    jsonb_build_object('title', v_t.title, 'deleted', true), null, p_justification);
end;
$$;

create or replace function private.apply_task_delete(p_request public.approval_requests)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tasks
     set deleted_at = now(), deleted_by = auth.uid(), deletion_reason = p_request.justification
   where id = p_request.entity_id and organization_id = p_request.organization_id and deleted_at is null;
  if not found then
    raise exception 'A demanda já foi excluída.' using errcode = 'P0002';
  end if;
  return p_request.entity_id;
end;
$$;

-- Solicitações de exclusão de demandas (sobre a Central de Aprovações).
create view public.task_deletion_requests
with (security_invoker = true)
as
select r.id, r.organization_id, r.entity_id as task_id, r.operation_code,
       r.operation_code = 'task.delete_exceptional' as is_exceptional,
       r.status, r.justification, r.requested_by, r.requested_at, r.decided_by, r.decided_at, r.decision_comment
from public.approval_requests r
where r.operation_code in ('task.delete', 'task.delete_exceptional');
revoke all on public.task_deletion_requests from anon;
grant select on public.task_deletion_requests to authenticated;

-- Notificações de demandas disponíveis a partir desta fase.
update public.notification_types set is_available = true where module = 'tasks';

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.save_task(uuid, jsonb, text)',
    'public.set_task_status(uuid, public.task_status, text)',
    'public.add_task_comment(uuid, text)',
    'public.request_task_deletion(uuid, text)',
    'public.request_task_exceptional_deletion(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
-- Funções de autorização usadas pelas políticas precisam de EXECUTE para o papel autenticado.
grant execute on all functions in schema private to authenticated, service_role;
revoke all on function private.apply_task_delete(public.approval_requests) from public, anon, authenticated;
revoke all on function private.write_registration_package(uuid, jsonb, uuid) from public, anon, authenticated;
revoke all on function private.apply_registration_package(public.approval_requests) from public, anon, authenticated;
