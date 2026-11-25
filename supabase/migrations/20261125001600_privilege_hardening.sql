-- =============================================================================
-- SEMFAZ Gestão — Fase 7: endurecimento de privilégios (defesa em profundidade).
--
-- Achado dos testes de segurança da Fase 7: os privilégios padrão do Supabase
-- concediam INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER ao papel
-- `authenticated` em todas as tabelas e visões do schema public. A RLS protegia
-- as tabelas, mas a visão `user_directory` (atualizável e sem security_invoker,
-- pois lista colegas que a RLS de `profiles` esconde) permitia a um usuário
-- comum ALTERAR o perfil de colegas diretamente pela API.
--
-- Correção:
--   1. Visões: somente leitura para todos.
--   2. Tabelas: sem DELETE, TRUNCATE, REFERENCES e TRIGGER para usuários
--      (exclusão é sempre lógica, feita por funções do banco).
--   3. INSERT/UPDATE diretos apenas nas tabelas que a interface grava sem RPC
--      (listas e regras da Administração, departamentos, preferências de
--      notificação, rascunhos do cadastro guiado e categorias de demandas).
--      Todas continuam protegidas pela RLS e pelos gatilhos de auditoria.
--   4. Privilégios padrão: tabelas criadas no futuro nascem sem escrita para
--      anon/authenticated; cada migration concede o que precisar.
-- Funções SECURITY DEFINER rodam como dono e não são afetadas.
-- =============================================================================

do $$
declare
  r record;
begin
  -- 1. Visões somente leitura.
  for r in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v', 'm')
  loop
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from public, anon, authenticated', r.relname);
  end loop;

  -- 2 e 3. Tabelas: remove toda escrita; a seguir, devolve só o necessário.
  for r in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from public, anon, authenticated', r.relname);
  end loop;
end;
$$;

grant insert, update on public.departments to authenticated;
grant insert, update on public.notification_preferences to authenticated;
grant insert, update on public.registration_drafts to authenticated;
grant insert, update on public.task_categories to authenticated;
grant insert, update on public.contract_modalities to authenticated;
grant insert, update on public.adjustment_indexes to authenticated;
grant insert, update on public.suppliers to authenticated;
grant update on public.approval_rules to authenticated;
grant update on public.alert_rules to authenticated;

-- 4. Tabelas futuras sem escrita implícita para os papéis da API.
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
