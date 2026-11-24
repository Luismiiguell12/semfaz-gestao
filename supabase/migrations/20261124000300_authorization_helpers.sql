-- =============================================================================
-- SEMFAZ Gestão — Fase 1B
-- Funções auxiliares de autorização (STABLE, SECURITY DEFINER, search_path fixo).
-- São a base de todas as políticas RLS e das verificações nas funções RPC.
-- =============================================================================

-- Usuário autenticado, com perfil ativo e não excluído.
-- Usuário inativo ou bloqueado perde acesso imediatamente, mesmo com JWT válido.
create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.status = 'active'
      and p.deleted_at is null
  );
$$;

-- Organização do usuário atual (nula se inativo).
create or replace function private.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.organization_id from public.profiles p
  where p.id = (select auth.uid())
    and p.status = 'active'
    and p.deleted_at is null;
$$;

-- Nível de garantia da sessão (aal1 = senha; aal2 = senha + MFA).
create or replace function private.current_aal()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', 'aal1');
$$;

create or replace function private.user_has_verified_mfa(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.mfa_factors f
    where f.user_id = p_user_id and f.status = 'verified'
  );
$$;

-- O usuário possui o perfil de sistema "admin"?
create or replace function private.is_admin(p_user_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = coalesce(p_user_id, (select auth.uid()))
      and r.code = 'admin'
      and r.deleted_at is null
  );
$$;

-- MFA obrigatório para administradores; para os demais, exigido quando ativo.
create or replace function private.mfa_requirement_met()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.is_admin((select auth.uid())) or private.user_has_verified_mfa((select auth.uid()))
      then private.current_aal() = 'aal2'
    else true
  end;
$$;

-- Subárvore de um departamento (inclui o próprio).
create or replace function private.department_subtree(p_department_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with recursive tree as (
    select d.id from public.departments d where d.id = p_department_id
    union
    select c.id from public.departments c join tree t on c.parent_id = t.id
  )
  select id from tree;
$$;

-- O departamento está no escopo do usuário atual?
-- Escopo = acesso à organização inteira, ou departamento dentro da subárvore de
-- algum departamento concedido em user_department_access.
create or replace function private.department_in_scope(p_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user()
    and exists (
      select 1 from public.departments d
      where d.id = p_department_id and d.organization_id = private.current_org_id()
    )
    and (
      private.is_admin((select auth.uid()))
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.organization_wide_access
      )
      or exists (
        with recursive ancestors as (
          select d.id, d.parent_id from public.departments d where d.id = p_department_id
          union
          select d.id, d.parent_id from public.departments d join ancestors a on d.id = a.parent_id
        )
        select 1
        from public.user_department_access uda
        join ancestors a on a.id = uda.department_id
        where uda.user_id = (select auth.uid())
      )
    );
$$;

-- Verificação central: o usuário atual possui a permissão (e, se informado,
-- o departamento está no seu escopo)?
create or replace function private.has_permission(p_permission text, p_department_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user()
    and exists (
      select 1
      from public.permissions pm
      where pm.code = p_permission
        and (not pm.is_privileged or private.mfa_requirement_met())
        and (
          private.is_admin((select auth.uid()))
          or exists (
            select 1
            from public.user_roles ur
            join public.roles r on r.id = ur.role_id and r.deleted_at is null
            join public.role_permissions rp on rp.role_id = r.id
            where ur.user_id = (select auth.uid())
              and rp.permission_code = pm.code
          )
        )
    )
    and (p_department_id is null or private.department_in_scope(p_department_id));
$$;

-- Exige permissão em funções RPC (lança erro padronizado em português).
create or replace function private.require_permission(p_permission text, p_department_id uuid default null)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_active_user() then
    raise exception 'Acesso negado: usuário sem sessão ativa ou desativado.' using errcode = '42501';
  end if;
  if not private.has_permission(p_permission, p_department_id) then
    if exists (select 1 from public.permissions pm where pm.code = p_permission and pm.is_privileged)
       and not private.mfa_requirement_met() then
      raise exception 'Esta operação exige verificação em duas etapas (MFA).' using errcode = '42501',
        hint = 'mfa_required';
    end if;
    raise exception 'Acesso negado: você não possui a permissão necessária (%).', p_permission using errcode = '42501';
  end if;
end;
$$;

-- Registra a justificativa da operação corrente para a auditoria.
create or replace function private.set_justification(p_reason text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_reason is null or length(btrim(p_reason)) < 10 then
    raise exception 'Informe uma justificativa com pelo menos 10 caracteres.' using errcode = '22023';
  end if;
  if length(p_reason) > 1000 then
    raise exception 'A justificativa deve ter no máximo 1000 caracteres.' using errcode = '22023';
  end if;
  perform set_config('app.justification', btrim(p_reason), true);
end;
$$;

grant execute on all functions in schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Funções públicas (RPC) que expõem apenas informações do próprio usuário.
-- -----------------------------------------------------------------------------
create or replace function public.has_permission(permission text, department_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_permission(permission, department_id);
$$;
comment on function public.has_permission(text, uuid) is 'Indica se o usuário atual possui a permissão (apenas para a interface; a autorização real ocorre na RLS).';

create or replace function public.get_my_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_is_admin boolean;
  v_has_mfa boolean;
  v_result jsonb;
begin
  if v_uid is null then
    return null;
  end if;

  select * into v_profile from public.profiles p where p.id = v_uid;
  if not found then
    return jsonb_build_object('status', 'no_profile');
  end if;

  if v_profile.status <> 'active' or v_profile.deleted_at is not null then
    return jsonb_build_object('status', v_profile.status);
  end if;

  v_is_admin := private.is_admin(v_uid);
  v_has_mfa := private.user_has_verified_mfa(v_uid);

  select jsonb_build_object(
    'status', 'active',
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'full_name', v_profile.full_name,
      'email', v_profile.email,
      'username', v_profile.username,
      'job_title', v_profile.job_title,
      'department_id', v_profile.department_id,
      'organization_id', v_profile.organization_id,
      'organization_wide_access', v_profile.organization_wide_access
    ),
    'organization', (
      select jsonb_build_object('id', o.id, 'name', o.name, 'short_name', o.short_name)
      from public.organizations o where o.id = v_profile.organization_id
    ),
    'department', (
      select jsonb_build_object('id', d.id, 'name', d.name, 'acronym', d.acronym)
      from public.departments d where d.id = v_profile.department_id
    ),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'code', r.code, 'name', r.name) order by r.name)
      from public.user_roles ur join public.roles r on r.id = ur.role_id and r.deleted_at is null
      where ur.user_id = v_uid
    ), '[]'::jsonb),
    'is_admin', v_is_admin,
    'mfa', jsonb_build_object(
      'enrolled', v_has_mfa,
      'required', v_is_admin,
      'current_aal', private.current_aal(),
      'satisfied', private.mfa_requirement_met()
    ),
    -- Permissões efetivas nesta sessão (privilegiadas só aparecem com AAL2 quando exigido).
    'permissions', coalesce((
      select jsonb_agg(pm.code order by pm.code)
      from public.permissions pm
      where private.has_permission(pm.code)
    ), '[]'::jsonb),
    -- Permissões que o usuário possui, mas que dependem de concluir o MFA.
    'permissions_pending_mfa', coalesce((
      select jsonb_agg(pm.code order by pm.code)
      from public.permissions pm
      where pm.is_privileged
        and not private.mfa_requirement_met()
        and (v_is_admin or exists (
          select 1 from public.user_roles ur
          join public.roles r on r.id = ur.role_id and r.deleted_at is null
          join public.role_permissions rp on rp.role_id = r.id
          where ur.user_id = v_uid and rp.permission_code = pm.code
        ))
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;
comment on function public.get_my_access() is 'Contexto de acesso do usuário atual (perfil, papéis, permissões efetivas e situação do MFA).';

revoke execute on function public.has_permission(text, uuid) from public, anon;
revoke execute on function public.get_my_access() from public, anon;
grant execute on function public.has_permission(text, uuid) to authenticated;
grant execute on function public.get_my_access() to authenticated;
