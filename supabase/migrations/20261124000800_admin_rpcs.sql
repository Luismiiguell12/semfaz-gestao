-- =============================================================================
-- SEMFAZ Gestão — Fase 1C
-- Funções administrativas (RPC). Toda função valida permissão, escopo,
-- organização e regras de negócio no próprio banco.
-- =============================================================================

-- Impede escalonamento de privilégios: só é possível conceder/remover um papel
-- cujas permissões o próprio operador já possui. Somente administradores
-- concedem ou removem o perfil Administrador.
create or replace function private.assert_can_manage_role(p_role_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.roles;
  v_missing text;
begin
  select * into v_role from public.roles r
  where r.id = p_role_id and r.organization_id = private.current_org_id();
  if not found or v_role.deleted_at is not null then
    raise exception 'Perfil de acesso inválido.' using errcode = '22023';
  end if;
  if private.is_admin(auth.uid()) then
    return;
  end if;
  if v_role.code = 'admin' then
    raise exception 'Somente administradores podem conceder ou remover o perfil Administrador.' using errcode = '42501';
  end if;
  select rp.permission_code into v_missing
  from public.role_permissions rp
  where rp.role_id = p_role_id and not private.has_permission(rp.permission_code)
  limit 1;
  if v_missing is not null then
    raise exception 'Você não pode conceder um perfil com permissões que não possui (%).', v_missing using errcode = '42501';
  end if;
end;
$$;

create or replace function private.normalize_username(p_username text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(btrim(p_username));
$$;

-- -----------------------------------------------------------------------------
-- Usuários
-- -----------------------------------------------------------------------------

-- Verificação prévia ao convite (chamada pela Edge Function com o JWT do operador).
create or replace function public.admin_precheck_invite(p_email text, p_username text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_permission('users.manage');
  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido.' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles p where p.email = lower(btrim(p_email))) then
    raise exception 'Já existe um usuário com este e-mail.' using errcode = '23505';
  end if;
  if exists (select 1 from public.profiles p where p.username = private.normalize_username(p_username)) then
    raise exception 'Este nome de usuário já está em uso.' using errcode = '23505';
  end if;
end;
$$;

create or replace function private.replace_user_access(
  p_user_id uuid,
  p_role_ids uuid[],
  p_department_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_org_id();
  v_role uuid;
  v_dept uuid;
begin
  -- Papéis removidos
  for v_role in
    select ur.role_id from public.user_roles ur
    where ur.user_id = p_user_id and not (ur.role_id = any (coalesce(p_role_ids, '{}')))
  loop
    perform private.assert_can_manage_role(v_role);
    delete from public.user_roles where user_id = p_user_id and role_id = v_role;
  end loop;

  -- Papéis adicionados
  foreach v_role in array coalesce(p_role_ids, '{}') loop
    if not exists (select 1 from public.user_roles ur where ur.user_id = p_user_id and ur.role_id = v_role) then
      perform private.assert_can_manage_role(v_role);
      insert into public.user_roles (organization_id, user_id, role_id) values (v_org, p_user_id, v_role);
    end if;
  end loop;

  -- Escopos por departamento
  delete from public.user_department_access uda
  where uda.user_id = p_user_id and not (uda.department_id = any (coalesce(p_department_ids, '{}')));

  foreach v_dept in array coalesce(p_department_ids, '{}') loop
    if not exists (
      select 1 from public.departments d
      where d.id = v_dept and d.organization_id = v_org and d.deleted_at is null
    ) then
      raise exception 'Departamento inválido no escopo de acesso.' using errcode = '22023';
    end if;
    insert into public.user_department_access (organization_id, user_id, department_id)
    values (v_org, p_user_id, v_dept)
    on conflict (user_id, department_id) do nothing;
  end loop;
end;
$$;

-- Cria o perfil de um usuário recém-convidado (auth.users já criado pela Edge Function).
create or replace function public.admin_create_profile(
  p_user_id uuid,
  p_full_name text,
  p_username text,
  p_employee_number text,
  p_job_title text,
  p_department_id uuid,
  p_role_ids uuid[],
  p_department_ids uuid[],
  p_organization_wide_access boolean default false
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_profile public.profiles;
begin
  perform private.require_permission('users.manage');
  v_org := private.current_org_id();

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'Conta de autenticação não encontrada.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'Este usuário já possui cadastro.' using errcode = '23505';
  end if;
  if coalesce(array_length(p_role_ids, 1), 0) = 0 then
    raise exception 'Selecione pelo menos um perfil de acesso.' using errcode = '22023';
  end if;
  if p_organization_wide_access and not private.is_admin(auth.uid()) then
    raise exception 'Somente administradores concedem acesso a toda a organização.' using errcode = '42501';
  end if;

  perform set_config('app.justification', 'Cadastro de usuário por convite.', true);

  insert into public.profiles (
    id, organization_id, full_name, email, username, employee_number, job_title,
    department_id, status, organization_wide_access
  ) values (
    p_user_id, v_org, btrim(p_full_name), '', private.normalize_username(p_username),
    nullif(btrim(p_employee_number), ''), nullif(btrim(p_job_title), ''),
    p_department_id, 'active', coalesce(p_organization_wide_access, false)
  ) returning * into v_profile;

  perform private.replace_user_access(p_user_id, p_role_ids, p_department_ids);

  perform private.notify(
    p_user_id, 'welcome', 'Bem-vindo ao SEMFAZ Gestão',
    'Sua conta foi criada. Revise seus dados em Minha conta.', '/minha-conta/', 'profiles', p_user_id
  );

  return v_profile;
end;
$$;

create or replace function public.admin_update_profile(
  p_user_id uuid,
  p_full_name text,
  p_username text,
  p_employee_number text,
  p_job_title text,
  p_department_id uuid,
  p_reason text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  perform private.require_permission('users.manage');
  perform private.set_justification(p_reason);

  update public.profiles p
     set full_name = btrim(p_full_name),
         username = private.normalize_username(p_username),
         employee_number = nullif(btrim(p_employee_number), ''),
         job_title = nullif(btrim(p_job_title), ''),
         department_id = p_department_id
   where p.id = p_user_id and p.organization_id = private.current_org_id() and p.deleted_at is null
  returning * into v_profile;

  if not found then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;
  return v_profile;
end;
$$;

create or replace function public.admin_set_user_status(p_user_id uuid, p_status public.user_status, p_reason text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  perform private.require_permission('users.manage');
  perform private.set_justification(p_reason);

  if p_user_id = auth.uid() then
    raise exception 'Você não pode alterar a própria situação.' using errcode = '42501';
  end if;
  if private.is_admin(p_user_id) and not private.is_admin(auth.uid()) then
    raise exception 'Somente administradores alteram a situação de outro administrador.' using errcode = '42501';
  end if;

  update public.profiles p
     set status = p_status,
         status_reason = case when p_status = 'active' then null else btrim(p_reason) end
   where p.id = p_user_id and p.organization_id = private.current_org_id() and p.deleted_at is null
  returning * into v_profile;

  if not found then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;
  return v_profile;
end;
$$;

create or replace function public.admin_set_user_access(
  p_user_id uuid,
  p_role_ids uuid[],
  p_department_ids uuid[],
  p_organization_wide_access boolean,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_permission('users.manage');
  perform private.set_justification(p_reason);

  if p_user_id = auth.uid() then
    raise exception 'Você não pode alterar as próprias permissões ou escopos de acesso.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.organization_id = private.current_org_id() and p.deleted_at is null
  ) then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;
  if coalesce(array_length(p_role_ids, 1), 0) = 0 then
    raise exception 'Selecione pelo menos um perfil de acesso.' using errcode = '22023';
  end if;

  if (select p.organization_wide_access from public.profiles p where p.id = p_user_id)
       is distinct from coalesce(p_organization_wide_access, false) then
    if not private.is_admin(auth.uid()) then
      raise exception 'Somente administradores alteram o acesso a toda a organização.' using errcode = '42501';
    end if;
    update public.profiles set organization_wide_access = coalesce(p_organization_wide_access, false)
    where id = p_user_id;
  end if;

  perform private.replace_user_access(p_user_id, p_role_ids, p_department_ids);
end;
$$;

-- Listagem administrativa (inclui situação do MFA e do convite).
create or replace function public.admin_list_users()
returns table (
  id uuid,
  full_name text,
  email text,
  username text,
  employee_number text,
  job_title text,
  department_id uuid,
  department_name text,
  status public.user_status,
  status_reason text,
  organization_wide_access boolean,
  roles jsonb,
  department_access jsonb,
  mfa_enrolled boolean,
  invited_at timestamptz,
  confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_permission('users.manage');
  return query
  select
    p.id, p.full_name, p.email::text, p.username::text, p.employee_number, p.job_title,
    p.department_id, d.name, p.status, p.status_reason, p.organization_wide_access,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'code', r.code, 'name', r.name) order by r.name)
      from public.user_roles ur join public.roles r on r.id = ur.role_id
      where ur.user_id = p.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', dd.id, 'name', dd.name, 'kind', dd.kind) order by dd.name)
      from public.user_department_access uda join public.departments dd on dd.id = uda.department_id
      where uda.user_id = p.id
    ), '[]'::jsonb),
    private.user_has_verified_mfa(p.id),
    u.invited_at, coalesce(u.email_confirmed_at, u.confirmed_at), u.last_sign_in_at, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.departments d on d.id = p.department_id
  where p.organization_id = private.current_org_id() and p.deleted_at is null
  order by p.full_name;
end;
$$;

-- -----------------------------------------------------------------------------
-- Perfis de acesso (papéis) e permissões
-- -----------------------------------------------------------------------------
create or replace function public.admin_save_role(
  p_role_id uuid,
  p_code text,
  p_name text,
  p_description text,
  p_permission_codes text[],
  p_reason text
)
returns public.roles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_role public.roles;
  v_code text;
begin
  perform private.require_permission('roles.manage');
  perform private.set_justification(p_reason);
  v_org := private.current_org_id();

  if not private.is_admin(auth.uid()) then
    select c into v_code from unnest(coalesce(p_permission_codes, '{}')) c
    where not private.has_permission(c) limit 1;
    if v_code is not null then
      raise exception 'Você não pode atribuir a um perfil uma permissão que não possui (%).', v_code using errcode = '42501';
    end if;
  end if;

  if exists (
    select 1 from unnest(coalesce(p_permission_codes, '{}')) c
    where not exists (select 1 from public.permissions pm where pm.code = c)
  ) then
    raise exception 'Permissão inexistente informada.' using errcode = '22023';
  end if;

  if p_role_id is null then
    insert into public.roles (organization_id, code, name, description, is_system)
    values (v_org, lower(btrim(p_code)), btrim(p_name), nullif(btrim(p_description), ''), false)
    returning * into v_role;
  else
    if exists (select 1 from public.roles r where r.id = p_role_id and r.code = 'admin') then
      raise exception 'O perfil Administrador possui todas as permissões e não pode ser editado.' using errcode = '42501';
    end if;
    update public.roles r
       set name = btrim(p_name), description = nullif(btrim(p_description), '')
     where r.id = p_role_id and r.organization_id = v_org and r.deleted_at is null
    returning * into v_role;
    if not found then
      raise exception 'Perfil de acesso não encontrado.' using errcode = 'P0002';
    end if;
  end if;

  if v_role.code <> 'admin' then
    delete from public.role_permissions rp
    where rp.role_id = v_role.id and not (rp.permission_code = any (coalesce(p_permission_codes, '{}')));

    insert into public.role_permissions (role_id, permission_code, organization_id)
    select v_role.id, c, v_org from unnest(coalesce(p_permission_codes, '{}')) c
    on conflict (role_id, permission_code) do nothing;
  end if;

  return v_role;
end;
$$;

create or replace function public.admin_delete_role(p_role_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_permission('roles.manage');
  perform private.set_justification(p_reason);
  update public.roles r
     set deleted_at = now(), deleted_by = auth.uid(), deletion_reason = btrim(p_reason)
   where r.id = p_role_id and r.organization_id = private.current_org_id() and r.deleted_at is null;
  if not found then
    raise exception 'Perfil de acesso não encontrado.' using errcode = 'P0002';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Departamentos: exclusão lógica com justificativa
-- -----------------------------------------------------------------------------
create or replace function public.soft_delete_department(p_department_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_permission('departments.manage');
  perform private.set_justification(p_reason);

  if exists (select 1 from public.profiles p where p.department_id = p_department_id and p.deleted_at is null) then
    raise exception 'Há usuários lotados neste departamento. Altere a lotação antes de excluí-lo.' using errcode = '23514';
  end if;

  update public.departments d
     set deleted_at = now(), deleted_by = auth.uid(), deletion_reason = btrim(p_reason), is_active = false
   where d.id = p_department_id and d.organization_id = private.current_org_id() and d.deleted_at is null;
  if not found then
    raise exception 'Departamento não encontrado.' using errcode = 'P0002';
  end if;
  -- Escopos que apontam para o departamento excluído são mantidos como histórico;
  -- não concedem acesso a registros ativos.
end;
$$;

-- -----------------------------------------------------------------------------
-- Primeiro administrador: somente pelo script local (service_role).
-- -----------------------------------------------------------------------------
create or replace function public.bootstrap_first_admin(
  p_user_id uuid,
  p_organization_id uuid,
  p_full_name text,
  p_username text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_admin_role uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Operação restrita ao script administrativo.' using errcode = '42501';
  end if;
  if private.active_admin_count(p_organization_id) > 0 then
    raise exception 'Já existe um administrador ativo. Use a tela de usuários para novos cadastros.' using errcode = '42501';
  end if;

  select r.id into v_admin_role from public.roles r
  where r.organization_id = p_organization_id and r.code = 'admin';
  if v_admin_role is null then
    raise exception 'Perfil Administrador não encontrado. Execute o seed estrutural.' using errcode = 'P0002';
  end if;

  perform set_config('app.justification', 'Criação do primeiro administrador pelo script local.', true);

  insert into public.profiles (id, organization_id, full_name, email, username, status, organization_wide_access)
  values (p_user_id, p_organization_id, btrim(p_full_name), '', private.normalize_username(p_username), 'active', true)
  returning * into v_profile;

  insert into public.user_roles (organization_id, user_id, role_id)
  values (p_organization_id, p_user_id, v_admin_role);

  return v_profile;
end;
$$;

-- -----------------------------------------------------------------------------
-- Privilégios de execução
-- -----------------------------------------------------------------------------
revoke execute on function public.admin_precheck_invite(text, text) from public, anon;
revoke execute on function public.admin_create_profile(uuid, text, text, text, text, uuid, uuid[], uuid[], boolean) from public, anon;
revoke execute on function public.admin_update_profile(uuid, text, text, text, text, uuid, text) from public, anon;
revoke execute on function public.admin_set_user_status(uuid, public.user_status, text) from public, anon;
revoke execute on function public.admin_set_user_access(uuid, uuid[], uuid[], boolean, text) from public, anon;
revoke execute on function public.admin_list_users() from public, anon;
revoke execute on function public.admin_save_role(uuid, text, text, text, text[], text) from public, anon;
revoke execute on function public.admin_delete_role(uuid, text) from public, anon;
revoke execute on function public.soft_delete_department(uuid, text) from public, anon;
revoke execute on function public.bootstrap_first_admin(uuid, uuid, text, text) from public, anon, authenticated;

grant execute on function public.admin_precheck_invite(text, text) to authenticated;
grant execute on function public.admin_create_profile(uuid, text, text, text, text, uuid, uuid[], uuid[], boolean) to authenticated;
grant execute on function public.admin_update_profile(uuid, text, text, text, text, uuid, text) to authenticated;
grant execute on function public.admin_set_user_status(uuid, public.user_status, text) to authenticated;
grant execute on function public.admin_set_user_access(uuid, uuid[], uuid[], boolean, text) to authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_save_role(uuid, text, text, text, text[], text) to authenticated;
grant execute on function public.admin_delete_role(uuid, text) to authenticated;
grant execute on function public.soft_delete_department(uuid, text) to authenticated;
grant execute on function public.bootstrap_first_admin(uuid, uuid, text, text) to service_role;

-- Funções expostas e não listadas acima continuam sem acesso para anon.
revoke execute on all functions in schema public from anon;
