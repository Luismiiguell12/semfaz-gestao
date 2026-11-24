-- =============================================================================
-- SEMFAZ Gestão — Fase 1B
-- Organização, departamentos, perfis de usuário, papéis, permissões e escopos.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Organizações (Prefeitura). Raiz do isolamento multi-organização.
-- -----------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 3 and 200),
  short_name text not null check (length(btrim(short_name)) between 2 and 60),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id)
);
comment on table public.organizations is 'Organizações (prefeituras). Toda tabela de negócio referencia organization_id.';

-- -----------------------------------------------------------------------------
-- Departamentos: Secretaria → Diretoria → Unidade
-- -----------------------------------------------------------------------------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  parent_id uuid,
  kind public.department_kind not null,
  name text not null check (length(btrim(name)) between 2 and 200),
  acronym text check (acronym ~ '^[A-Z0-9][A-Z0-9/-]{1,19}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id),
  deletion_reason text check (deletion_reason is null or length(btrim(deletion_reason)) >= 10),
  constraint departments_id_org_key unique (id, organization_id),
  -- O pai pertence obrigatoriamente à mesma organização.
  constraint departments_parent_fk foreign key (parent_id, organization_id)
    references public.departments (id, organization_id),
  constraint departments_secretariat_root check ((kind = 'secretariat') = (parent_id is null)),
  constraint departments_not_self_parent check (parent_id is null or parent_id <> id),
  constraint departments_deletion_consistency check (
    (deleted_at is null and deleted_by is null and deletion_reason is null)
    or (deleted_at is not null and deletion_reason is not null)
  )
);
create unique index departments_unique_name_per_parent
  on public.departments (organization_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  where deleted_at is null;
create unique index departments_unique_acronym
  on public.departments (organization_id, acronym)
  where acronym is not null and deleted_at is null;
create index departments_parent_idx on public.departments (parent_id);
comment on table public.departments is 'Estrutura organizacional hierárquica: secretaria, diretoria e unidade.';

-- Valida a hierarquia: diretoria abaixo de secretaria; unidade abaixo de
-- secretaria ou diretoria. Como o nível é estritamente decrescente, não há ciclos.
create or replace function private.tg_validate_department_hierarchy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_kind public.department_kind;
  v_parent_deleted timestamptz;
begin
  if new.parent_id is not null then
    select d.kind, d.deleted_at into v_parent_kind, v_parent_deleted
    from public.departments d where d.id = new.parent_id;

    if v_parent_deleted is not null then
      raise exception 'O departamento superior está excluído.' using errcode = '23514';
    end if;
    if new.kind = 'directorate' and v_parent_kind <> 'secretariat' then
      raise exception 'Uma diretoria deve estar vinculada a uma secretaria.' using errcode = '23514';
    end if;
    if new.kind = 'unit' and v_parent_kind not in ('secretariat', 'directorate') then
      raise exception 'Uma unidade deve estar vinculada a uma secretaria ou diretoria.' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.kind is distinct from old.kind then
    if exists (
      select 1 from public.departments c
      where c.parent_id = new.id and c.deleted_at is null
        and not (
          (c.kind = 'directorate' and new.kind = 'secretariat')
          or (c.kind = 'unit' and new.kind in ('secretariat', 'directorate'))
        )
    ) then
      raise exception 'O novo nível é incompatível com os departamentos subordinados.' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.deleted_at is not null and old.deleted_at is null then
    if exists (select 1 from public.departments c where c.parent_id = new.id and c.deleted_at is null) then
      raise exception 'Exclua ou mova antes os departamentos subordinados.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger departments_validate_hierarchy
  before insert or update on public.departments
  for each row execute function private.tg_validate_department_hierarchy();

-- -----------------------------------------------------------------------------
-- Perfis de usuário (1:1 com auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  organization_id uuid not null references public.organizations (id),
  full_name text not null check (length(btrim(full_name)) between 3 and 150),
  email extensions.citext not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  username extensions.citext not null check (username ~ '^[a-z0-9][a-z0-9._-]{2,39}$'),
  employee_number text check (employee_number ~ '^[0-9A-Za-z./-]{1,30}$'),
  job_title text check (job_title is null or length(btrim(job_title)) between 2 and 120),
  department_id uuid,
  status public.user_status not null default 'active',
  status_reason text check (status_reason is null or length(btrim(status_reason)) between 10 and 500),
  -- Escopo "todos os imóveis/departamentos da organização".
  organization_wide_access boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id),
  deletion_reason text,
  constraint profiles_id_org_key unique (id, organization_id),
  constraint profiles_department_fk foreign key (department_id, organization_id)
    references public.departments (id, organization_id)
);
create unique index profiles_email_per_org on public.profiles (organization_id, email);
create unique index profiles_username_key on public.profiles (username);
create unique index profiles_employee_number_per_org
  on public.profiles (organization_id, employee_number) where employee_number is not null;
create index profiles_department_idx on public.profiles (department_id);
comment on table public.profiles is 'Dados funcionais do usuário. Login pelo e-mail institucional (auth.users).';
comment on column public.profiles.employee_number is 'Matrícula funcional (opcional). Dado pessoal: visível apenas ao próprio usuário e a quem possui users.manage.';

-- O e-mail do perfil deve ser o mesmo do Supabase Auth.
create or replace function private.tg_profiles_sync_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_email text;
begin
  select u.email into v_auth_email from auth.users u where u.id = new.id;
  if v_auth_email is null then
    raise exception 'Usuário de autenticação inexistente.' using errcode = '23503';
  end if;
  new.email := lower(v_auth_email);
  new.username := lower(new.username);
  return new;
end;
$$;

create trigger profiles_sync_email
  before insert or update of email, id on public.profiles
  for each row execute function private.tg_profiles_sync_email();

-- -----------------------------------------------------------------------------
-- Catálogo de permissões (global, mantido por migrations)
-- -----------------------------------------------------------------------------
create table public.permissions (
  code text primary key check (code ~ '^[a-z_]+(\.[a-z_]+)+$'),
  module text not null check (module ~ '^[a-z_]+$'),
  description text not null check (length(btrim(description)) between 5 and 300),
  -- Permissões privilegiadas exigem sessão AAL2 (MFA) para administradores e
  -- para qualquer usuário que tenha MFA ativo.
  is_privileged boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.permissions is 'Catálogo global de permissões (módulo.ação). Mantido exclusivamente por migrations.';

-- -----------------------------------------------------------------------------
-- Papéis (perfis de acesso) configuráveis por organização
-- -----------------------------------------------------------------------------
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  code extensions.citext not null check (code ~ '^[a-z][a-z0-9_]{2,40}$'),
  name text not null check (length(btrim(name)) between 3 and 80),
  description text check (description is null or length(description) <= 500),
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id),
  deletion_reason text,
  constraint roles_id_org_key unique (id, organization_id),
  constraint roles_code_per_org unique (organization_id, code)
);
create unique index roles_name_per_org on public.roles (organization_id, lower(name)) where deleted_at is null;
comment on table public.roles is 'Perfis de acesso (Administrador, Gestor, Colaborador, Consulta e outros). O perfil "admin" possui implicitamente todas as permissões.';

create table public.role_permissions (
  role_id uuid not null,
  permission_code text not null references public.permissions (code),
  organization_id uuid not null references public.organizations (id),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  primary key (role_id, permission_code),
  constraint role_permissions_role_fk foreign key (role_id, organization_id)
    references public.roles (id, organization_id)
);
create index role_permissions_permission_idx on public.role_permissions (permission_code);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null,
  role_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  constraint user_roles_unique unique (user_id, role_id),
  constraint user_roles_user_fk foreign key (user_id, organization_id)
    references public.profiles (id, organization_id),
  constraint user_roles_role_fk foreign key (role_id, organization_id)
    references public.roles (id, organization_id)
);
create index user_roles_role_idx on public.user_roles (role_id);

-- Escopo por departamento: concede acesso ao departamento e a toda a sua subárvore.
create table public.user_department_access (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null,
  department_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  constraint user_department_access_unique unique (user_id, department_id),
  constraint user_department_access_user_fk foreign key (user_id, organization_id)
    references public.profiles (id, organization_id),
  constraint user_department_access_department_fk foreign key (department_id, organization_id)
    references public.departments (id, organization_id)
);
create index user_department_access_department_idx on public.user_department_access (department_id);
comment on table public.user_department_access is 'Escopo organizacional do usuário. user_property_access (imóveis selecionados) será criada na Fase 2, junto com properties.';

-- -----------------------------------------------------------------------------
-- Triggers de colunas de autoria
-- -----------------------------------------------------------------------------
create trigger organizations_actor before insert or update on public.organizations
  for each row execute function private.tg_set_actor_columns();
create trigger departments_actor before insert or update on public.departments
  for each row execute function private.tg_set_actor_columns();
create trigger profiles_actor before insert or update on public.profiles
  for each row execute function private.tg_set_actor_columns();
create trigger roles_actor before insert or update on public.roles
  for each row execute function private.tg_set_actor_columns();
create trigger role_permissions_creator before insert on public.role_permissions
  for each row execute function private.tg_set_creator_columns();
create trigger user_roles_creator before insert on public.user_roles
  for each row execute function private.tg_set_creator_columns();
create trigger user_department_access_creator before insert on public.user_department_access
  for each row execute function private.tg_set_creator_columns();

-- Registros de negócio: sem exclusão física.
create trigger organizations_no_delete before delete on public.organizations
  for each row execute function private.tg_prevent_physical_delete();
create trigger departments_no_delete before delete on public.departments
  for each row execute function private.tg_prevent_physical_delete();
create trigger profiles_no_delete before delete on public.profiles
  for each row execute function private.tg_prevent_physical_delete();
create trigger roles_no_delete before delete on public.roles
  for each row execute function private.tg_prevent_physical_delete();
