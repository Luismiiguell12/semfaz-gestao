-- Fase 6: auditoria das exportações de relatórios.
begin;
\ir _helpers.psql
select plan(9);

select tests.create_user('rx_gestor', array['manager']) as gestor \gset
select tests.create_user('rx_colab', array['collaborator']) as colab \gset
select tests.create_user('rx_sem', array[]::text[]) as sem \gset

set local role authenticated;
select tests.set_claims(:'gestor');
select lives_ok($$select public.log_report_export('imoveis', 'xlsx', '{"departamento":"x"}', 12)$$, 'Gestor com reports.export registra a exportação');
select throws_ok($$select public.log_report_export('Imoveis; drop', 'xlsx', '{}', 1)$$, '22023', null, 'Nome de relatório inválido');
select throws_ok($$select public.log_report_export('imoveis', 'docx', '{}', 1)$$, '22023', null, 'Formato inválido');
select throws_ok($$select public.log_report_export('imoveis', 'pdf', '[1]', 1)$$, '22023', null, 'Filtros precisam ser um objeto');
select throws_ok($$select public.log_report_export('imoveis', 'pdf', '{}', -1)$$, '22023', null, 'Quantidade de linhas inválida');

select tests.set_claims(:'colab');
select throws_ok($$select public.log_report_export('imoveis', 'xlsx', '{}', 1)$$, '42501', null, 'Colaborador sem reports.export não exporta');
select tests.set_claims(:'sem');
select throws_ok($$select public.log_report_export('imoveis', 'xlsx', '{}', 1)$$, '42501', null, 'Usuário sem papel não exporta');

reset role;
select is((select count(*)::int from public.audit_logs where operation = 'EXPORT' and actor_id = :'gestor'), 1,
  'Uma linha EXPORT na auditoria (tentativas inválidas não registram)');
select ok((select metadata from public.audit_logs where operation = 'EXPORT' and actor_id = :'gestor')
  @> '{"report":"imoveis","format":"xlsx","filters":{"departamento":"x"},"rows":12}'::jsonb,
  'Auditoria guarda relatório, formato, filtros e linhas');

select * from finish();
rollback;
