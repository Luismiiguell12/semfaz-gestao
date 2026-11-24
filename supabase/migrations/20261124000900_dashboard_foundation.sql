-- =============================================================================
-- SEMFAZ Gestão — Fase 1D
-- Indicadores do painel disponíveis na fundação. Cada indicador só é
-- devolvido a quem tem permissão para vê-lo (os demais vêm como nulos).
-- Os indicadores dos módulos de negócio serão acrescentados em cada fase.
-- =============================================================================
create or replace function public.dashboard_foundation_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_org_id();
  v_can_users boolean;
begin
  if v_org is null then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  v_can_users := private.has_permission('users.manage');

  return jsonb_build_object(
    'unread_notifications', (
      select count(*) from public.notifications n where n.user_id = auth.uid() and n.read_at is null
    ),
    'departments', (
      select jsonb_build_object(
        'secretariats', count(*) filter (where d.kind = 'secretariat'),
        'directorates', count(*) filter (where d.kind = 'directorate'),
        'units', count(*) filter (where d.kind = 'unit')
      )
      from public.departments d
      where d.organization_id = v_org and d.deleted_at is null and d.is_active
    ),
    'users', case when v_can_users then (
      select jsonb_build_object(
        'active', count(*) filter (where p.status = 'active'),
        'inactive', count(*) filter (where p.status = 'inactive'),
        'blocked', count(*) filter (where p.status = 'blocked'),
        'active_admins', private.active_admin_count(v_org),
        'admins_without_mfa', (
          select count(distinct ur.user_id)
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id and r.code = 'admin'
          join public.profiles pp on pp.id = ur.user_id and pp.status = 'active'
          where ur.organization_id = v_org and not private.user_has_verified_mfa(ur.user_id)
        )
      )
      from public.profiles p
      where p.organization_id = v_org and p.deleted_at is null
    ) end
  );
end;
$$;
revoke execute on function public.dashboard_foundation_stats() from public, anon;
grant execute on function public.dashboard_foundation_stats() to authenticated;
