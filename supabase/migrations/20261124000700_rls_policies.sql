-- =============================================================================
-- SEMFAZ Gestão — Fase 1B
-- Row Level Security em TODAS as tabelas do schema public.
-- Regra geral: tabela sem política = sem acesso. Escritas sensíveis ocorrem
-- somente por funções RPC que validam permissão, escopo e regras de negócio.
-- =============================================================================

alter table public.organizations enable row level security;
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_department_access enable row level security;
alter table public.audit_logs enable row level security;
alter table public.system_settings enable row level security;
alter table public.notification_types enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_email_queue enable row level security;
alter table public.documents enable row level security;

-- Defesa em profundidade: o papel anônimo não acessa nenhuma tabela.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Organizações: o usuário vê apenas a própria.
create policy organizations_select on public.organizations
  for select to authenticated
  using (id = private.current_org_id());

-- Departamentos: todos os usuários ativos da organização consultam a estrutura.
create policy departments_select on public.departments
  for select to authenticated
  using (organization_id = private.current_org_id());

create policy departments_insert on public.departments
  for insert to authenticated
  with check (
    organization_id = private.current_org_id()
    and private.has_permission('departments.manage')
    and deleted_at is null
  );

create policy departments_update on public.departments
  for update to authenticated
  using (
    organization_id = private.current_org_id()
    and deleted_at is null
    and private.has_permission('departments.manage')
  )
  with check (
    organization_id = private.current_org_id()
    and private.has_permission('departments.manage')
    -- Exclusão lógica somente pela função soft_delete_department (com justificativa).
    and deleted_at is null
  );

-- Perfis: o próprio usuário ou quem gerencia usuários.
-- A listagem de colegas (para atribuições) usa a view user_directory.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    organization_id = private.current_org_id()
    and (id = (select auth.uid()) or private.has_permission('users.manage'))
  );
-- Sem políticas de escrita: alterações somente pelas RPCs administrativas.

-- Catálogo de permissões: leitura para usuários ativos.
create policy permissions_select on public.permissions
  for select to authenticated
  using (private.is_active_user());

-- Papéis: leitura para usuários ativos da organização.
create policy roles_select on public.roles
  for select to authenticated
  using (organization_id = private.current_org_id());

-- Permissões dos papéis: quem gerencia papéis, ou dos papéis do próprio usuário.
create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using (
    organization_id = private.current_org_id()
    and (
      private.has_permission('roles.manage')
      or exists (select 1 from public.user_roles ur where ur.role_id = role_permissions.role_id and ur.user_id = (select auth.uid()))
    )
  );

create policy user_roles_select on public.user_roles
  for select to authenticated
  using (
    organization_id = private.current_org_id()
    and (user_id = (select auth.uid()) or private.has_permission('users.manage'))
  );

create policy user_department_access_select on public.user_department_access
  for select to authenticated
  using (
    organization_id = private.current_org_id()
    and (user_id = (select auth.uid()) or private.has_permission('users.manage'))
  );

-- Auditoria: somente leitura e somente com audit.view.
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (organization_id = private.current_org_id() and private.has_permission('audit.view'));

-- Configurações: leitura para usuários ativos da organização.
create policy system_settings_select on public.system_settings
  for select to authenticated
  using (organization_id = private.current_org_id());

create policy notification_types_select on public.notification_types
  for select to authenticated
  using (private.is_active_user());

-- Notificações: cada usuário lê somente as próprias. Escrita apenas por RPC.
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()) and private.is_active_user());

create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated
  using (user_id = (select auth.uid()) and private.is_active_user());
create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()) and organization_id = private.current_org_id());
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()) and private.is_active_user())
  with check (user_id = (select auth.uid()) and organization_id = private.current_org_id());

-- notification_email_queue: sem políticas (somente backend).

-- Documentos: visíveis quando o registro associado é acessível.
create policy documents_select on public.documents
  for select to authenticated
  using (
    organization_id = private.current_org_id()
    and deleted_at is null
    and private.can_access_document_entity(entity_type, entity_id, 'view')
  );

-- -----------------------------------------------------------------------------
-- Diretório de usuários (dados mínimos para seleção de responsáveis).
-- Executa com os privilégios do dono, mas filtra explicitamente pela
-- organização do usuário ativo. Não expõe e-mail nem matrícula.
-- -----------------------------------------------------------------------------
create view public.user_directory
with (security_barrier = true)
as
select p.id, p.organization_id, p.full_name, p.username, p.job_title, p.department_id, p.status
from public.profiles p
where p.organization_id = private.current_org_id()
  and p.deleted_at is null;
revoke all on public.user_directory from anon, public;
grant select on public.user_directory to authenticated;
comment on view public.user_directory is 'Diretório mínimo de colegas da mesma organização (sem e-mail nem matrícula).';

-- -----------------------------------------------------------------------------
-- Regras de proteção (valem para qualquer caminho de escrita)
-- -----------------------------------------------------------------------------

-- Ninguém altera o próprio acesso (papéis, escopo, situação).
create or replace function private.tg_prevent_self_access_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid := coalesce(new.user_id, old.user_id);
begin
  if auth.uid() is not null and v_target = auth.uid() then
    raise exception 'Você não pode alterar as próprias permissões ou escopos de acesso.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger user_roles_no_self_change before insert or update or delete on public.user_roles
  for each row execute function private.tg_prevent_self_access_change();
create trigger user_department_access_no_self_change before insert or update or delete on public.user_department_access
  for each row execute function private.tg_prevent_self_access_change();

create or replace function private.tg_profiles_protect_access_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and new.id = auth.uid()
     and (new.status, new.organization_wide_access, new.organization_id, new.deleted_at)
         is distinct from (old.status, old.organization_wide_access, old.organization_id, old.deleted_at) then
    raise exception 'Você não pode alterar a própria situação ou escopo de acesso.' using errcode = '42501';
  end if;
  if new.organization_id is distinct from old.organization_id then
    raise exception 'A organização de um usuário não pode ser alterada.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger profiles_protect_access_fields before update on public.profiles
  for each row execute function private.tg_profiles_protect_access_fields();

-- Permissões de um papel que o próprio usuário possui não podem ser alteradas por ele.
-- O papel "admin" possui todas as permissões implicitamente e não é editável.
create or replace function private.tg_role_permissions_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role uuid := coalesce(new.role_id, old.role_id);
begin
  if exists (select 1 from public.roles r where r.id = v_role and r.code = 'admin') then
    raise exception 'O perfil Administrador possui todas as permissões e não pode ser editado.' using errcode = '42501';
  end if;
  if auth.uid() is not null and exists (
    select 1 from public.user_roles ur where ur.role_id = v_role and ur.user_id = auth.uid()
  ) then
    raise exception 'Você não pode alterar as permissões de um perfil que você possui.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger role_permissions_guard before insert or update or delete on public.role_permissions
  for each row execute function private.tg_role_permissions_guard();

create or replace function private.tg_roles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_system and (new.code is distinct from old.code or new.deleted_at is not null or new.is_system is distinct from old.is_system) then
    raise exception 'Perfis do sistema não podem ser renomeados (código) nem excluídos.' using errcode = '42501';
  end if;
  if new.deleted_at is not null and old.deleted_at is null
     and exists (select 1 from public.user_roles ur where ur.role_id = old.id) then
    raise exception 'Remova o perfil de todos os usuários antes de excluí-lo.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger roles_guard before update on public.roles
  for each row execute function private.tg_roles_guard();

-- Deve existir sempre pelo menos um administrador ativo.
create or replace function private.active_admin_count(p_organization_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct p.id)::integer
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  join public.roles r on r.id = ur.role_id and r.code = 'admin' and r.deleted_at is null
  where p.organization_id = p_organization_id
    and p.status = 'active'
    and p.deleted_at is null;
$$;

create or replace function private.tg_keep_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := coalesce((to_jsonb(new) ->> 'organization_id')::uuid, (to_jsonb(old) ->> 'organization_id')::uuid);
  v_had_admin boolean;
begin
  if tg_table_name = 'user_roles' then
    v_had_admin := exists (select 1 from public.roles r where r.id = old.role_id and r.code = 'admin');
  else
    v_had_admin := old.status = 'active' and old.deleted_at is null and private.is_admin(old.id);
  end if;

  if v_had_admin and private.active_admin_count(v_org) < 1 then
    raise exception 'Não é possível remover ou desativar o último administrador ativo.' using errcode = '42501';
  end if;
  return null;
end;
$$;

create constraint trigger user_roles_keep_last_admin
  after delete on public.user_roles
  deferrable initially immediate
  for each row execute function private.tg_keep_last_admin();
create constraint trigger profiles_keep_last_admin
  after update of status, deleted_at on public.profiles
  deferrable initially immediate
  for each row execute function private.tg_keep_last_admin();
