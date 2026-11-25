-- Fase 4: demandas, participantes, status e histórico, comentários, atraso,
-- exclusão por aprovação, calendário, anexos e rotina de prazos.
begin;
\ir _helpers.psql
select plan(48);

select tests.create_user('tk_admin1', array['admin']) as admin1 \gset
select tests.create_user('tk_admin2', array['admin']) as admin2 \gset
select tests.create_user('tk_gestor', array['manager']) as gestor \gset
select tests.create_user('tk_fora', array['manager']) as fora \gset
select tests.create_user('tk_colab', array['collaborator']) as colab \gset
select tests.create_user('tk_colab2', array['collaborator']) as colab2 \gset
select tests.create_user('tk_consulta', array['viewer']) as consulta \gset
select tests.enroll_mfa(:'admin1');
select tests.enroll_mfa(:'admin2');
insert into public.departments (id, organization_id, kind, name) values
  ('93000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', 'secretariat', 'Secretaria Fora Demandas');
insert into public.user_department_access (organization_id, user_id, department_id) values
  ('00000000-0000-4000-8000-000000000001', :'gestor', '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000000001', :'colab', '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000000001', :'colab2', '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000000001', :'consulta', '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000000001', :'fora', '93000000-0000-4000-8000-000000000009');
select id as cat from public.task_categories where name = 'Financeiro' \gset
select private.today_local() as today \gset

select is((select count(*)::int from public.task_categories where is_system), 7, 'Sete categorias iniciais');

-- ------------------------------------------------------------ Criação
set local role authenticated;
select tests.set_claims(:'consulta');
select throws_ok(format($$select public.save_task(null, jsonb_build_object('title', 'Sem permissão', 'department_id', '00000000-0000-4000-8000-000000000101', 'category_id', %L, 'responsible_id', %L))$$, :'cat', :'consulta'),
  '42501', null, 'Sem tasks.create não cria demanda');

select tests.set_claims(:'colab');
select public.save_task(null, jsonb_build_object(
  'title', 'Conferir faturas de energia', 'description', 'Teste', 'department_id', '00000000-0000-4000-8000-000000000101',
  'category_id', :'cat', 'responsible_id', :'gestor', 'participants', jsonb_build_array(:'consulta'),
  'due_date', (:'today'::date + 10), 'urgency', 'high', 'priority', 'urgent', 'complexity', 'complex',
  'created_by', :'admin1')) as t1 \gset
reset role;
select is((select created_by from public.tasks where id = :'t1'), :'colab'::uuid, 'Criador definido pelo banco (auth.uid()), nunca pelo cliente');
select is((select count(*)::int from public.task_assignees where task_id = :'t1'), 2, 'Responsável e participante vinculados');
select is((select count(*)::int from public.task_status_history where task_id = :'t1' and from_status is null and to_status = 'todo'), 1,
  'Criação registrada no histórico de status');
select is((select count(*)::int from public.notifications where entity_id = :'t1' and type_code = 'task_created'), 2,
  'Responsável e participante notificados');
select is((select urgency::text || '/' || priority::text from public.tasks where id = :'t1'), 'high/urgent', 'Urgência e prioridade independentes');
set local role authenticated;

-- ------------------------------------------------------------ Visibilidade (RLS)
select tests.set_claims(:'consulta');
select is((select count(*)::int from public.tasks where id = :'t1'), 1, 'Participante vê a demanda (mesmo sem permissão de demandas)');
select tests.set_claims(:'colab2');
select is((select count(*)::int from public.tasks where id = :'t1'), 0, 'Colega sem participação e sem tasks.view_all não vê');
select tests.set_claims(:'gestor');
select is((select count(*)::int from public.tasks_overview where id = :'t1'), 1, 'Gestor do escopo vê');
select tests.set_claims(:'fora');
select is((select count(*)::int from public.tasks where id = :'t1') + (select count(*)::int from public.task_comments where task_id = :'t1'), 0,
  'Gestor de outra secretaria não vê');

-- ------------------------------------------------------------ Status
select tests.set_claims(:'consulta');
select lives_ok(format($$select public.set_task_status(%L, 'in_progress')$$, :'t1'), 'Participante move a demanda');
select throws_ok(format($$select public.set_task_status(%L, 'done')$$, :'t1'), '42501', null, 'Concluir exige tasks.complete');
select tests.set_claims(:'colab2');
select throws_ok(format($$select public.set_task_status(%L, 'review')$$, :'t1'), '42501', null, 'Quem não participa não altera status');
select tests.set_claims(:'gestor');
select lives_ok(format($$select public.set_task_status(%L, 'done', 'Faturas conferidas')$$, :'t1'), 'Responsável conclui');
reset role;
select is((select completed_by from public.tasks where id = :'t1'), :'gestor'::uuid, 'Registro de quem concluiu');
select ok((select completed_at is not null and completion_note = 'Faturas conferidas' from public.tasks where id = :'t1'), 'Registro de quando concluiu e observação');
select is((select count(*)::int from public.task_status_history where task_id = :'t1'), 3, 'Toda mudança de status vai para o histórico');
select is((select count(*)::int from public.notifications where entity_id = :'t1' and type_code = 'task_completed'), 2,
  'Conclusão notifica os envolvidos (exceto quem concluiu)');
set local role authenticated;
select tests.set_claims(:'consulta');
select throws_ok(format($$select public.set_task_status(%L, 'in_progress')$$, :'t1'), '42501', null, 'Participante não reabre demanda concluída');
select tests.set_claims(:'gestor');
select throws_ok(format($$select public.set_task_status(%L, 'cancelled', 'curto')$$, :'t1'), '22023', null, 'Cancelamento exige motivo');

-- ------------------------------------------------------------ Atraso calculado
select tests.set_claims(:'colab');
select public.save_task(null, jsonb_build_object('title', 'Demanda atrasada', 'department_id', '00000000-0000-4000-8000-000000000101',
  'category_id', :'cat', 'responsible_id', :'colab', 'due_date', (:'today'::date - 1))) as t2 \gset
select is((select is_overdue from public.tasks_overview where id = :'t2'), true, 'Prazo vencido: atrasada');
select is((select status::text from public.tasks where id = :'t2'), 'todo', 'Atraso não altera o status');
select lives_ok(format($$select public.set_task_status(%L, 'done')$$, :'t2'), 'Colaborador responsável conclui');
select is((select is_overdue from public.tasks_overview where id = :'t2'), false, 'Concluída não é considerada atrasada');

-- ------------------------------------------------------------ Edição e comentários
select tests.set_claims(:'consulta');
select throws_ok(format($$select public.save_task(%L, jsonb_build_object('title', 'Tentativa', 'department_id', '00000000-0000-4000-8000-000000000101', 'category_id', %L, 'responsible_id', %L))$$, :'t1', :'cat', :'consulta'),
  '42501', null, 'Participante não edita os dados');
select public.add_task_comment(:'t1', 'Comentário do participante') is not null as c_ok \gset
select tests.set_claims(:'colab');
select lives_ok(format($$select public.save_task(%L, jsonb_build_object('title', 'Conferir faturas de energia e água', 'department_id', '00000000-0000-4000-8000-000000000101', 'category_id', %L, 'responsible_id', %L, 'participants', jsonb_build_array(%L)))$$,
  :'t1', :'cat', :'colab2', :'consulta'), 'Criador troca o responsável');
reset role;
select is((select count(*)::int from public.notifications where entity_id = :'t1' and type_code = 'task_assignee_changed' and user_id = :'colab2'), 1,
  'Novo responsável notificado');
select is((select user_id from public.task_assignees where task_id = :'t1' and role = 'responsible'), :'colab2'::uuid, 'Responsável atualizado nos participantes');
select is((select count(*)::int from public.notifications where entity_id = :'t1' and type_code = 'task_comment'), 2, 'Comentário notifica os demais envolvidos');
select throws_ok(format('update public.task_comments set body = %L where task_id = %L', 'x', :'t1'), '42501', null, 'Comentários são imutáveis');
set local role authenticated;

-- ------------------------------------------------------------ Exclusão por aprovação
select tests.set_claims(:'gestor');
select throws_ok(format($$select public.request_task_deletion(%L, 'Demanda criada por engano no sistema')$$, :'t1'), '42501', null,
  'Somente o criador solicita a exclusão');
select tests.set_claims(:'colab');
select (public.request_task_deletion(:'t1', 'Demanda criada em duplicidade por engano')).id as del1 \gset
select is((select count(*)::int from public.tasks where id = :'t1'), 1, 'Sem exclusão imediata: continua visível até a decisão');
select tests.set_claims(:'admin1', 'aal2');
select throws_ok(format($$update public.approval_rules set requires_approval = false where operation_code = 'task.delete'$$), '42501', null,
  'A aprovação da exclusão de demanda não pode ser dispensada');
select is((public.decide_approval(:'del1', 'approved')).status::text, 'approved', 'Administrador aprova a exclusão');
select tests.set_claims(:'colab');
select is((select count(*)::int from public.tasks where id = :'t1'), 0, 'Demanda excluída deixa de aparecer');
reset role;
select ok((select deleted_at is not null and deletion_reason is not null from public.tasks where id = :'t1'), 'Exclusão lógica: permanece no banco');
set local role authenticated;

select tests.set_claims(:'colab');
select throws_ok(format($$select public.request_task_exceptional_deletion(%L, 'Exclusão excepcional sem permissão')$$, :'t2'), '42501', null,
  'Exclusão excepcional só por administrador');
select tests.set_claims(:'admin1', 'aal2');
select (public.request_task_exceptional_deletion(:'t2', 'Criador desligado da Secretaria, demanda órfã')).id as del2 \gset
select throws_ok(format($$select public.decide_approval(%L, 'approved')$$, :'del2'), '42501', null, 'Autoaprovação bloqueada');
select tests.set_claims(:'admin2', 'aal2');
select is((public.decide_approval(:'del2', 'approved')).status::text, 'approved', 'Outro administrador autoriza a exclusão excepcional');
select is((select count(*)::int from public.task_deletion_requests where task_id in (:'t1', :'t2') and status = 'approved'), 2,
  'Solicitações de exclusão registradas');

-- ------------------------------------------------------------ Calendário e anexos
select tests.set_claims(:'colab');
select public.save_task(null, jsonb_build_object('title', 'Preparar reunião de contratos', 'department_id', '00000000-0000-4000-8000-000000000101',
  'category_id', :'cat', 'responsible_id', :'colab', 'due_date', (:'today'::date + 1), 'due_time', '14:30')) as t3 \gset
select public.save_task_event(null, jsonb_build_object('kind', 'meeting', 'title', 'Reunião com a fiscalização',
  'starts_at', ((:'today'::date + 2)::timestamp + time '09:00') at time zone 'America/Maceio',
  'ends_at', ((:'today'::date + 2)::timestamp + time '10:00') at time zone 'America/Maceio',
  'attendees', jsonb_build_array(:'consulta'))) as ev \gset
select is((select count(*)::int from public.calendar_items(:'today'::date, :'today'::date + 7)), 2, 'Calendário: demanda (prazo) e reunião');
select tests.set_claims(:'consulta');
select is((select count(*)::int from public.calendar_items(:'today'::date, :'today'::date + 7) where item_type = 'event'), 1,
  'Participante do evento o vê no calendário');
select tests.set_claims(:'colab2');
select is((select count(*)::int from public.calendar_items(:'today'::date, :'today'::date + 7)), 0, 'Quem não participa não vê');
select is(private.can_access_document_entity('task', :'t3', 'view'), false, 'Anexos seguem o acesso à demanda');
select tests.set_claims(:'colab');
select is((public.dashboard_task_stats()->>'open')::int, 1, 'Painel: demandas abertas do usuário');

-- ------------------------------------------------------------ Rotina de prazos
reset role;
select ok(private.generate_task_reminders() >= 1, 'Rotina avisa prazo próximo');
select is(private.generate_task_reminders(), 0, 'Sem avisos repetidos');

select * from finish();
rollback;
