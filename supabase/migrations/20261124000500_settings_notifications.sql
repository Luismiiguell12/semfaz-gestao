-- =============================================================================
-- SEMFAZ Gestão — Fase 1B
-- Configurações do sistema e infraestrutura de notificações.
-- =============================================================================

create table public.system_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  key text not null check (key ~ '^[a-z_]+(\.[a-z_]+)+$'),
  value jsonb not null,
  description text not null check (length(btrim(description)) between 5 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  constraint system_settings_key_per_org unique (organization_id, key)
);
create trigger system_settings_actor before insert or update on public.system_settings
  for each row execute function private.tg_set_actor_columns();
create trigger system_settings_audit after insert or update or delete on public.system_settings
  for each row execute function private.tg_audit('settings');
create trigger system_settings_no_delete before delete on public.system_settings
  for each row execute function private.tg_prevent_physical_delete();

-- Leitura tipada de configurações (com valor padrão).
create or replace function private.setting(p_organization_id uuid, p_key text, p_default jsonb default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.value from public.system_settings s where s.organization_id = p_organization_id and s.key = p_key),
    p_default
  );
$$;

-- -----------------------------------------------------------------------------
-- Notificações internas
-- -----------------------------------------------------------------------------
create table public.notification_types (
  code text primary key check (code ~ '^[a-z_]{3,60}$'),
  module text not null check (module ~ '^[a-z_]+$'),
  description text not null,
  default_in_app boolean not null default true,
  default_email boolean not null default false,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.notification_types is 'Catálogo de tipos de notificação. Tipos de fases futuras ficam com is_available = false.';

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null,
  type_code text not null references public.notification_types (code),
  title text not null check (length(btrim(title)) between 3 and 200),
  body text check (body is null or length(body) <= 2000),
  -- Somente caminhos internos da aplicação (evita links externos maliciosos).
  link_path text check (link_path is null or link_path ~ '^/[A-Za-z0-9/_?=&.%-]{0,255}$'),
  entity_type text check (entity_type is null or entity_type ~ '^[a-z_]{3,60}$'),
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_user_fk foreign key (user_id, organization_id)
    references public.profiles (id, organization_id)
);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null,
  type_code text not null references public.notification_types (code),
  in_app boolean not null default true,
  email boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  constraint notification_preferences_unique unique (user_id, type_code),
  constraint notification_preferences_user_fk foreign key (user_id, organization_id)
    references public.profiles (id, organization_id)
);
create trigger notification_preferences_actor before insert or update on public.notification_preferences
  for each row execute function private.tg_set_actor_columns();

-- Fila de e-mails: preparada para integração futura. Nesta versão nenhum e-mail é enviado.
create table public.notification_email_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  notification_id uuid not null references public.notifications (id),
  user_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint notification_email_queue_unique unique (notification_id),
  constraint notification_email_queue_user_fk foreign key (user_id, organization_id)
    references public.profiles (id, organization_id)
);
comment on table public.notification_email_queue is 'Fila para envio futuro de e-mails. O destinatário é resolvido no envio (sem duplicar dados pessoais).';

-- Cria notificação respeitando as preferências do usuário. Uso exclusivo do backend.
create or replace function private.notify(
  p_user_id uuid,
  p_type_code text,
  p_title text,
  p_body text default null,
  p_link_path text default null,
  p_entity_type text default null,
  p_entity_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_in_app boolean;
  v_email boolean;
  v_id uuid;
begin
  select p.organization_id into v_org
  from public.profiles p
  where p.id = p_user_id and p.deleted_at is null;
  if v_org is null then
    return null;
  end if;

  select coalesce(np.in_app, nt.default_in_app), coalesce(np.email, nt.default_email)
    into v_in_app, v_email
  from public.notification_types nt
  left join public.notification_preferences np on np.type_code = nt.code and np.user_id = p_user_id
  where nt.code = p_type_code;

  if not found then
    raise exception 'Tipo de notificação desconhecido: %', p_type_code using errcode = '22023';
  end if;
  if not v_in_app and not v_email then
    return null;
  end if;

  insert into public.notifications (organization_id, user_id, type_code, title, body, link_path, entity_type, entity_id, read_at)
  values (v_org, p_user_id, p_type_code, p_title, p_body, p_link_path, p_entity_type, p_entity_id,
          case when v_in_app then null else now() end)
  returning id into v_id;

  if v_email then
    insert into public.notification_email_queue (organization_id, notification_id, user_id)
    values (v_org, v_id, p_user_id);
  end if;

  return v_id;
end;
$$;

-- RPCs de leitura/marcação (cada usuário só altera as próprias notificações).
create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_active_user() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  update public.notifications n
     set read_at = coalesce(n.read_at, now())
   where n.id = p_notification_id and n.user_id = auth.uid();
  if not found then
    raise exception 'Notificação não encontrada.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not private.is_active_user() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  update public.notifications n set read_at = now()
   where n.user_id = auth.uid() and n.read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.mark_notification_read(uuid) from public, anon;
revoke execute on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- Notifica o usuário quando seus perfis de acesso mudam (evento real da Fase 1).
create or replace function private.tg_notify_access_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := coalesce(new.user_id, old.user_id);
  v_role_name text;
begin
  select r.name into v_role_name from public.roles r where r.id = coalesce(new.role_id, old.role_id);
  perform private.notify(
    v_user,
    'access_changed',
    case when tg_op = 'INSERT' then 'Perfil de acesso concedido' else 'Perfil de acesso removido' end,
    case when tg_op = 'INSERT'
      then format('Você recebeu o perfil "%s".', v_role_name)
      else format('O perfil "%s" foi removido da sua conta.', v_role_name) end,
    '/minha-conta/',
    'user_roles',
    coalesce(new.id, old.id)
  );
  return null;
end;
$$;

create trigger user_roles_notify after insert or delete on public.user_roles
  for each row execute function private.tg_notify_access_change();
