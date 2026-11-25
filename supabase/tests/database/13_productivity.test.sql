-- Fase 5: métricas de produtividade (sem pontos), visibilidade e consolidação.
begin;
\ir _helpers.psql
select plan(26);

select tests.create_user('pr_colab', array['collaborator']) as colab \gset
select tests.create_user('pr_colab2', array['collaborator']) as colab2 \gset
select tests.create_user('pr_gestor', array['manager']) as gestor \gset
select tests.create_user('pr_fora', array['manager']) as fora \gset
select tests.create_user('pr_consulta', array['viewer']) as consulta \gset
select tests.create_user('pr_sem', array[]::text[]) as sem \gset
insert into public.departments (id, organization_id, kind, name) values
  ('94000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', 'secretariat', 'Secretaria Fora Produtividade');
update public.profiles set department_id = '00000000-0000-4000-8000-000000000101' where id in (:'colab', :'colab2', :'consulta');
insert into public.user_department_access (organization_id, user_id, department_id) values
  ('00000000-0000-4000-8000-000000000001', :'gestor', '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000000001', :'fora', '94000000-0000-4000-8000-000000000009');
select id as cat from public.task_categories where name = 'Financeiro' \gset
-- Mês anterior (período fechado) como base dos dados.
select (date_trunc('month', private.today_local()) - interval '1 month')::date as p \gset

-- Demandas com datas no passado (gatilhos desligados só para montar o cenário).
set local session_replication_role = replica;
create function tests.ts(d date, h text default '10:00') returns timestamptz language sql as $$ select (d + h::time) at time zone 'America/Maceio' $$;
insert into public.tasks (id, organization_id, department_id, title, responsible_id, category_id, due_date, complexity, status, created_at, completed_at, cancelled_at, created_by) values
  ('94000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'T1 no prazo', :'colab', :'cat', :'p'::date + 9, 'complex', 'done', tests.ts(:'p'::date), tests.ts(:'p'::date + 4), null, :'gestor'),
  ('94000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'T2 atrasada concluída', :'gestor', :'cat', :'p'::date + 2, 'simple', 'done', tests.ts(:'p'::date + 1), tests.ts(:'p'::date + 7), null, :'gestor'),
  ('94000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'T3 aberta vencida', :'colab', :'cat', :'p'::date + 3, 'medium', 'in_progress', tests.ts(:'p'::date + 2), null, null, :'gestor'),
  ('94000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'T4 aberta sem prazo', :'colab', :'cat', null, 'medium', 'todo', tests.ts(:'p'::date + 19), null, null, :'gestor'),
  ('94000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'T5 de dois meses atrás', :'colab', :'cat', null, 'medium', 'done', tests.ts(:'p'::date - 40), tests.ts(:'p'::date - 20), null, :'gestor'),
  ('94000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'T6 cancelada', :'colab', :'cat', null, 'medium', 'cancelled', tests.ts(:'p'::date), null, tests.ts(:'p'::date + 1), :'gestor');
insert into public.task_assignees (organization_id, task_id, user_id, role, created_at) values
  ('00000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000001', :'colab', 'responsible', tests.ts(:'p'::date)),
  ('00000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000002', :'gestor', 'responsible', tests.ts(:'p'::date + 1)),
  ('00000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000002', :'colab', 'participant', tests.ts(:'p'::date + 1)),
  ('00000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000003', :'colab', 'responsible', tests.ts(:'p'::date + 2)),
  ('00000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000004', :'colab', 'responsible', tests.ts(:'p'::date + 19)),
  ('00000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000004', :'colab2', 'participant', tests.ts(:'p'::date + 19)),
  ('00000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000005', :'colab', 'responsible', tests.ts(:'p'::date - 40)),
  ('00000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000006', :'colab', 'responsible', tests.ts(:'p'::date));
set local session_replication_role = origin;

select is((select count(*)::int from public.task_complexity_levels), 4, 'Quatro níveis de complexidade, sem pesos');
select is((select period_end from private.period_bounds('quarter', '2026-05-17')), '2026-06-30'::date, 'Trimestre');
select is((select period_start from private.period_bounds('semester', '2026-11-25')), '2026-07-01'::date, 'Semestre');

-- ------------------------------------------------------------ Individual
set local role authenticated;
select tests.set_claims(:'colab');
select public.productivity_report('month', :'p') as rep \gset
select is(jsonb_array_length(:'rep'::jsonb->'people'), 1, 'Sem permissão de equipe: somente os próprios indicadores');
select is((:'rep'::jsonb->>'can_view_team')::boolean, false, 'Colaborador não vê a equipe');
select is((:'rep'::jsonb->'people'->0->'metrics'->>'recebidas')::int, 5, 'Recebidas no período (inclui a cancelada)');
select is((:'rep'::jsonb->'people'->0->'metrics'->>'concluidas')::int, 2, 'Concluídas no período');
select is((:'rep'::jsonb->'people'->0->'metrics'->>'no_prazo')::int, 1, 'Concluídas no prazo');
select is((:'rep'::jsonb->'people'->0->'metrics'->>'pendentes')::int, 2, 'Pendentes ao fim do período');
select is((:'rep'::jsonb->'people'->0->'metrics'->>'atrasadas')::int, 1, 'Atrasadas ao fim do período');
select is((:'rep'::jsonb->'people'->0->'metrics'->>'percentual_conclusao')::numeric, 50.0, 'Percentual de conclusão');
select is((:'rep'::jsonb->'people'->0->'metrics'->>'cumprimento_prazos')::numeric, 50.0, 'Cumprimento de prazos');
select is((:'rep'::jsonb->'people'->0->'metrics'->>'tempo_medio_dias')::numeric, 5.0, 'Tempo médio de execução (dias)');
select is(:'rep'::jsonb->'people'->0->'metrics'->'por_complexidade',
  '{"simple":1,"medium":0,"complex":1,"very_complex":0}'::jsonb, 'Distribuição por complexidade (contagem, sem pontos)');
select is((:'rep'::jsonb->'people'->0->'metrics'->>'como_responsavel')::int || '/' || (:'rep'::jsonb->'people'->0->'metrics'->>'como_participante'),
  '3/1', 'Participação como responsável e como participante');
select ok(:'rep'::jsonb->>'notice' like '%não devem ser usados como avaliação automática%', 'Aviso de que não é avaliação automática');
select throws_ok(format($$select public.productivity_report('month', %L, null, %L)$$, :'p', :'colab2'), '42501', null,
  'Colaborador não vê os indicadores de colega');

-- ------------------------------------------------------------ Equipe
select tests.set_claims(:'gestor');
select public.productivity_report('month', :'p') as team \gset
select ok((select count(*) from jsonb_array_elements(:'team'::jsonb->'people') x where x->>'user_id' in (:'colab', :'colab2')) = 2,
  'Gestor vê a equipe do seu escopo');
select is((:'team'::jsonb->'totals'->>'concluidas')::int,
  (select sum((x->'metrics'->>'concluidas')::int)::int from jsonb_array_elements(:'team'::jsonb->'people') x), 'Coletivo = soma das pessoas');
select tests.set_claims(:'fora');
select is((select count(*)::int from jsonb_array_elements(public.productivity_report('month', :'p')->'people') x
           where x->>'user_id' in (:'colab', :'colab2')), 0, 'Gestor de outra secretaria não vê essa equipe');
select tests.set_claims(:'sem');
select throws_ok(format($$select public.productivity_report('month', %L)$$, :'p'), '42501', null, 'Sem permissão de produtividade não há relatório');
select tests.set_claims(:'colab');
select is(jsonb_array_length(public.productivity_series('month', 6)), 6, 'Série dos últimos 6 meses');

-- ------------------------------------------------------------ Consolidação
reset role;
select ok(private.consolidate_productivity() >= 2, 'Rotina consolida o mês fechado');
select is(private.consolidate_productivity(), 0, 'Consolidação idempotente');
-- Mudança posterior nos dados não altera o período já consolidado.
set local session_replication_role = replica;
update public.tasks set status = 'done', completed_at = tests.ts(:'p'::date + 25) where id = '94000000-0000-4000-8000-000000000003';
set local session_replication_role = origin;
set local role authenticated;
select tests.set_claims(:'colab');
select is((public.productivity_report('month', :'p')->'people'->0->'metrics'->>'concluidas')::int, 2,
  'Período fechado usa o registro consolidado');
select is((select count(*)::int from public.productivity_snapshots where user_id <> :'colab'), 0, 'Cada pessoa vê só os próprios registros consolidados');

select * from finish();
rollback;
